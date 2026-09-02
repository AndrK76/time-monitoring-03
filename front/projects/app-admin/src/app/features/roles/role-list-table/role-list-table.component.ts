import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { FilterRootComponent, TableManageService, DialogService, NotificationService, TableFilterInfo, TableFilterType, isExpanded, SaveDataResult, isNewItem } from '@mon3/sc';
import { UserManageService, PermissionResponseDto } from '@mon3/sa';
import { PermissionInfo, RoleWithPermissionsInfo } from '../role-view.models';
import { RoleEditorInplaceComponent } from '../role-editor-inplace/role-editor-inplace.component';
import { roleViewWithPermissToRequestDto, createEmptyRoleWithPermiss, roleRespWithPermissDtoToViewWithPermiss, permissionDtoToVIew } from '../role-view.utils';
import { finalize, forkJoin, map, Observable } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-role-list-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatSortModule,
    FilterRootComponent,
    RoleEditorInplaceComponent,
  ],
  providers: [TableManageService],
  templateUrl: './role-list-table.component.html',
  styleUrl: './role-list-table.component.scss'
})
export class RoleListTableComponent implements OnInit, AfterViewInit {
  private dataService = inject(UserManageService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<RoleWithPermissionsInfo>);

  // Сигналы данных
  permissions = signal<PermissionInfo[]>([]);
  roles = signal<RoleWithPermissionsInfo[]>([])

  // Доступ к сервису
  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<RoleWithPermissionsInfo>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'name', 'description', 'permissions'];
  trackById = (index: number, item: RoleWithPermissionsInfo) => item.id;
  itemId = (item: RoleWithPermissionsInfo) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  // Фильтры
  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['description', { key: 'description', type: TableFilterType.TEXT }],
    ['permissions', { key: 'permissions', type: TableFilterType.LIST, config: { dataSource: [] } }],
  ]);

  ngOnInit(): void {
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
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      permissions: this.dataService.getAllPermissions().pipe(
        map(list => list.map(dto => permissionDtoToVIew(dto))),
        this.tableManager.handleError<PermissionInfo[]>('Ошибка загрузки списка разрешений', []),
      )
    }).subscribe({
      next: (result) => {
        const { permissions } = result as { permissions: PermissionInfo[]; };

        this.permissions.set(permissions);
        this.filterConfig.update(map => {
          const config = map.get('permissions');
          if (config) {
            const dataSource = result.permissions.map(p => ({ id: p.name, text: p.description || p.name }));
            const newMap = new Map(map);
            newMap.set('permissions', { ...config, config: { ...config.config, dataSource } });
            return newMap;
          }
          return map;
        });
        this.loadData();
      },
      error: () => this.isLoading.set(false)
    });
  };

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);
    const permissions = this.permissions();

    this.dataService.getAllRolesWithPermissions()
      .pipe(
        map(list => list.map(dto => roleRespWithPermissDtoToViewWithPermiss(dto, permissions))),
        this.tableManager.handleError<RoleWithPermissionsInfo[]>('Ошибка загрузки ролей', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          const rows = result as RoleWithPermissionsInfo[];

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


  addItem = (item: RoleWithPermissionsInfo): Observable<RoleWithPermissionsInfo> => {
    const req = roleViewWithPermissToRequestDto(item);
    const permissions = this.permissions();
    return this.dataService.addRole(req).pipe(
      map(dto => roleRespWithPermissDtoToViewWithPermiss(dto, permissions)));
  };

  updateItem = (item: RoleWithPermissionsInfo): Observable<RoleWithPermissionsInfo> => {
    const req = roleViewWithPermissToRequestDto(item);
    const permissions = this.permissions();
    return this.dataService.updateRole(item.id, req).pipe(
      map(dto => roleRespWithPermissDtoToViewWithPermiss(dto, permissions)));
  };

  deleteItem = (item: RoleWithPermissionsInfo): Observable<void> => {
    return this.dataService.deleteRole(item.id);
  };


  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  };

  callSelect = (item: RoleWithPermissionsInfo) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd = () => this.doAdd();
  callDelete(item: RoleWithPermissionsInfo) {
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить роль "${item.name}"?`).subscribe(confirmed => {
        if (confirmed) this.doDelete(item);
      });
    }
  }
  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  private doSelect = (item: RoleWithPermissionsInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };
  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());

  private doAdd(): void {
    const newItem = createEmptyRoleWithPermiss();
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }
  doUpdate = (item: RoleWithPermissionsInfo) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  private doDelete = (item: RoleWithPermissionsInfo) => this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<RoleWithPermissionsInfo>) => {
      if (result.success) {
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    };
    this.tableManager.doSaveBase(
      this.isSaving,
      (item) => this.addItem(item),
      (item) => this.updateItem(item),
      (item) => this.deleteItem(item),
      resApply
    );
  }
}