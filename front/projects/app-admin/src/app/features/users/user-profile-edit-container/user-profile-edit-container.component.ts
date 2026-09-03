import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { UserWithFullInfo } from '../user-view.models';
import { AuthService, ChangePasswordRequestDto, handleError, PermissionService, UserManageService, UserResponseDto } from '@mon3/sa';
import { catchError, finalize, forkJoin, map, Observable, of, tap, throwError } from 'rxjs';
import { userResponseDtoToFullView, userViewToRequestDto } from '../user-view.utils';
import { MatIconModule } from '@angular/material/icon';
import { UserEditorInplaceComponent } from '../user-editor-inplace/user-editor-inplace.component';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DialogService, hasChanges, NotificationService } from '@mon3/sc';
import { authConstant } from '../../../auth-constants';
import { RoleInfo } from '../../roles/role-view.models';
import { roleResponseDtoToVIew } from '../../roles/role-view.utils';
import { OrganizationInfo } from '../../organizations/organization-view.models';

@Component({
  selector: 'app-user-profile-edit-container',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    UserEditorInplaceComponent],
  templateUrl: './user-profile-edit-container.component.html',
  styleUrl: './user-profile-edit-container.component.scss'
})
export class UserProfileEditContainerComponent implements OnInit {

  private readonly dataService = inject(UserManageService);
  private readonly permisService = inject(PermissionService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialogService = inject(DialogService);

  roles = signal<RoleInfo[]>([]);
  organizations = signal<OrganizationInfo[]>([]);
  user = signal<UserWithFullInfo | undefined>(undefined);
  userToSave = signal<UserWithFullInfo | undefined>(undefined);

  isLoading = signal(false);
  isSaving = signal(false);
  dataChanged = signal(false);
  error = signal<string | null>(null);
  spinnerText = computed(() => this.isSaving() ? 'Сохранение данных...' : 'Загрузка данных...');


  canFullUpdate = signal(false);
  canPartialUpdate = signal(true);
  someUser = signal(true);

  ngOnInit(): void {
    this.initializeData();
  }

  initializeData = (): void => {
    this.canFullUpdate.set(this.permisService.checkPermissions(authConstant('fullUserUpdate')))
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      roles:
        (this.canFullUpdate() ? this.dataService.getAllRoles() : this.dataService.getCurrentUserRoles())
          //throwError(() => new Error('Тестовая ошибка загрузки'))
          .pipe(
            map(list => list.map(dto => roleResponseDtoToVIew(dto))),
            handleError<RoleInfo[]>('Ошибка загрузки списка ролей', [], this.error)),
    }).subscribe({
      next: (result) => {
        if (!this.error()) {
          const { roles } = result as { roles: RoleInfo[] };
          this.roles.set(roles);
          //setTimeout(() => {
          this.loadData();
          //}, 5000);
        } else {
          this.isLoading.set(false)
        }
      },
      error: () => this.isLoading.set(false)
    })
  }

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);
    this.user.set(undefined);
    this.userToSave.set(undefined);
    this.dataChanged.set(false);
    const roles = this.roles();
    const organizations = this.organizations();

    this.dataService.getCurrentUser()
      .pipe(
        map(dto => userResponseDtoToFullView(dto, roles, organizations)),
        handleError<UserWithFullInfo | null>('Ошибка загрузки пользователей', null, this.error),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          if (!this.error()) {
            const user = result as UserWithFullInfo;
            this.user.set(user);
            this.userToSave.set(user);
          }
        }
      });
  }

  loadItem = (item: UserWithFullInfo): Observable<UserWithFullInfo> => { return of(item) };


  setPassword = (item: UserWithFullInfo, data: ChangePasswordRequestDto): Observable<void> => {
    return this.authService.changePassword(data)
      .pipe(
        tap(_ => { this.notificationService.success('Пароль изменен') }),
        catchError((err: any) => {
          this.notificationService.error('Ошибка смены пароля');
          return of();
        }));
  }


  callSave = () => {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  callReload = () => {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doReload();
    });
  }

  onUpdate = (item: UserWithFullInfo) => {
    if (hasChanges<UserWithFullInfo>(this.userToSave()!, item)) {
      this.userToSave.set(item);
      this.dataChanged.set(true);
    }
  }

  private doSave = () => {
    const reqItem = userViewToRequestDto(this.userToSave()!);
    const id = this.userToSave()!.id;
    const roles = this.roles();
    const organizations = this.organizations();
    this.isSaving.set(true);
    //setTimeout(() => {
    return (this.canFullUpdate() ? this.dataService.updateUser(id, reqItem) : this.dataService.updateCurrentUser(reqItem))
      .pipe(
        finalize(() => this.isSaving.set(false)),
        map(dto => userResponseDtoToFullView(dto, roles, organizations)),
        tap(v => { this.user.set(v); this.userToSave.set(v); this.dataChanged.set(false) }),
        tap(_ => this.notificationService.success('Данные успешно сохранены')),
        catchError((_) => { this.notificationService.error('Ошибка сохранения'); return of(); })
      ).subscribe();
    //}, 2000);
  }

  private doReload = () => this.loadData();


}
