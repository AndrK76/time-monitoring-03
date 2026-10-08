import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, input, OnInit, signal, untracked, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, TableActionsInformerService, TableFilterInfo, TableFilterListValue, TableFilterType, TableManageService,
} from '@mon3/sc';
import { processResponseError } from '@mon3/sa';

import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { MacroscopChannelView, MacroscopEvtAgentConfigView, MacroscopEvtPlaceView } from '../macroscop-view.models';
import { macroscopChannelDtoToView, macroscopChannelListDtoToView, macroscopEvtAgentConfigDtoToView, macroscopEvtPlaceDtoToView, macroscopEvtPlaceListDtoToView, macroscopEvtPlaceViewToDto } from '../macroscop-view.utils';
import { MacroscopEvtPlaceInplaceEditorComponent } from './macroscop-evt-place-inplace-editor/macroscop-evt-place-inplace-editor.component';

@Component({
  selector: 'app-macroscop-evt-place-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, MacroscopEvtPlaceInplaceEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './macroscop-evt-place-list.component.html',
  styleUrl: './macroscop-evt-place-list.component.scss'
})
export class MacroscopEvtPlaceListComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(MacroscopManageService);
  private readonly dialogService = inject(DialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly tableManager = inject(TableManageService<MacroscopEvtPlaceView>);
  private readonly destroyRef = inject(DestroyRef);

  agentId = input.required<string>();
  actions = input.required<TableActionsInformerService>();
  showDeleted = input<boolean>(false);
  canFullActions = input<boolean>(false);

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  totalCount = this.tableManager.totalCount;
  isSmallScreen = this.tableManager.isSmallScreen;

  evtConfig = signal<MacroscopEvtAgentConfigView | undefined>(undefined);
  allChannels = signal<MacroscopChannelView[]>([]);

  @ViewChild(MatTable) table!: MatTable<MacroscopEvtPlaceView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'used', 'name', 'channelName', 'internalName'];
  trackById = (index: number, item: MacroscopEvtPlaceView) => item.id;
  itemId = (item: MacroscopEvtPlaceView) => item.id;

  get isLoading() { return this.actions().isLoading; }
  get isSaving() { return this.actions().isSaving; }

  isLoadingScreenshot = signal(false);

  private currentAgentId = '';


  _yesNoSource: TableFilterListValue[] = [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }];
  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['used', { key: 'used', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource } }],
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['channelName', { key: 'channelName', type: TableFilterType.TEXT }],
    ['internalName', { key: 'internalName', type: TableFilterType.TEXT }],
  ]);

  constructor() {
    effect(() => {
      const id = this.agentId();
      const sd = this.showDeleted();
      if (!id) return;
      untracked(() => this.performLoad(id, sd));
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.tableManager.doUpdateUrl.set(false);
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.tableManager.setCanDeleteFn(this.canDeleteItem);

    this.showFilter.set(false);

    this.tableManager.setActionsInformer(this.actions(), {
      onTriggerAdd: () => this.callAdd(),
      onTriggerDelete: () => this.callDelete(),
      onTriggerRefresh: () => this.callRefresh(),
      onTriggerSave: () => this.callSave(),
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  private performLoad(agentId: string, showDeleted: boolean): void {
    const agentChanged = this.currentAgentId !== agentId;
    this.currentAgentId = agentId;
    if (agentChanged) {
      this.evtConfig.set(undefined);
      this.allChannels.set([]);
    }

    this.tableManager.doRefreshBase(() => this.loadData(agentId, showDeleted, agentChanged));
  }

  private loadData(agentId: string, showDeleted: boolean, agentChanged: boolean): void {
    this.isLoading.set(true);
    this.error.set(null);

    const ctx$ = agentChanged
      ? forkJoin({
        config: this.dataService.getEvtConfig(agentId).pipe(
          map(dto => macroscopEvtAgentConfigDtoToView(dto))),
        channels: this.dataService.getActualChannelsForEvtAgent(agentId).pipe(
          map(list => list.map(c => macroscopChannelListDtoToView(c)))),
      }).pipe(
        tap(ctx => {
          this.evtConfig.set(ctx.config);
          this.allChannels.set(ctx.channels);
        }),
        catchError(err => {
          const resError = processResponseError(err);
          this.notificationService.error(
            `Не удалось загрузить настройки агента Macroscop: ${resError.message}`);
          return of({ config: undefined, channels: [] as MacroscopChannelView[] });
        }),
      )
      : of({
        config: this.evtConfig(), channels: this.allChannels(),
      });

    ctx$.pipe(
      switchMap(ctx => this.dataService.getEvtPlacesForAgent(agentId, showDeleted).pipe(
        map(places => ({ ctx, places })),
      )),
      finalize(() => this.isLoading.set(false)),
    ).subscribe({
      next: ({ ctx, places }) => {
        this.tableManager.setData(
          places.map(dto => macroscopEvtPlaceListDtoToView(dto, ctx.channels)),
        );
        this.render();
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка загрузки списка мест: ${resError.message}`);
        this.tableManager.setData([]);
      },
    });
  }

  loadItem = (item: MacroscopEvtPlaceView): Observable<MacroscopEvtPlaceView | undefined> => {
    return this.dataService.getEvtPlace(item.id).pipe(
      map(dto => macroscopEvtPlaceDtoToView(dto, this.allChannels())),
    );
  };

  updateItem = (item: MacroscopEvtPlaceView): Observable<MacroscopEvtPlaceView> => {
    if (item.undeleted) {
      return this.dataService.restoreEvtPlace(item.id)
        .pipe(map(dto => macroscopEvtPlaceDtoToView(dto)));
    }
    const req = macroscopEvtPlaceViewToDto(item);
    return this.dataService.updateEvtPlace(item.id, req)
      .pipe(map(dto => macroscopEvtPlaceDtoToView(dto)));
  };

  deleteItem = (item: MacroscopEvtPlaceView): Observable<void> => {
    return this.dataService.deleteEvtPlace(item.id);
  };

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter(reset);

  private render = (): void => this.table?.renderRows();

  callSelect = (item: MacroscopEvtPlaceView) => this.doSelect(item, true);

  private callAdd(): void {
    //const newItem = createNewMacroscopEvtPlace();
    // Заглушка: добавление evt-мест будет реализовано иначе (например, подтягиванием из Macroscop).
    console.warn('[evt-place] Добавление мест пока не реализовано.', {
      agentId: this.currentAgentId,
      //draft: newItem,
    });
    this.notificationService.info('Добавление мест событий пока не реализовано');
  }

  callDelete(): void {
    const item = this.selectedItem();
    if (!item) return;
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить место "${item.name}"?`)
        .subscribe(confirmed => { if (confirmed) this.doDelete(item); });
    }
  }

  private callRefresh(): void {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.')
      .subscribe(confirmed => {
        if (confirmed) this.performLoad(this.agentId(), this.showDeleted());
      });
  }

  private callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  private canDeleteItem = (item: MacroscopEvtPlaceView | undefined): boolean => {
    if (!item) return false;
    if (this.canFullActions()) return true;
    return isNewItem(item);
  };

  private doSelect = (item: MacroscopEvtPlaceView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  doLoadedItem = (item: MacroscopEvtPlaceView | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  };

  doUpdate = (item: MacroscopEvtPlaceView) => {
    this.tableManager.doUpdateBase(item, () => this.render());
  };

  doRestoreDeleted = (item: MacroscopEvtPlaceView) => {
    item.undeleted = true;
    this.tableManager.doUpdateBase(item, () => this.render());
  };

  private doDelete = (item: MacroscopEvtPlaceView) => {
    this.tableManager.doDeleteBase(item, () => this.render());
  };

  isExpanded = (index: number, item: any): boolean => isExpanded(item);

  private doSave(): void {
    const resApply = (result: SaveDataResult<MacroscopEvtPlaceView>) => {
      if (result.success) {
        this.tableManager.dataSource.data = this.dataSource.data.map(p => {
          if (p.undeleted) {
            const { undeleted, ...rest } = p;
            return rest as MacroscopEvtPlaceView;
          }
          return p;
        });
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    };
    this.tableManager.doSaveBase(
      this.isSaving,
      undefined,                                // addItem — пока не реализуем
      (item) => this.updateItem(item),
      (item) => this.deleteItem(item),
      resApply
    );
  }

  /**
   * Заглушка для скриншотов evt-мест.
   * Когда решим реализовать — понадобится макроскопный id канала
   * (не путать с `channelId` из DTO, там DB-идентификатор), а также
   * привязанный configId агента. Сейчас просто логируем, чтобы
   * UI-поток кнопок был проверяем.
   */
  onCallGetChannelScreenShot(event: { mode: 'current' | 'archive'; place: MacroscopEvtPlaceView }): void {
    console.warn('[evt-place] Запрос скриншота пока не реализован.', {
      agentId: this.currentAgentId,
      mode: event.mode,
      place: event.place,
    });
    this.notificationService.info('Получение скриншотов для мест событий пока не реализовано');
  }
}