import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { AuthService, ChangePasswordRequestDto, PermissionService, UserManageService } from '@mon3/sa';
import { UserWithFullInfo } from '../user-view.models';
import { DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService, SaveDataResult, TableFilterInfo, TableFilterType, TableManageService } from '@mon3/sc';
import { catchError, finalize, forkJoin, map, Observable, of, tap, throwError } from 'rxjs';
import { createEmptyUser, userResponseDtoToFullView, userListDtoToFullView, userViewToRequestDto } from '../user-view.utils';
import { CommonModule } from '@angular/common';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { UserEditorInplaceComponent } from '../user-editor-inplace/user-editor-inplace.component';
import { authConstant } from '../../../auth-constants';
import { RoleInfo } from '../../roles/role-view.models';
import { roleResponseDtoToVIew } from '../../roles/role-view.utils';
import { OrganizationInfo } from '../../organizations/organization-view.models';
import { organizationListDtoToView } from '../../organizations/organization-view.utils';

@Component({
  selector: 'app-user-list-table',
  standalone: true,
  imports: [CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    UserEditorInplaceComponent,
    MatTooltipModule,
    MatSortModule,
    FilterRootComponent],
  providers: [TableManageService],
  templateUrl: './user-list-table.component.html',
  styleUrl: './user-list-table.component.scss'
})
export class UserListTableComponent implements OnInit, AfterViewInit {
  dataService = inject(UserManageService);
  permisService = inject(PermissionService);
  authService = inject(AuthService);

  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<UserWithFullInfo>);


  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<UserWithFullInfo>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>

  roles = signal<RoleInfo[]>([]);
  users = signal<UserWithFullInfo[]>([]);
  organizations = signal<OrganizationInfo[]>([]);

  displayedColumns = ['expand', 'username', 'displayName', 'active', 'approved', 'rolesWithInfo'];
  trackById = (index: number, item: UserWithFullInfo) => item.id;
  itemId = (item: UserWithFullInfo) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  _filterConfig: Map<string, TableFilterInfo> = new Map<string, TableFilterInfo>([
    ['username', { key: 'username', type: TableFilterType.TEXT }],
    ['displayName', { key: 'displayName', type: TableFilterType.TEXT }],
    ['roles', { key: 'roles', type: TableFilterType.LIST, config: { dataSource: [] } }],
    ['active', { key: 'active', type: TableFilterType.LIST, config: { dataSource: [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }] } }],
    ['approved', { key: 'approved', type: TableFilterType.LIST, config: { dataSource: [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }] } }],
  ]);

  canFullUpdate = signal(false);
  canPartialUpdate = signal(true);
  someUser = signal(false);

  ngOnInit(): void {
    this.canFullUpdate.set(this.permisService.checkPermissions(authConstant('fullUserUpdate')))
    this.canPartialUpdate.set(this.permisService.checkPermissions(authConstant('partUserUpdate')))
    this.tableManager.breakpointsSubscribe();
    this.filterConfig.set(this._filterConfig);
    this.initializeData();
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.showFilter.set(false);
  }
  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  initializeData = (): void => {
    this.isLoading.set(false);
    this.error.set(null);

    forkJoin({
      roles: this.dataService.getAllRoles()
        .pipe(
          map(list => list.map(dto => roleResponseDtoToVIew(dto))),
          this.tableManager.handleError<RoleInfo[]>('Ошибка загрузки списка ролей', []),
        ),
      organizations: this.dataService.getAlOrganizations()
        .pipe(
          map(list => list.map(dto => organizationListDtoToView(dto))),
          this.tableManager.handleError<OrganizationInfo[]>('Ошибка загрузки списка организаций', []),
        ),
    }).subscribe({
      next: (result) => {
        const { roles } = result as { roles: RoleInfo[]; };

        this.roles.set(roles);
        this.filterConfig.update(map => {
          const config = map.get('roles');
          if (config) {
            const dataSource = roles.map(p => ({ id: p.name, text: p.description }));
            const newMap = new Map(map);
            newMap.set('roles', { ...config, config: { ...config.config, dataSource } });
            return newMap;
          }
          return map;
        });
        this.loadData();
      },
      error: () => {
        this.isLoading.set(false);
      }
    })
  }

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);
    const roles = this.roles();

    this.dataService.getUsersList()
      .pipe(
        map(list => list.map(dto => userListDtoToFullView(dto, roles))),
        this.tableManager.handleError<UserWithFullInfo[]>('Ошибка загрузки пользователей', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          const rows = result as UserWithFullInfo[];

          this.tableManager.setData(rows);
          this.tableManager.handleUrlParams();
          if (this.selectedItem()) {
            const _item = this.selectedItem();
            this.selectedItem.set(undefined);
            this.tableManager.scrollToItemId(_item?.id);
            setTimeout(() => {
              this.selectedItem.set(_item);
            }, 300);
          }
        }
      });
  }

  loadItem = (item: UserWithFullInfo): Observable<UserWithFullInfo | undefined> => {
    const roles = this.roles();
    const organizationns = this.organizations();
    this.tableManager.snackError.set(null);
    return this.dataService.getUserById(item.id).pipe(
      map(dto => userResponseDtoToFullView(dto, roles, organizationns)),
      this.tableManager.handleError<UserWithFullInfo | undefined>('Ошибка загрузки информации о пользователе', undefined, this.tableManager.snackError),
      tap(_ => {
        const err = this.tableManager.snackError();
        if (err) {
          this.notificationService.error(err);
          this.tableManager.snackError.set(null);
        }

      })
    );
  }

  addItem = (item: UserWithFullInfo): Observable<UserWithFullInfo> => {
    const reqItem = userViewToRequestDto(item);
    const roles = this.roles();
    const organizations = this.organizations();
    return this.dataService.addUser(reqItem).pipe(
      map(dto => userResponseDtoToFullView(dto, roles, organizations)));
  }

  updateItem = (item: UserWithFullInfo): Observable<UserWithFullInfo> => {
    const reqItem = userViewToRequestDto(item);
    const roles = this.roles();
    const organizations = this.organizations();
    return this.dataService.updateUser(item.id, reqItem).pipe(
      map(dto => userResponseDtoToFullView(dto, roles, organizations)));
  }

  deleteItem = (item: UserWithFullInfo): Observable<void> => {
    return throwError(() => new Error('Недопустимая операция'));
  }

  setPassword = (item: UserWithFullInfo, data: ChangePasswordRequestDto): Observable<void> => {
    return (this.someUser() ? this.authService.changePassword(data) : this.dataService.setPassword(item.id, data))
      .pipe(
        tap(_ => { this.notificationService.success('Пароль изменен') }),
        catchError((err: any) => {
          this.notificationService.error('Ошибка смены пароля');
          return of();
        }));
  }

  resetPassword = (item: UserWithFullInfo): Observable<void> => {
    return this.dataService.resetPassword(item.id).pipe(
      tap(_ => { this.notificationService.success('Пароль сброшен') }),
      catchError((err: any) => {
        this.notificationService.error('Ошибка сброса пароля');
        return of();
      }));
  }


  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  }

  callSelect = (item: UserWithFullInfo) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd = () => this.doAdd();
  callDelete(item: UserWithFullInfo) {
    if (isNewItem(item)) {
      this.doDelete(item);
    }
  }
  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }


  private doSelect = (item: UserWithFullInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    const onSelect = () => {
      this.someUser.set(this.permisService.isSomeUser(item));
    }
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, onSelect);
  }
  doLoadedItem = (item: UserWithFullInfo | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  }

  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());
  private doAdd(): void {
    const newItem = createEmptyUser();
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }
  doUpdate = (item: UserWithFullInfo) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  private doDelete = (item: UserWithFullInfo) => this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<UserWithFullInfo>) => {
      if (result.success) {
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    }
    this.tableManager.doSaveBase(this.isSaving,
      (item: UserWithFullInfo) => this.addItem(item),
      (item: UserWithFullInfo) => this.updateItem(item),
      (item: UserWithFullInfo) => this.deleteItem(item),
      resApply);
  }

}
