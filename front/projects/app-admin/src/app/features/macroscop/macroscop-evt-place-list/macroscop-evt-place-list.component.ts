import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, input, OnInit, signal, untracked, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, config, finalize, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  compareNullable,
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, ShowImageRectangle, TableActionsInformerService, TableFilterInfo, TableFilterListValue, TableFilterType, TableManageService,
} from '@mon3/sc';
import { processResponseError } from '@mon3/sa';

import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { MacroscopChannelView, MacroscopEvtAgentConfigView, MacroscopEvtPlaceView, MacroscopZoneInfoView } from '../macroscop-view.models';
import { macroscopChannelListDtoToView, macroscopEvtAgentConfigDtoToView, macroscopEvtPlaceDtoToView, macroscopEvtPlaceListDtoToView, macroscopEvtPlaceViewToDto } from '../macroscop-view.utils';
import { MacroscopEvtPlaceInplaceEditorComponent } from './macroscop-evt-place-inplace-editor/macroscop-evt-place-inplace-editor.component';
import { MatDialog } from '@angular/material/dialog';
import { MacroscopEvtPlaceAddDialogComponent, MacroscopEvtPlaceAddDialogData, MacroscopEvtPlaceAddDialogResult } from './macroscop-evt-place-add-dialog/macroscop-evt-place-add-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  private readonly matDialog = inject(MatDialog);

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
        const sorted = places
          .map(dto => macroscopEvtPlaceListDtoToView(dto, ctx.channels))
          .sort((a, b) =>
            compareNullable(a.name, b.name)
            || compareNullable(a.channelName, b.channelName)
            || compareNullable(a.channelId, b.channelId)
            || compareNullable(a.internalName, b.internalName)
            || compareNullable(a.internalId, b.internalId)
          );
        this.tableManager.setData(sorted);
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

  addItem = (item: MacroscopEvtPlaceView): Observable<MacroscopEvtPlaceView> => {
    const req = macroscopEvtPlaceViewToDto(item);
    //console.log(`add: ${JSON.stringify(req)}`)
    return this.dataService.addEvtPlaceByAgent(this.currentAgentId, req)
      .pipe(map(dto => macroscopEvtPlaceDtoToView(dto, this.allChannels())));
    //return of(req).pipe(map(dto => macroscopEvtPlaceDtoToView(dto, this.allChannels())))
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
    const cfg = this.evtConfig();
    const agentId = this.agentId();
    if (!cfg || !agentId) {
      this.notificationService.error('Не привязана конфигурация сервера Macroscop');
      return;
    }
    const channels = this.allChannels();
    if (channels.length === 0) {
      this.notificationService.error('Нет доступных каналов Macroscop');
      return;
    }

    this.matDialog.open<MacroscopEvtPlaceAddDialogComponent,
      MacroscopEvtPlaceAddDialogData,
      MacroscopEvtPlaceAddDialogResult>(
        MacroscopEvtPlaceAddDialogComponent,
        {
          width: '640px',
          maxWidth: '95vw',
          disableClose: true,
          data: {
            agentId,
            mode: cfg.mode,
            searchPlaceDepthInHours: cfg.searchPlaceDepthInHours ?? 24,
            channels,
          },
        },
      ).afterClosed().subscribe((result: MacroscopEvtPlaceAddDialogResult) => {
        if (!result) return;
        this.doAdd(result);
      });
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

  private doAdd(result: MacroscopEvtPlaceView[]): void {

    const zoneInfoEquals = (a: MacroscopZoneInfoView | undefined, b: MacroscopZoneInfoView | undefined,): boolean => {
      if (a === b) return true;
      if (!a || !b) return false;
      return a.left === b.left
        && a.top === b.top
        && a.width === b.width
        && a.height === b.height;
    }

    const macroscopChannelId = result[0].channelId;
    const channel = this.allChannels().find(c => c.macroscopId === macroscopChannelId);
    if (!channel || !channel.id) {
      this.notificationService.error(
        'Не удалось определить сохранённый канал Macroscop для результата поиска');
      return;
    }

    const savedChannelId = channel.id;
    const savedChannelName = channel.name ?? channel.macroscopId;

    const existing = this.dataSource.data.filter(p => p.channelId === savedChannelId);
    const existingByInternalId = new Map(existing.map(p => [p.internalId, p] as const));
    const resultByInternalId = new Map(result.map(p => [p.internalId, p] as const));

    // 1. Существующие, которые найдены заново — обновляем internalName и zoneInfo при расхождении
    existing.forEach(item => {
      const found = resultByInternalId.get(item.internalId);
      if (!found) return;

      const internalNameChanged = item.internalName !== found.internalName;
      const zoneChanged = !zoneInfoEquals(item.zoneInfo, found.zoneInfo);
      if (!internalNameChanged && !zoneChanged) return;

      this.tableManager.doUpdateBase(
        {
          ...item,
          internalName: found.internalName,
          zoneInfo: found.zoneInfo,
        },
        () => this.render(),
      );
    });

    // 2. Найденные, которых нет у нас — добавляем
    result.forEach(found => {
      if (existingByInternalId.has(found.internalId)) return;
      const newItem: MacroscopEvtPlaceView = {
        ...found,
        id: 'temp-' + found.internalId,
        channelId: savedChannelId,
        channelName: savedChannelName,
        used: true,
      };
      this.tableManager.doAddBase(newItem, () => this.render(), false, true);
    });
    // 3. Существующие, которых не нашли — present = false
    existing.forEach(item => {
      if (resultByInternalId.has(item.internalId)) return;
      if (!item.present) return;

      this.tableManager.doUpdateBase(
        { ...item, present: false, actual: false },
        () => this.render(),
      );
    });

    this.render();
  }

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
      (item) => this.addItem(item),
      (item) => this.updateItem(item),
      (item) => this.deleteItem(item),
      resApply
    );
  }

  onCallGetChannelScreenShot(event: { mode: 'current' | 'archive'; place: MacroscopEvtPlaceView }): void {
    const configId = this.evtConfig()?.config?.id;
    const channelId = this.allChannels().find(c => c.id === event.place.channelId)?.macroscopId;
    if (!configId) {
      this.notificationService.warning('Не определена конфигурация Macroscop');
      return;
    }
    if (!channelId) {
      this.notificationService.warning('Не указан канал Macroscop');
      return;
    }
    this.isLoadingScreenshot.set(true);
    this.dataService.getCurrentScreenshot(configId, channelId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.isLoadingScreenshot.set(false)),
    ).subscribe(result => {
      if (result.success && result.data) {
        const zone: ShowImageRectangle | undefined = event.place.zoneInfo ? {
          left: event.place.zoneInfo.left ?? 0,
          top: event.place.zoneInfo.top ?? 0,
          width: event.place.zoneInfo.width ?? 0,
          height: event.place.zoneInfo.height ?? 0,
        } : undefined;
        this.dialogService.showImage(
          result.data, event.place.name ?? 'Фото', { greenRectangle: zone }
        );
      } else {
        this.notificationService.error(
          result.errorMessage ?? 'Не удалось получить фото',
        );
      }
    });
  }
}