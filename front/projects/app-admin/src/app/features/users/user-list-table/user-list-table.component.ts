import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { AuthService, ChangePasswordRequestDto, PermissionService, UsermanageService } from '@mon3/sa';
import { RoleInfo, UserInfo } from '../user-view.models';
import { DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService, SaveDataResult, TableFilterInfo, TableFilterType, TableManageService } from '@mon3/sc';
import { catchError, finalize, forkJoin, map, Observable, of, tap, throwError } from 'rxjs';
import { createEmptyUser, userItemDtoToView, userListDtoToView, userViewToItem } from '../user-view.utils';
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
  dataService = inject(UsermanageService);
  permisService = inject(PermissionService);
  authService = inject(AuthService);

  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<UserInfo>);

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;

  @ViewChild(MatTable) table!: MatTable<UserInfo>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>



  roles = signal<RoleInfo[]>([]);
  users = signal<UserInfo[]>([]);

  displayedColumns = ['expand', 'username', 'displayName', 'active', 'approved', 'rolesWithInfo'];
  trackById = (index: number, item: UserInfo) => item.id;
  itemId = (item: UserInfo) => item.id;

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
          this.tableManager.handleError<RoleInfo[]>('Ошибка загрузки списка ролей', []),
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
        map(list => list.map(dto => userListDtoToView(dto, roles))),
        this.tableManager.handleError<UserInfo[]>('Ошибка загрузки пользователей', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          const rows = result as UserInfo[];

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

  loadItem = (item: UserInfo): Observable<UserInfo | undefined> => {
    const roles = this.roles();
    this.tableManager.snackError.set(null);
    return this.dataService.getUserById(item.id).pipe(
      map(dto => userItemDtoToView(dto, roles)),
      this.tableManager.handleError<UserInfo | undefined>('Ошибка загрузки информации о пользователе', undefined, this.tableManager.snackError),
      tap(_ => {
        const err = this.tableManager.snackError();
        if (err) {
          this.notificationService.error(err);
          this.tableManager.snackError.set(null);
        }

      })
    );
  }

  addItem = (item: UserInfo): Observable<UserInfo> => {
    const reqItem = userViewToItem(item);
    const roles = this.roles();
    return this.dataService.addUser(reqItem).pipe(
      map(dto => userItemDtoToView(dto, roles)));
  }

  updateItem = (item: UserInfo): Observable<UserInfo> => {
    const reqItem = userViewToItem(item);
    const roles = this.roles();
    return this.dataService.updateUser(item.id, reqItem).pipe(
      map(dto => userItemDtoToView(dto, roles)));
  }

  deleteItem = (item: UserInfo): Observable<void> => {
    return throwError(() => new Error('Недопустимая операция'));
  }

  setPassword = (item: UserInfo, data: ChangePasswordRequestDto): Observable<void> => {

    this.authService.changePassword(data)

    return (this.someUser() ? this.authService.changePassword(data) : this.dataService.setPassword(item.id, data))
      .pipe(
        tap(_ => { this.notificationService.success('Пароль изменен') }),
        catchError((err: any) => {
          this.notificationService.error('Ошибка смены пароля');
          return of();
        }));
  }

  resetPassword = (item: UserInfo): Observable<void> => {
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

  callSelect = (item: UserInfo) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd = () => this.doAdd();
  callDelete(item: UserInfo) {
    if (isNewItem(item)) {
      this.doDelete(item);
    }
  }

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }



  private doSelect = (item: UserInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    const onSelect = () => {
      this.someUser.set(this.permisService.isSomeUser(item));
    }
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, onSelect);
  }
  doLoadedItem = (item: UserInfo | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  }


  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());
  private doAdd(): void {
    const newItem = createEmptyUser();
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }
  doUpdate = (item: UserInfo) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  private doDelete = (item: UserInfo) => this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<UserInfo>) => {
      if (result.success) {
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    }
    console.log(this.tableManager.dataState());
    this.tableManager.doSaveBase(this.isSaving,
      (item: UserInfo) => this.addItem(item),
      (item: UserInfo) => this.updateItem(item),
      (item: UserInfo) => this.deleteItem(item),
      resApply);
  }

}
