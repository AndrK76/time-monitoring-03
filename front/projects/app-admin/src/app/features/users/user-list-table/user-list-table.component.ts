import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { UsermanageService } from '@mon3/sa';
import { AuthService } from '@mon3/shared-test';
import { RoleInfo, UserInfo } from '../user-view.models';
import { DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService, SaveDataResult, TableFilterInfo, TableFilterType, TableManageService } from '@mon3/sc';
import { finalize, forkJoin, map } from 'rxjs';
import { createEmptyUser, userDtoToView } from '../user-view.utils';
import { CommonModule } from '@angular/common';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSort, MatSortModule } from '@angular/material/sort';

@Component({
  selector: 'app-user-list-table',
  standalone: true,
  imports: [CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    //EventsEditorInplaceComponent,
    MatTooltipModule,
    MatSortModule,
    FilterRootComponent],
  providers: [TableManageService],
  templateUrl: './user-list-table.component.html',
  styleUrl: './user-list-table.component.scss'
})
export class UserListTableComponent implements OnInit, AfterViewInit {
  authService = inject(AuthService);
  dataService = inject(UsermanageService);

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

  displayedColumns = ['expand', 'username', 'displayName'];
  trackById = (index: number, item: UserInfo) => item.id;
  itemId = (item: UserInfo) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  _filterConfig: Map<string, TableFilterInfo> = new Map<string, TableFilterInfo>([
    ['username', { key: 'username', type: TableFilterType.TEXT }],
    ['displayName', { key: 'displayName', type: TableFilterType.TEXT }],
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

  initializeData() {
    this.isLoading.set(false);
    this.error.set(null);

    forkJoin({
      roles: this.dataService.getAllRoles()
        .pipe(
          this.tableManager.handleError('Ошибка загрузки списка ролей'),
        ),
    }).subscribe({
      next: (result) => {

        this.loadData();
      },
      error: () => {
        this.isLoading.set(false);
      }
    })
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getUsersList()
      .pipe(
        map(list => list.map(userDtoToView)),
        this.tableManager.handleError('Ошибка загрузки пользователей'),
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

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);

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
    } else {
      this.dialogService.confirm(`Удалить пользователя ${item.username}?`).subscribe(confirmed => {
        if (confirmed) this.doDelete(item)
      });
    }
  }
  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }


  private doSelect = (item: UserInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo);
  }
  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());
  private doAdd(): void {
    const newItem = createEmptyUser();
    this.tableManager.doAddBase(newItem, () => this.table.renderRows());
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
    /*this.tableManager.doSaveBase(this.isSaving,
      (item: EventRow) => this.dataService.addEventRow(item),
      (item: EventRow) => this.dataService.updateEventRow(item),
      (item: EventRow) => this.dataService.removeEventRow(item),
      resApply);*/
  }

}
