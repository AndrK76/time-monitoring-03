import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSort, MatSortModule } from '@angular/material/sort';
import {
  FilterRootComponent, TableManageService, DialogService, NotificationService, TableFilterInfo,
  TableFilterType, isExpanded, SaveDataResult, isNewItem
} from '@mon3/sc';
import { UserManageService, UserListItemDto, AdminAuthService } from '@mon3/sa';
import { OrganizationEditorInplaceComponent } from '../organization-editor-inplace/organization-editor-inplace.component';
import { finalize, forkJoin, map, Observable, tap } from 'rxjs';
import { OrganizationInfo } from '../organization-view.models';
import {
  createEmptyOrganization, organizationItemDtoToView, organizationListDtoToView,
  organizationViewToItemDto, organizationViewToListItem
} from '../organization-view.utils';
import { UserShortInfo } from '../../users/user-view.models';
import { userListDtoToShortView } from '../../users/user-view.utils';

@Component({
  selector: 'app-organization-list-table',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule,
    MatTooltipModule, MatSortModule,
    FilterRootComponent, OrganizationEditorInplaceComponent,
  ],
  providers: [TableManageService],
  templateUrl: './organization-list-table.component.html',
  styleUrl: './organization-list-table.component.scss'
})
export class OrganizationListTableComponent implements OnInit, AfterViewInit {
  private dataService = inject(AdminAuthService);
  //private userService = inject(UserManageService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<OrganizationInfo>);

  // Данные
  users = signal<UserShortInfo[]>([]);

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<OrganizationInfo>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'shortName', 'fullName'];
  trackById = (index: number, item: OrganizationInfo) => item.id;
  itemId = (item: OrganizationInfo) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  // Фильтры
  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['shortName', { key: 'shortName', type: TableFilterType.TEXT }],
    ['fullName', { key: 'fullName', type: TableFilterType.TEXT }],
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
      users: this.dataService.getUsersList().pipe(
        map(list => list.map(dto => userListDtoToShortView(dto))),
        this.tableManager.handleError<UserShortInfo[]>('Ошибка загрузки пользователей', []),
      )
    }).subscribe({
      next: (result) => {
        const { users } = result as { users: UserShortInfo[]; };
        this.users.set(users);
        this.loadData();
      },
      error: () => this.isLoading.set(false)
    });
  };

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);
    const users = this.users();

    this.dataService.getOrganizations()
      .pipe(
        map(list => list.map(dto => organizationListDtoToView(dto))),
        this.tableManager.handleError<OrganizationInfo[]>('Ошибка загрузки организаций', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          const rows = result as OrganizationInfo[];
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
  };

  loadItem = (item: OrganizationInfo): Observable<OrganizationInfo | undefined> => {
    const users = this.users();
    this.tableManager.snackError.set(null);
    return this.dataService.getOrganization(item.id).pipe(
      map(dto => organizationItemDtoToView(dto, users)),
      this.tableManager.handleError<OrganizationInfo | undefined>('Ошибка загрузки информации об организации',
        undefined, this.tableManager.snackError),
      tap(_ => {
        const err = this.tableManager.snackError();
        if (err) {
          this.notificationService.error(err);
          this.tableManager.snackError.set(null);
        }

      })
    );
  }

  addItem = (item: OrganizationInfo): Observable<OrganizationInfo> => {
    const req = organizationViewToListItem(item);
    return this.dataService.addOrganization(req).pipe(
      map(dto => organizationListDtoToView(dto))
    );
  };
  updateItem = (item: OrganizationInfo): Observable<OrganizationInfo> => {
    const req = organizationViewToItemDto(item);
    return this.dataService.updateOrganization(item.id, req).pipe(
      map(dto => organizationItemDtoToView(dto, this.users()))
    );
  };
  deleteItem = (item: OrganizationInfo): Observable<void> => {
    return this.dataService.deleteOrganization(item.id);
  };

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  };

  callSelect = (item: OrganizationInfo) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd = () => this.doAdd();
  callDelete(item: OrganizationInfo) {
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить организацию "${item.shortName}"?`).subscribe(confirmed => {
        if (confirmed) this.doDelete(item);
      });
    }
  }
  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  private doSelect = (item: OrganizationInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };
  doLoadedItem = (item: OrganizationInfo | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  }

  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());

  private doAdd(): void {
    const newItem = createEmptyOrganization();
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }
  doUpdate = (item: OrganizationInfo) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  private doDelete = (item: OrganizationInfo) => this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<OrganizationInfo>) => {
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