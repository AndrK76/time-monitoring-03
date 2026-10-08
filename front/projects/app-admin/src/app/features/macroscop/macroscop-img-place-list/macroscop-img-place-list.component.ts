import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, input, OnInit, signal, untracked, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, forkJoin, map, Observable, of } from 'rxjs';
import {
  DialogService, FilterRootComponent, isExpanded, isNewItem, MacroscopChannelListDto, NotificationService,
  SaveDataResult, TableActionsInformerService, TableFilterInfo, TableFilterListValue, TableFilterType, TableManageService,
} from '@mon3/sc';
import { processResponseError } from '@mon3/sa';

import { MacroscopManageService } from '../../../services/macroscop-manage.service';

import { MacroscopImgPlaceInplaceEditorComponent } from './macroscop-img-place-inplace-editor/macroscop-img-place-inplace-editor.component';
import { MacroscopImgPlaceView } from '../macroscop-view.models';
import { createNewMacroscopPlace, macroscopImgPlaceDtoToView, macroscopImgPlaceListDtoToView, macroscopImgPlaceViewToDto } from '../macroscop-view.utils';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-macroscop-img-place-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, MacroscopImgPlaceInplaceEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './macroscop-img-place-list.component.html',
  styleUrl: './macroscop-img-place-list.component.scss'
})
export class MacroscopImgPlaceListComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(MacroscopManageService);
  private readonly dialogService = inject(DialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly tableManager = inject(TableManageService<MacroscopImgPlaceView>);
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
  allChannels = signal<MacroscopChannelListDto[]>([]);
  freeChannels = signal<MacroscopChannelListDto[]>([]);
  macroscopConfigId = signal<string | undefined>(undefined);

  @ViewChild(MatTable) table!: MatTable<MacroscopImgPlaceView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'used', 'name', 'internalName'];
  trackById = (index: number, item: MacroscopImgPlaceView) => item.id;
  itemId = (item: MacroscopImgPlaceView) => item.id;

  get isLoading() { return this.actions().isLoading; }
  get isSaving() { return this.actions().isSaving; }
  isLoadingScreenshot = signal(false);

  private currentAgentId = '';

  _yesNoSource: TableFilterListValue[] = [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }];
  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['used', { key: 'used', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource } }],
    ['name', { key: 'name', type: TableFilterType.TEXT }],
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
    this.currentAgentId = agentId;
    this.tableManager.doRefreshBase(() => this.loadData(agentId, showDeleted));
  }

  private loadData(agentId: string, showDeleted: boolean): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      places: this.dataService.getImgPlacesForAgent(agentId, showDeleted),
      channels: this.dataService.getActualChannelsForImgAgent(agentId),
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ places, channels }) => {
        this.allChannels.set(channels);
        this.tableManager.setData(places.map(dto => macroscopImgPlaceListDtoToView(dto)));
        this.render();
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка загрузки списка мест: ${resError.message}`);
        this.allChannels.set([]);
        this.tableManager.setData([]);
      },
    });

    this.dataService.getImgConfig(agentId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(undefined)),
    ).subscribe(dto => this.macroscopConfigId.set(dto?.config?.id));
  }

  loadItem = (item: MacroscopImgPlaceView): Observable<MacroscopImgPlaceView | undefined> => {
    return this.dataService.getImgPlace(item.id).pipe(
      map(dto => macroscopImgPlaceDtoToView(dto)),
    );
  };

  addItem = (item: MacroscopImgPlaceView): Observable<MacroscopImgPlaceView> => {
    //console.log(`add: ${JSON.stringify(item)}`)
    const req = macroscopImgPlaceViewToDto(item);
    return this.dataService.addImgPlaceByAgent(this.currentAgentId, req)
      .pipe(map(dto => macroscopImgPlaceDtoToView(dto)));
    //return of(req).pipe(map(dto => macroscopImgPlaceDtoToView(dto)))
  };

  updateItem = (item: MacroscopImgPlaceView): Observable<MacroscopImgPlaceView> => {
    //console.log(`update: ${JSON.stringify(item)}`)
    if (item.undeleted) {
      return this.dataService.restoreImgPlace(item.id)
        .pipe(map(dto => macroscopImgPlaceDtoToView(dto)));
    }
    const req = macroscopImgPlaceViewToDto(item);
    return this.dataService.updateImgPlace(item.id, req)
      .pipe(map(dto => macroscopImgPlaceDtoToView(dto)));
    //return of(req).pipe(map(dto => macroscopImgPlaceDtoToView(dto)))
  };

  deleteItem = (item: MacroscopImgPlaceView): Observable<void> => {
    //console.log(`delete: ${JSON.stringify(item)}`)
    return this.dataService.deleteImgPlace(item.id);
    //return of()
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter(reset);

  private render = (): void => this.table?.renderRows();

  callSelect = (item: MacroscopImgPlaceView) => this.doSelect(item, true);

  private callAdd(): void {
    const newItem = createNewMacroscopPlace();
    const usedIds = new Set(
      this.dataSource.data.filter(p => !p.deleted).map(p => p.macroscopId)
        .filter((id): id is string => !!id));
    const free = this.allChannels().filter(c => !usedIds.has(c.macroscopId));
    this.freeChannels.set(free);

    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
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

  private canDeleteItem = (item: MacroscopImgPlaceView | undefined): boolean => {
    if (!item) return false;
    if (this.canFullActions()) return true;
    return isNewItem(item);
  };

  private doSelect = (item: MacroscopImgPlaceView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  doLoadedItem = (item: MacroscopImgPlaceView | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  };

  doUpdate = (item: MacroscopImgPlaceView) => {
    this.tableManager.doUpdateBase(item, () => this.render());
  };

  doRestoreDeleted = (item: MacroscopImgPlaceView) => {
    item.undeleted = true;
    this.tableManager.doUpdateBase(item, () => this.render());
  }

  private doDelete = (item: MacroscopImgPlaceView) => {
    this.tableManager.doDeleteBase(item, () => this.render());
  };

  isExpanded = (index: number, item: any): boolean => isExpanded(item);

  private doSave(): void {
    const resApply = (result: SaveDataResult<MacroscopImgPlaceView>) => {
      if (result.success) {
        this.tableManager.dataSource.data = this.dataSource.data.map(p => {
          if (p.undeleted) {
            const { undeleted, ...rest } = p;
            return rest as MacroscopImgPlaceView;
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

  onCallGetChannelScreenShot(event: { mode: 'current' | 'archive'; place: MacroscopImgPlaceView }): void {
    const configId = this.macroscopConfigId();
    if (!configId) {
      this.notificationService.error('Конфигурация Macroscop не привязана к агенту');
      return;
    }
    if (!event.place.macroscopId) {
      this.notificationService.error('Не выбран канал Macroscop');
      return;
    }

    const loader$ = event.mode === 'archive'
      ? this.dataService.getArchiveScreenshot(configId, event.place.macroscopId)
      : this.dataService.getCurrentScreenshot(configId, event.place.macroscopId);

    this.isLoadingScreenshot.set(true);
    loader$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.isLoadingScreenshot.set(false)),
    ).subscribe(result => {
      if (result.success && result.data) {
        this.dialogService.showImage(
          result.data,
          event.place.name ?? event.place.macroscopId,
        );
      } else {
        this.notificationService.error(
          result.errorMessage ?? 'Не удалось получить скриншот',
        );
      }
    });
  }
}