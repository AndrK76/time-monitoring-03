import { Injectable, signal, WritableSignal, computed, ElementRef, inject, Signal } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';

import { catchError, Observable, of } from 'rxjs';
import { SaveDataResult, TableDataChanges } from '../models/table-data-items';
import {
  actualizeDataSourceItem,
  addDataSourceItem, addDeleteChangeToState, addModifyChangeToState, addNewChangeToState, applyFilters,
  clearFilterValues, deleteDataSourceItem, doSaveData, formatTableChanges, hasTableChanges,
  initFilterPredicate, ItemIdFn, newTableDataChanges, selectDataSourceItem,
  SelectFn,
  updateDataSourceItem, updateFilterConfig
} from '../utils/table-manage-utils';
import { TableFilterInfo } from '../models/table-filter-items';
import { ActivatedRoute, Router } from '@angular/router';
import { addNotApplyItemFlag } from '../utils/object-utils';

@Injectable() // Без providedIn, регистрируем в компоненте
export class TableManageService<T extends Record<string, any>> {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // === Публичные сигналы ===
  readonly dataSource = new MatTableDataSource<T>([]);
  readonly dataState = signal<TableDataChanges>(newTableDataChanges());
  readonly selectedItem = signal<T | undefined>(undefined);
  readonly expandedItem = signal<T | undefined>(undefined);
  readonly filterConfig = signal<Map<string, TableFilterInfo>>(new Map());
  readonly showFilter = signal(true);
  readonly error = signal<string | null>(null);
  readonly snackError = signal<string | null>(null);

  // === Вычисляемые сигналы ===
  readonly hasChanges = computed(() => hasTableChanges(this.dataState()));
  readonly changesSummary = computed(() => formatTableChanges(this.dataState()));



  // === Функция выбора строки ===
  private doSelectFn!: SelectFn<T>;
  setSelectFn(fn: SelectFn<T>): void {
    this.doSelectFn = fn;
  }

  // === Ссылка на DOM-контейнер таблицы (для прокрутки) ===
  private tableWrapperRef: ElementRef<HTMLDivElement> | null = null;
  setTableWrapper = (wrapper: ElementRef<HTMLDivElement>) => this.tableWrapperRef = wrapper;

  private itemIdFn!: ItemIdFn<T>;
  setItemIdFn = (fn: ItemIdFn<T>) => this.itemIdFn = fn;


  // === Установка данных ===
  setData(data: T[]): void {
    this.dataSource.data = data;
    applyFilters(this.dataSource);
  }

  // === Инициализация фильтрации ===
  initFilterPredicate(): void {
    initFilterPredicate(this.dataSource, () => this.filterConfig());
  }

  // === Прокрутка к элементу по ID ===
  scrollToItemId(itemId?: any): void {
    if (!itemId) return;
    requestAnimationFrame(() => {
      const rowElement = this.tableWrapperRef!.nativeElement.querySelector(`tr[data-id="${itemId}"]`);
      //console.log(this.tableWrapperRef?.nativeElement.innerHTML);
      if (rowElement) {
        //console.log(rowElement.innerHTML);
        rowElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }


  // === Управление фильтрами ===
  onFilterChange(val: TableFilterInfo) {
    this.filterConfig.update(v => {
      const newVal: TableFilterInfo = { ...v.get(val.key)!, value: val.value };
      v.set(val.key, newVal);
      return v;
    });
    applyFilters(this.dataSource);
  }
  toggleFilter(reset?: boolean): void {
    if (reset) this.showFilter.set(false);
    else this.showFilter.update(v => !v);
    if (!this.showFilter()) {
      this.filterConfig.update(map => clearFilterValues(map));
      applyFilters(this.dataSource);
    }
  }

  //Работа с Url
  handleUrlParams(): void {
    const idParam = this.route.snapshot.queryParamMap.get('id');
    if (idParam) {
      const item = this.dataSource.data.find(row => this.itemIdFn(row) === idParam);
      this.doSelectFn(item, true, item ? false : true, true);
    } else {
      this.doSelectFn(undefined, false, false);
    }
  }
  private updateUrlParams(id?: any): void {
    const _id: string | null = id ? `${id}` : null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: _id },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // === Выбор элемента ===
  doSelectBaseWithCollapse(item: T | undefined, newState: boolean, renderFn: (() => void) | undefined,
    updateUrl: boolean = true, scrollTo: boolean = false, needFill: boolean = false,
    onSetFn: (() => void) | undefined) {
    this._doSelectBase(item, newState, renderFn, updateUrl, scrollTo, true, needFill, onSetFn);
  }

  doSelectBaseWithoutCollapse(item: T | undefined, newState: boolean, renderFn: (() => void) | undefined,
    updateUrl: boolean = true, scrollTo: boolean = false, needFill: boolean = false,
    onSetFn: (() => void) | undefined,) {
    this._doSelectBase(item, newState, renderFn, updateUrl, scrollTo, false, needFill, onSetFn);
  }

  private _doSelectBase(item: T | undefined, newState: boolean, renderFn: (() => void) | undefined,
    updateUrl: boolean, scrollTo: boolean, collapseOthers: boolean, needFill: boolean,
    onSetFn: (() => void) | undefined) {
    const result = selectDataSourceItem(this.dataSource.data, item, this.itemIdFn, newState, collapseOthers, needFill);
    this.selectedItem.set(undefined);
    this.expandedItem.set(undefined);
    let _id: string | undefined = undefined;
    if (result.selected) {
      this.dataSource.data = result.data;
      if (newState) { this.selectedItem.set(result.item); this.expandedItem.set(result.item); }
      if (item && newState) _id = this.itemIdFn(item);
      if (onSetFn) onSetFn();
    }
    if (updateUrl) this.updateUrlParams(_id);
    if (renderFn) renderFn();
    if (scrollTo && _id) this.scrollToItemId(_id);
  }

  doAfterLoadItem(item: T | undefined, renderFn: (() => void) | undefined) {
    //console.log(item);
    const result = actualizeDataSourceItem(this.dataSource.data, this.expandedItem(), item, this.itemIdFn);
    if (result.actualized) {
      this.dataSource.data = result.data;
      this.selectedItem.set(result.item);
      this.expandedItem.set(result.item);
    }
  }


  //Выпонение обновления данных
  doRefreshBase(loadEventsFn: () => void): void {
    this.updateUrlParams();
    loadEventsFn();
    this.dataState.set(newTableDataChanges());
    this.selectedItem.set(undefined);
    this.expandedItem.set(undefined);
  }

  // === Добавление ===
  doAddBase(newItem: T, renderFn: () => void, markAsDettach: boolean = false, collapseOthers: boolean = false): void {
    this.selectedItem.set(undefined);
    this.expandedItem.set(undefined);
    const result = addDataSourceItem(this.dataSource.data, newItem, collapseOthers);
    if (result.added) {
      this.dataSource.data = result.data;
      if (renderFn) renderFn();
      this.dataState.update(state => addNewChangeToState(state, this.itemIdFn(newItem)));
      if (markAsDettach) result.fullItem = addNotApplyItemFlag(result.fullItem);
      this.selectedItem.set(result.fullItem);
      this.expandedItem.set(result.fullItem);
    }
  }

  // === Обновление ===
  doUpdateBase(item: T, renderFn: () => void): void {
    //console.log(item);
    const result = updateDataSourceItem(
      this.dataSource.data, item, this.itemIdFn, undefined, true);
    if (result.updated) {
      this.dataSource.data = result.data;
      if (renderFn) renderFn();
      this.dataState.update(state => addModifyChangeToState(state, this.itemIdFn(item)));
    }
  }

  // === Удаление ===
  doDeleteBase(item: T, renderFn: () => void): void {
    const result = deleteDataSourceItem(this.dataSource.data, item, this.itemIdFn);
    if (result.deleted) {
      this.dataSource.data = result.data;
      if (renderFn) renderFn();
      this.dataState.update(state => addDeleteChangeToState(state, item, this.itemIdFn));
      this.selectedItem.set(undefined);
      this.expandedItem.set(undefined);
      this.updateUrlParams();
    }
  }

  // === Сохранение изменений ===
  doSaveBase(isSaving: WritableSignal<boolean>,
    addFn: (item: T) => Observable<T>, updateFn: (item: T) => Observable<T>, deleteFn: (item: T) => Observable<void>,
    applyFn: (result: SaveDataResult<T>) => void
  ): void {
    isSaving.set(true);
    doSaveData(
      this.dataSource.data, this.itemIdFn, this.dataState(), addFn, updateFn, deleteFn).subscribe({
        next: result => {
          isSaving.set(false);
          this.dataSource.data = result.data;
          this.dataState.set(result.changes);
          applyFn(result);
        },
        error: err => {
          isSaving.set(false);
          console.error('Неожиданная ошибка:', err);
          this.error.set('Не удалось сохранить изменения');
        }
      })
  }

  handleError<T>(message: string, ret: T, target?: WritableSignal<string | null>): (source: Observable<T>) => Observable<T> {
    return catchError((err: any) => {
      console.error(err);
      (target ?? this.error).set(message);
      return of(ret);
    });
  }

}