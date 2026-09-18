import { Injectable, signal, WritableSignal, computed, ElementRef, inject, Signal, Injector, DestroyRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';

import { combineLatest, Observable } from 'rxjs';
import { SaveDataResult, TableDataChanges } from '../models/table-data-items';
import {
  actualizeDataSourceItem,
  addDataSourceItem, addDeleteChangeToState, addModifyChangeToState, addNewChangeToState, applyFilters,
  clearFilterValues, deleteDataSourceItem, doSaveData, formatTableChanges, hasTableChanges,
  initFilterPredicate, ItemIdFn, newTableDataChanges, selectDataSourceItem,
  SelectFn, updateDataSourceItem
} from '../utils/table-manage-utils';
import { TableFilterInfo } from '../models/table-filter-items';
import { ActivatedRoute, Router } from '@angular/router';
import { addNotApplyItemFlag } from '../utils/object-utils';
import { handleError } from '@mon3/sa';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { SizeService } from './size.service';
import { TableActionsCallbacks, TableActionsInformerService } from './table-actions-informer.service';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

@Injectable() // Без providedIn, регистрируем в компоненте
export class TableManageService<T extends Record<string, any>> {
  private router = inject(Router);
  getRouter = () => this.router;
  private route = inject(ActivatedRoute);
  getRoute = () => this.route;
  private breakpointObserver = inject(BreakpointObserver);

  private sizeService = inject(SizeService);
  getSizeService = () => this.sizeService;

  // === Публичные сигналы ===
  readonly dataSource = new MatTableDataSource<T>([]);
  readonly dataState = signal<TableDataChanges>(newTableDataChanges());
  readonly totalCount = signal(0);
  readonly selectedItem = signal<T | undefined>(undefined);
  readonly expandedItem = signal<T | undefined>(undefined);
  readonly filterConfig = signal<Map<string, TableFilterInfo>>(new Map());
  readonly showFilter = signal(true);
  readonly error = signal<string | null>(null);
  readonly snackError = signal<string | null>(null);
  readonly doUpdateUrl = signal<boolean>(true);

  // === Вычисляемые сигналы ===
  readonly hasChanges = computed(() => hasTableChanges(this.dataState()));
  readonly changesSummary = computed(() => formatTableChanges(this.dataState()));

  // === Сигналы размеров ===
  isSmallScreen = this.sizeService.isSmallScreen;

  // Отслеживаем размер экрана
  breakpointsSubscribe = () => this.sizeService.breakpointsSubscribe();


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
    this.totalCount.set(data.length);
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
  handleUrlParams(idVal: string | undefined = undefined): void {
    if (!this.doUpdateUrl()) return;
    const idParam = idVal ?? this.route.snapshot.queryParamMap.get('id');
    if (idParam) {
      const item = this.dataSource.data.find(row => this.itemIdFn(row) === idParam);
      this.doSelectFn(item, true, item ? false : true, true);
    } else {
      this.doSelectFn(undefined, false, false);
    }
  }
  private updateUrlParams(id?: any): void {
    if (!this.doUpdateUrl()) return;
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
    //console.log(result)
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
  doAddBase(newItem: T, renderFn: (() => void) | undefined, markAsDettach: boolean = false,
    collapseOthers: boolean = false, onAddFn: (() => void) | undefined = undefined): void {
    this.selectedItem.set(undefined);
    this.expandedItem.set(undefined);
    const result = addDataSourceItem(this.dataSource.data, newItem, collapseOthers);
    if (result.added) {
      this.dataSource.data = result.data;
      this.totalCount.set(this.dataSource.data.length);
      if (renderFn) renderFn();
      this.dataState.update(state => addNewChangeToState(state, this.itemIdFn(newItem)));
      if (markAsDettach) result.fullItem = addNotApplyItemFlag(result.fullItem);
      this.selectedItem.set(result.fullItem);
      this.expandedItem.set(result.fullItem);
      if (onAddFn) onAddFn();
    }
  }

  // === Обновление ===
  doUpdateBase(item: T, renderFn: (() => void) | undefined, onUpdateFn: ((res: T) => void) | undefined = undefined): void {
    //console.log(item);
    const result = updateDataSourceItem(
      this.dataSource.data, item, this.itemIdFn, undefined, true);
    if (result.updated) {
      this.dataSource.data = result.data;
      this.totalCount.set(this.dataSource.data.length);
      if (renderFn) renderFn();
      this.dataState.update(state => addModifyChangeToState(state, this.itemIdFn(item)));
      if (onUpdateFn) onUpdateFn(item);
    }
  }

  // === Удаление ===
  doDeleteBase(item: T, renderFn: (() => void) | undefined, onDeleteFn: (() => void) | undefined = undefined): void {
    const result = deleteDataSourceItem(this.dataSource.data, item, this.itemIdFn);
    if (result.deleted) {
      this.dataSource.data = result.data;
      this.totalCount.set(this.dataSource.data.length);
      if (renderFn) renderFn();
      this.dataState.update(state => addDeleteChangeToState(state, item, this.itemIdFn));
      this.selectedItem.set(undefined);
      this.expandedItem.set(undefined);
      this.updateUrlParams();
      if (onDeleteFn) onDeleteFn();
    }
  }

  // === Сохранение изменений ===
  doSaveBase(isSaving: WritableSignal<boolean>,
    addFn: ((item: T) => Observable<T>) | undefined, updateFn: ((item: T) => Observable<T>) | undefined,
    deleteFn: ((item: T) => Observable<void>) | undefined,
    applyFn: (result: SaveDataResult<T>) => void
  ): void {
    isSaving.set(true);
    doSaveData(
      this.dataSource.data, this.itemIdFn, this.dataState(), addFn, updateFn, deleteFn).subscribe({
        next: result => {
          isSaving.set(false);
          this.dataSource.data = result.data;
          this.totalCount.set(this.dataSource.data.length);
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


  // === Обработка ошибок observable ====
  handleError<T>(message: string, ret: T, target?: WritableSignal<string | null>): (source: Observable<T>) => Observable<T> {
    return handleError<T>(message, ret, target ?? this.error)
  }

  // === Работа с TableActionsInformer
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private actionsInformer: TableActionsInformerService | null = null;


  /**
   * Подключает TableActionsInformerService.
   * Сервис сам подписывается на 5 команд informer'а, синхронизирует в него
   * hasChanges/canDelete/dataState и вызывает переданные callbacks.
   * Все диалоги, уведомления, HTTP и состояния isLoading/isSaving/totalCount
   * остаются в компоненте — TableManageService о них ничего не знает.
   */
  setActionsInformer(
    informer: TableActionsInformerService,
    callbacks: TableActionsCallbacks<T> = {}
  ): void {
    if (this.actionsInformer) return;
    this.actionsInformer = informer;

    // Синхронизация состояния таблицы в informer.
    // hasChanges / canDelete / dataState — это свойства самой таблицы,
    // поэтому их обновление входит в зону ответственности сервиса.
    combineLatest([
      toObservable(this.hasChanges, { injector: this.injector }),
      toObservable(this.selectedItem, { injector: this.injector }),
      toObservable(this.dataState, { injector: this.injector }),
      toObservable(this.totalCount, { injector: this.injector }),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([hasChanges, selected, dataState, total]) => {
        informer.hasChanges.set(hasChanges);
        informer.canDelete.set(!!selected);
        informer.dataState.set(dataState);
        informer.totalCount.set(total);
      });

    // Подписки на команды informer'а.
    informer.add$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => callbacks.onTriggerAdd?.());

    informer.delete$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => callbacks.onTriggerDelete?.());

    informer.refresh$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => callbacks.onTriggerRefresh?.());

    informer.save$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => callbacks.onTriggerSave?.());

    informer.reload$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => callbacks.onTriggerReload?.(id));
  }

}