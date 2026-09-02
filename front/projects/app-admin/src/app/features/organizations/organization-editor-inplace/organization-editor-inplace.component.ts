import { Component, input, output, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserListItemDto } from '@mon3/sa';
import { debounceTime, distinctUntilChanged, filter, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrganizationInfo } from '../organization-view.models';
import { isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { UserShortInfo } from '../../users/user-view.models';
import { OrganizationUserListComponent } from '../organization-user-list/organization-user-list.component';

@Component({
  selector: 'app-organization-editor-inplace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    OrganizationUserListComponent
  ],
  templateUrl: './organization-editor-inplace.component.html',
  styleUrl: './organization-editor-inplace.component.scss'
})
export class OrganizationEditorInplaceComponent implements OnInit {
  organizationData = input.required<OrganizationInfo>();
  users = input.required<UserShortInfo[]>();
  loadItemFn = input.required<(item: OrganizationInfo) => Observable<OrganizationInfo | undefined>>();

  loaded = output<OrganizationInfo>();
  change = output<OrganizationInfo>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  data!: OrganizationInfo;
  loading = signal<boolean>(false);

  ngOnInit(): void {
    this.data = this.organizationData();
    this.buildForm();
    this.loadDetails();
  }

  private buildForm(): void {
    const data = this.data;
    this.form = this.fb.group({
      id: [{ value: data.id, disabled: true }],
      shortName: [data.shortName, Validators.required],
      fullName: [data.fullName, Validators.required],
      users: [data.usersWithInfo.map(u => u.id) || []]
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
        filter(values => values && typeof values === 'object'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const allUsers = this.users();
        const selectedUserIds = values.users || [];
        const usersWithInfo = selectedUserIds.map((id: string) => {
          const found = allUsers.find(u => u.id === id);
          return found || { id, username: '', displayName: 'Неизвестный' } as UserListItemDto;
        });

        const updated: OrganizationInfo = {
          id: this.data.id,
          shortName: values.shortName,
          fullName: values.fullName,
          users: values.users || [],
          usersWithInfo: usersWithInfo
        };
        this.change.emit(updated);
      });
  }

  resetToData(data: OrganizationInfo): void {
    this.form.patchValue({
      shortName: data.shortName,
      fullName: data.fullName,
      users: data.usersWithInfo.map(u => u.id)
    }, { emitEvent: false });
  }

  onUserListChange(userIds: string[]): void {
    const allUsers = this.users();
    const usersWithInfo = userIds.map(id => {
      const found = allUsers.find(u => u.id === id);
      return found || { id, username: '', displayName: 'Неизвестный' } as UserShortInfo;
    });
    this.data.users = userIds;
    this.data.usersWithInfo = usersWithInfo;
    // Эмитим изменение
    this.change.emit(this.data);
  }
}