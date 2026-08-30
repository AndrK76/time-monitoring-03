import { Component, input, output, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // добавить
import { UserInfo, RoleInfo } from '../user-view.models';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    MatProgressSpinnerModule, // добавить
  ],
  templateUrl: './user-editor-inplace.component.html',
  styleUrl: './user-editor-inplace.component.scss'
})
export class UserEditorInplaceComponent implements OnInit {
  userData = input.required<UserInfo>();
  roles = input.required<RoleInfo[]>();

  change = output<UserInfo>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  loading = signal<boolean>(false); // сигнал загрузки

  ngOnInit(): void {
    this.buildForm();
    this.loadDetails(); // запускаем загрузку после построения формы
    this.listenToChanges();
  }

  private buildForm(): void {
    const data = this.userData();
    this.form = this.fb.group({
      id: [{ value: data.id, disabled: true }],
      username: [data.username, Validators.required],
      email: [data.email, [Validators.required, Validators.email]],
      firstName: [data.firstName],
      lastName: [data.lastName],
      displayName: [data.displayName, Validators.required],
      active: [data.active],
      approved: [data.approved],
      roles: [data.roles || []]
    });
  }

  private loadDetails(): void {
    this.loading.set(true);
    // Имитация задержки запроса (1 секунда)
    setTimeout(() => {
      this.loading.set(false);
    }, 1000);
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
        const allRoles = this.roles();
        const rolesWithInfo = (values.roles || []).map((roleName: string) => {
          const found = allRoles.find(r => r.name === roleName);
          return found || new RoleInfo(roleName, '');
        });

        const updated: UserInfo = new UserInfo(
          this.userData().id,
          values.username,
          values.email,
          values.firstName || '',
          values.lastName || '',
          values.displayName,
          this.userData().avatarUrl,
          values.active,
          values.approved,
          this.userData().emailVerified,
          values.roles || [],
          this.userData().permissions,
          this.userData().anonymous,
          rolesWithInfo
        );
        this.change.emit(updated);
      });
  }

  resetToData(data: UserInfo): void {
    this.form.patchValue({
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      active: data.active,
      approved: data.approved,
      roles: data.roles || []
    }, { emitEvent: false });
  }
}