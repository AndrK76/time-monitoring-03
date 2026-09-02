import { Component, input, output, signal, computed, inject, OnInit, effect, ViewChild, ElementRef, AfterViewInit, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { UserShortInfo } from '../../users/user-view.models';
import { FilterRootComponent, TableManageService, TableFilterInfo, TableFilterType, initFilterPredicate, applyFilters, isExpanded, isNewItem, DialogService, NotificationService } from '@mon3/sc';
import { MatCardModule } from '@angular/material/card';


@Component({
  selector: 'app-organization-user-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatRadioModule,
    FormsModule,
    MatSortModule,
    FilterRootComponent
  ],
  providers: [TableManageService],
  templateUrl: './organization-user-list.component.html',
  styleUrls: ['./organization-user-list.component.scss']
})
export class OrganizationUserListComponent implements OnInit, AfterViewInit {
  private tableManager = inject(TableManageService<UserShortInfo>);
  private dialogService = inject(DialogService);

  usersData = input.required<UserShortInfo[]>();
  users = input.required<UserShortInfo[]>();
  onSelect = output<UserShortInfo | undefined>();
  canAddChanged = output<boolean>();
  newData = output<UserShortInfo[]>();

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<{ selectedUserId: string }>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'displayName', 'username'];
  trackById = (index: number, item: UserShortInfo) => item.id;
  itemId = (item: UserShortInfo) => {
    return (item as any)._id ?? item.id;
  };

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['displayName', { key: 'displayName', type: TableFilterType.TEXT }],
    ['username', { key: 'username', type: TableFilterType.TEXT }]
  ]);

  avaibleUsers = signal<UserShortInfo[]>([]);
  canAddUsers = signal<boolean>(false);


  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.tableManager.doUpdateUrl.set(false);
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.tableManager.setData(this.usersData().map(v => {
      return { ...v, _id: v.id }
    }));
    this.showFilter.set(false);
    this.onChangeCurrent();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();

  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  };
  callSelect = (item: UserShortInfo) => this.doSelect(item, true);
  callAdd = () => this.doAdd();
  callDelete(item: UserShortInfo | undefined) {
    if (!item) return;
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить доступ для "${item.displayName}"?`).subscribe(confirmed => {
        if (confirmed) this.doDelete(item);
      });
    }
  }

  private doSelect = (item: UserShortInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, this.onChangeCurrent);
  };
  private doAdd(): void {
    if (this.canAddUsers()) {
      let newItem: any = (this.avaibleUsers().at(0)?.id === this.selectedItem()?.id) ? this.avaibleUsers().at(1) : this.avaibleUsers().at(0);
      if (newItem) {
        newItem = { ...newItem, _id: newItem.id }
        this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true, this.onChangeCurrent);
      }
    }
  }
  doUpdate = (item: UserShortInfo) => {
    const afterUpdate = (val: UserShortInfo) => {
      this.selectedItem.set(val);
      this.onChangeCurrent();
    }
    this.tableManager.doUpdateBase(item, () => this.table.renderRows(), afterUpdate);
  }
  private doDelete = (item: UserShortInfo) => {
    this.tableManager.doDeleteBase(item, () => this.table.renderRows(), this.onChangeCurrent);
  }


  private onChangeCurrent = () => {
    const calculateAvaible = () => {
      const allUsers = this.users();
      const selectedUsers = this.dataSource.data;
      const currentSelected = this.selectedItem();
      const selectedIds = new Set(selectedUsers.map(u => u.id));
      this.avaibleUsers.set(
        allUsers.filter(user => {
          if (selectedIds.has(user.id)) {
            return currentSelected ? user.id === currentSelected.id : false;
          }
          return true;
        }));
    }

    this.onSelect.emit(this.selectedItem());
    calculateAvaible();
    this.canAddUsers.set(((this.avaibleUsers().length > 1) || ((this.avaibleUsers().length === 1) && !this.selectedItem())));
    this.canAddChanged.emit(this.canAddUsers());
    this.newData.emit(this.dataSource.data);
  }

  onChangeSelectedUser = (item: any) => {
    const newUser = this.avaibleUsers().find(f => f.id === item.value);
    if (newUser) {
      (newUser as any)._id = (this.selectedItem() as any)._id;
      this.doUpdate(newUser);
    }
  }
}


