import { Component, input, output, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // добавить
import { UserWithFullInfo } from '../user-view.models';
import { debounceTime, distinctUntilChanged, filter, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangePasswordDialogData, ChangePasswordDialogResult, DialogService, isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { userOrganizationsWithInfo, userRolesWithInfo } from '../user-view.utils';
import { MatIconModule } from '@angular/material/icon';
import { ChangePasswordRequestDto } from '@mon3/sa';
import { RoleInfo } from '../../roles/role-view.models';
import { OrganizationInfo } from '../../organizations/organization-view.models';

@Component({
  selector: 'app-user-editor-inplace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './user-editor-inplace.component.html',
  styleUrl: './user-editor-inplace.component.scss'
})
export class UserEditorInplaceComponent implements OnInit {
  userData = input.required<UserWithFullInfo>();
  roles = input.required<RoleInfo[]>();
  organizations = input.required<OrganizationInfo[]>();
  loadItemFn = input.required<(item: UserWithFullInfo) => Observable<UserWithFullInfo | undefined>>();
  setPasswordFn = input.required<(item: UserWithFullInfo, data: ChangePasswordRequestDto) => Observable<void>>();
  resetPasswordFn = input<(item: UserWithFullInfo) => Observable<void>>();
  canFullUpdate = input.required<boolean>();
  canPartialUpdate = input.required<boolean>();
  isSomeUser = input.required<boolean>();


  loaded = output<UserWithFullInfo>();
  change = output<UserWithFullInfo>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private dialogService = inject(DialogService);

  form!: FormGroup;
  data!: UserWithFullInfo;
  loading = signal<boolean>(false);

  showResetPassword = signal<boolean>(true);
  showOldPassword = signal<boolean>(false);


  ngOnInit(): void {
    this.data = this.userData();
    this.showResetPassword.set(this.canFullUpdate() && !this.isSomeUser());
    this.showOldPassword.set(this.isSomeUser());
    this.buildForm();
    this.loadDetails();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      id: [{ value: this.data.id, disabled: true }],
      username: [{ value: this.data.username, disabled: !this.canFullUpdate() }, Validators.required],
      email: [this.data.email, [Validators.required, Validators.email]],
      firstName: [this.data.firstName],
      lastName: [this.data.lastName],
      displayName: [this.data.displayName, Validators.required],
      active: [this.data.active],
      approved: [this.data.approved],
      roles: [{ value: this.data.roles || [], disabled: !this.canFullUpdate() }]
    });
  }

  private loadDetails(): void {
    if (isNotFullLoadedItem(this.data) && !isNewItem(this.data)) {
      this.loading.set(true);
      this.loadItemFn()(this.data).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data) => {
          if (data) {
            this.data = data;
            this.loaded.emit(this.data);
            this.loading.set(false);
            this.buildForm();
            this.listenToChanges();
          } else {
            this.listenToChanges();
          }
        }
      });
    } else {
      this.loading.set(false);
      this.listenToChanges();
    }

  }

  private listenToChanges(): void {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        filter(() => !this.loading()), // игнорируем изменения, пока идёт загрузка
        filter(values => values && typeof values === 'object'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const updated: UserWithFullInfo = new UserWithFullInfo(
          this.data.id,
          values.username || this.data.username,
          values.email,
          values.firstName || '',
          values.lastName || '',
          values.displayName,
          this.data.avatarUrl,
          values.active || this.data.active,
          values.approved || this.data.approved,
          this.data.emailVerified,
          values.roles || this.data.roles,
          this.data.permissions,
          this.data.anonymous,
          userRolesWithInfo((values.roles ? values : this.data), this.roles()),
          this.data.organizations,
          userOrganizationsWithInfo(this.data, this.organizations())
        );
        this.change.emit(updated);
      });
  }

  toggleActive(): void {
    const current = this.data.active;
    const newValue = !current;
    const action = current ? 'Заблокировать' : 'Разблокировать';
    const message = current
      ? `Заблокировать пользователя ${this.data.username}?`
      : `Разблокировать пользователя ${this.data.username}?`;

    this.dialogService.confirm(message, 'Подтверждение').subscribe(confirmed => {
      if (confirmed) {
        this.data = { ...this.data, active: newValue };
        this.form.patchValue({ active: newValue }, { emitEvent: true });
      }
    });
  }

  toggleApproved(): void {
    const current = this.data.approved;
    if (current) return; // если уже подтверждён, кнопка неактивна

    this.dialogService.confirm(
      `Подтвердить пользователя ${this.data.username}?`,
      'Подтверждение'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.data = { ...this.data, approved: true };
        this.form.patchValue({ approved: true }, { emitEvent: true });
      }
    });
  }

  openChangePassword(): void {
    if (this.loading()) return;
    const data: ChangePasswordDialogData = {
      username: this.data.username,
      resetAvailable: this.showResetPassword(),
      showOldPassword: this.showOldPassword()
    };
    this.dialogService.changePassword(data).subscribe((result: ChangePasswordDialogResult) => {
      if (result.action === 'set') {
        this.setPasswordFn()(this.data, result.data).subscribe();
      } else if (result.action === 'reset' && this.resetPasswordFn) {
        this.resetPasswordFn()!(this.data).subscribe();
      }
    });
  }

}