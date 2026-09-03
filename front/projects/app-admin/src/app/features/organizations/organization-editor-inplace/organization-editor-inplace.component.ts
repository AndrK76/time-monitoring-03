import { Component, input, output, inject, DestroyRef, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserListItemDto } from '@mon3/sa';
import { debounceTime, distinctUntilChanged, filter, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrganizationInfo } from '../organization-view.models';
import { getIdsArray, isArrayEqualByKeys, isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { UserShortInfo } from '../../users/user-view.models';
import { OrganizationUserListComponent } from '../organization-user-list/organization-user-list.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { organizationUsersWithInfo, organizationUsersWithInfoFromUserIds } from '../organization-view.utils';

@Component({
  selector: 'app-organization-editor-inplace',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
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
  usersData = signal<UserShortInfo[]>([]);
  isEditNewItem = signal<boolean>(false);

  @ViewChild(OrganizationUserListComponent) userListComponent!: OrganizationUserListComponent;

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
    });
  }

  private loadDetails(): void {
    this.isEditNewItem.set(isNewItem(this.data));
    if (isNotFullLoadedItem(this.data) && !this.isEditNewItem()) {
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

  private makeNewOrgVal = (mainData: any, userIds: string[] | undefined): OrganizationInfo => {
    const allUsers = this.users();
    return {
      id: this.data.id,
      shortName: mainData.shortName,
      fullName: mainData.fullName,
      users: userIds || [],
      usersWithInfo: organizationUsersWithInfoFromUserIds(userIds || [], allUsers)
    } as OrganizationInfo;
  }

  private listenToChanges(): void {
    this.usersData.set(this.data?.usersWithInfo || []);
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        filter(values => values && typeof values === 'object'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const updated = this.makeNewOrgVal(values, this.data.users);
        this.change.emit(updated);
      });
  }

  callAddUser(): void {
    if (this.userListComponent) {
      this.userListComponent.callAdd();
    }
  }

  selectedUser = signal<UserShortInfo | undefined>(undefined);
  onSelectUser = (item: UserShortInfo | undefined) => {
    this.selectedUser.set(item);
  }
  callDeleteUser(): void {
    if (this.userListComponent) {
      this.userListComponent.callDelete(this.selectedUser());
    }
  }
  canAddUserState = signal<boolean>(false);
  onCanAddChange = (value: boolean) => {
    this.canAddUserState.set(value);
  };


  onUserListChange(newData: UserShortInfo[]): void {
    if (!isArrayEqualByKeys<UserShortInfo>(newData, this.data.usersWithInfo, (item: UserShortInfo) => item.id)) {
      const newUsers = getIdsArray<UserShortInfo, string>(newData, (item) => item.id);
      this.data.users = newUsers;
      const updated = this.makeNewOrgVal(this.data, this.data.users);
      this.change.emit(updated);
    }
  }
}