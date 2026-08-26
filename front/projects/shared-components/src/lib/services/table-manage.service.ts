import { Injectable, signal, WritableSignal, computed, ElementRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';

import { Observable } from 'rxjs';
import { TableDataChanges } from '../models/table-data-items';
import { addDataSourceItem, addDeleteChangeToState, addModifyChangeToState, addNewChangeToState, applyFilters, 
  clearFilterValues, deleteDataSourceItem, doSaveData, formatTableChanges, hasTableChanges, 
  initFilterPredicate, newTableDataChanges, selectDataSourceItem, 
  updateDataSourceItem, updateFilterConfig } from '../utils/table-manage-utils';
import { TableFilterInfo } from '../models/table-filter-items';

@Injectable() // Без providedIn, регистрируем в компоненте
export class TableManageService<T extends Record<string, any>> {
  // === Публичные сигналы ===
  readonly dataSource = new MatTableDataSource<T>([]);
  readonly dataState = signal<TableDataChanges>(newTableDataChanges());
  readonly selectedItem = signal<T | undefined>(undefined);
  readonly filterConfig = signal<Map<string, TableFilterInfo>>(new Map());
  readonly showFilter = signal(false);

  // === Вычисляемые сигналы ===
  readonly hasChanges = computed(() => hasTableChanges(this.dataState()));
  readonly changesSummary = computed(() => formatTableChanges(this.dataState()));

  // === Ссылка на DOM-контейнер таблицы (для прокрутки) ===
  private tableWrapperRef: ElementRef<HTMLDivElement> | null = null;

  // === Инициализация фильтрации ===
  initFilterPredicate(): void {
    initFilterPredicate(this.dataSource, () => this.filterConfig());
  }

  // === Установка обёртки для прокрутки ===
  setTableWrapper(wrapper: ElementRef<HTMLDivElement>): void {
    this.tableWrapperRef = wrapper;
  }

  // === Прокрутка к элементу по ID ===
  scrollToItem(idGetter: (item: T) => string | number, id: string | number): void {
    if (!this.tableWrapperRef) return;
    const rowElement = this.tableWrapperRef.nativeElement.querySelector(`tr[data-id="${id}"]`);
    if (rowElement) {
      requestAnimationFrame(() => {
        rowElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  }

  // === Управление фильтрами ===
  toggleFilter(reset?: boolean): void {
    if (reset) this.showFilter.set(false);
    else this.showFilter.update(v => !v);
    if (!this.showFilter()) {
      this.filterConfig.update(map => clearFilterValues(map));
      applyFilters(this.dataSource);
    }
  }

  updateFilter(key: string, value: any): void {
    this.filterConfig.update(map => updateFilterConfig(map, key, value));
    applyFilters(this.dataSource);
  }

  clearFilters(): void {
    this.filterConfig.update(map => clearFilterValues(map));
    applyFilters(this.dataSource);
  }

  // === Выбор элемента ===
  selectItem(
    item: T | undefined,
    expanded: boolean,
    collapseOthers: boolean = true,
    idGetter: (item: T) => string | number,
    ignoreKeys?: string[]
  ): { selected: boolean; id?: string | number } {
    const result = selectDataSourceItem(
      this.dataSource.data,
      item,
      idGetter,
      expanded,
      collapseOthers,
      ignoreKeys
    );
    this.selectedItem.set(undefined);
    let id: string | number | undefined;
    if (result.selected) {
      this.dataSource.data = result.data;
      this.selectedItem.set(item);
      if (item && expanded) id = idGetter(item);
    }
    return { selected: result.selected, id };
  }

  // === Добавление ===
  addItem(
    newItem: T,
    idGetter: (item: T) => string | number,
    ignoreKeys?: string[]
  ): { added: boolean; id?: string | number } {
    const result = addDataSourceItem(this.dataSource.data, newItem, ignoreKeys);
    if (result.added) {
      this.dataSource.data = result.data;
      this.dataState.update(state => addNewChangeToState(state, idGetter(newItem) as string));
      this.selectedItem.set(newItem);
      return { added: true, id: idGetter(newItem) };
    }
    return { added: false };
  }

  // === Обновление ===
  updateItem(
    updatedItem: T,
    idGetter: (item: T) => string | number,
    ignoreKeys?: string[],
    applyChangesToOrig?: boolean
  ): { updated: boolean } {
    const result = updateDataSourceItem(
      this.dataSource.data,
      updatedItem,
      idGetter,
      ignoreKeys,
      applyChangesToOrig
    );
    if (result.updated) {
      this.dataSource.data = result.data;
      this.dataState.update(state => addModifyChangeToState(state, idGetter(updatedItem) as string));
    }
    return { updated: result.updated };
  }

  // === Удаление ===
  deleteItem(
    item: T,
    idGetter: (item: T) => string | number
  ): { deleted: boolean } {
    const result = deleteDataSourceItem(this.dataSource.data, item, idGetter);
    if (result.deleted) {
      this.dataSource.data = result.data;
      this.dataState.update(state => addDeleteChangeToState(state, item, idGetter));
      this.selectedItem.set(undefined);
    }
    return { deleted: result.deleted };
  }

  // === Сохранение изменений ===
  saveChanges(
    idGetter: (item: T) => string | number,
    addFn: (item: T) => Observable<T>,
    updateFn: (item: T) => Observable<T>,
    deleteFn: (item: T) => Observable<void>
  ): Observable<{ data: T[]; changes: TableDataChanges; success: boolean; errors: any[] }> {
    return doSaveData(
      this.dataSource.data,
      idGetter,
      this.dataState(),
      addFn,
      updateFn,
      deleteFn
    );
  }

  // === Сброс состояния (после сохранения или обновления) ===
  resetState(data: T[]): void {
    this.dataSource.data = data;
    this.dataState.set(newTableDataChanges());
    this.selectedItem.set(undefined);
  }

  // === Замена данных (при загрузке) ===
  setData(data: T[]): void {
    this.dataSource.data = data;
    applyFilters(this.dataSource);
  }
}