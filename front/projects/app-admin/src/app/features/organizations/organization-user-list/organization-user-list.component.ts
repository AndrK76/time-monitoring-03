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
import { FilterRootComponent, TableManageService, TableFilterInfo, TableFilterType, initFilterPredicate, applyFilters } from '@mon3/sc';

@Component({
  selector: 'app-organization-user-list',
  standalone: true,
  imports: [
    CommonModule,
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
  // Входные данные: текущие пользователи организации (уже выбранные) и все доступные пользователи
  users = input.required<UserShortInfo[]>();
  allUsers = input.required<UserShortInfo[]>();

  // Выход: массив ID выбранных пользователей
  selectedUserIds = output<string[]>();

  private tableManager = inject(TableManageService<{ selectedUserId: string }>);

  dataSource = this.tableManager.dataSource;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;

  @ViewChild(MatTable) table!: MatTable<{ selectedUserId: string }>;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['select', 'displayName', 'username'];
  selectedRow = signal<{ selectedUserId: string } | null>(null);

  // Внутренний список строк (каждая строка – это выбранный пользователь)
  rows = signal<{ selectedUserId: string }[]>([]);

  private isInternalChange = false;

  constructor() {
    effect(() => {
      const userList = this.users();
      const currentIds = this.rows().map(r => r.selectedUserId);
      const newIds = userList.map(u => u.id);

      // Если списки совпадают, не обновляем
      if (currentIds.length === newIds.length && currentIds.every((id, i) => id === newIds[i])) {
        return;
      }

      // Обновляем rows только если изменилось
      this.rows.set(userList.map(u => ({ selectedUserId: u.id })));
      this.updateDataSource();

      // Сбрасываем флаг, чтобы предотвратить эмит при синхронизации
      this.isInternalChange = false;
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Настройка фильтров
    this.filterConfig.set(new Map([
      ['displayName', { key: 'displayName', type: TableFilterType.TEXT }],
      ['username', { key: 'username', type: TableFilterType.TEXT }]
    ]));
    this.tableManager.setItemIdFn((row: any) => row.selectedUserId);
    this.tableManager.initFilterPredicate();
    // Инициализируем данные
    this.updateDataSource();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  private updateDataSource(): void {
    this.tableManager.setData(this.rows());
  }

  // Добавить новую пустую строку
  addRow(): void {
    const newRow = { selectedUserId: '' };
    this.rows.update(rows => [...rows, newRow]);
    this.updateDataSource();
    this.selectedRow.set(newRow);
    this.emitChanges();
  }

  // Удалить выбранную строку
  removeSelected(): void {
    const selected = this.selectedRow();
    if (!selected) return;
    this.rows.update(rows => rows.filter(row => row !== selected));
    this.updateDataSource();
    this.selectedRow.set(null);
    this.emitChanges();
  }

  // Выбор строки
  selectRow(row: any): void {
    this.selectedRow.set(row);
  }

  // При изменении выбора пользователя в строке
  onUserChange(row: any): void {
    const selectedId = row.selectedUserId;
    if (selectedId) {
      // Проверяем дубликат
      const isDuplicate = this.rows().some(r => r !== row && r.selectedUserId === selectedId);
      if (isDuplicate) {
        row.selectedUserId = '';
        alert('Этот пользователь уже добавлен в организацию');
        return;
      }
    }
    this.updateDataSource();
    this.emitChanges();
  }

  // Доступные пользователи для выбора в конкретной строке
  availableUsersForRow(row: any): UserShortInfo[] {
    const selectedIds = this.rows()
      .filter(r => r !== row && r.selectedUserId)
      .map(r => r.selectedUserId);
    const all = this.allUsers();
    const currentId = row.selectedUserId;
    return all.filter(u => !selectedIds.includes(u.id) || u.id === currentId);
  }

  // Получить username по ID
  getUsername(userId: string): string {
    if (!userId) return '';
    const user = this.allUsers().find(u => u.id === userId);
    return user ? user.username : '';
  }

  // Обработка изменения фильтра
  onFilterChange(val: TableFilterInfo) {
    this.tableManager.onFilterChange(val);
  }

  private emitChanges(): void {
    // Если изменение пришло извне (из эффекта), не эмитим
    if (this.isInternalChange) {
      this.isInternalChange = false;
      return;
    }
    const ids = this.rows().map(r => r.selectedUserId).filter(id => id);
    this.selectedUserIds.emit(ids);
  }
}