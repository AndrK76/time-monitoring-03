import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, computed, DestroyRef, ElementRef, inject, Injector,
  input, OnInit, signal, ViewChild
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, finalize, map, Observable, of, switchMap } from 'rxjs';
import {
  ConfirmDialogCancelResult,
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, TableFilterInfo, TableFilterType, TableManageService,
  YClientsServiceDto
} from '@mon3/sc';
import { YclientsManageService } from '../../../services/yclients-manage.service';
import { YClientsServiceCategoryListView, YClientsServiceView } from '../yclients-view.models';
import {
  yClientsServiceCategoryDtoToListView, yClientsServiceCategoryFromId, yClientsServiceCrmDtoToView, yClientsServiceDtoToView,
  yClientsServiceViewToDto
} from '../yclients-view.utils';
import { YcServiceInplaceEditorComponent } from './yc-service-inplace-editor/yc-service-inplace-editor.component';
import { CrmServiceActionsService } from '../../crm-service/crm-service-actions.service';
import { processResponseError } from '@mon3/sa';

@Component({
  selector: 'app-yc-service-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, YcServiceInplaceEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './yc-service-list.component.html',
  styleUrl: './yc-service-list.component.scss'
})
export class YcServiceListComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(YclientsManageService);
  private readonly dialogService = inject(DialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly tableManager = inject(TableManageService<YClientsServiceView>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  actions = input.required<CrmServiceActionsService>();

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<YClientsServiceView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'isNew', 'name', 'categoryName', 'ycId', 'ycName'];
  trackById = (index: number, item: YClientsServiceView) => item.id ?? `yc-${item.ycId}`;
  itemId = (item: YClientsServiceView) => item.id ?? `yc-${item.ycId}`;

  isLoading = signal(false);
  isSaving = signal(false);
  isNewRow = (row: YClientsServiceView): boolean => (row as any)._new === true;
  isLoadingFromCrm = computed(() => this.actions().isLoadingFromCrm());

  categories: YClientsServiceCategoryListView[] = [];

  /** Текущий agentId, для которого загружен список. Используется для save/delete/add-from-crm */
  private currentAgentId = '';

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['ycName', { key: 'ycName', type: TableFilterType.TEXT }],
    ['categoryId', { key: 'categoryId', type: TableFilterType.LIST, config: { dataSource: [] } }],
    ['isNew', {
      key: 'isNew', type: TableFilterType.LIST,
      config: { dataSource: [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }] }
    }],
  ]);

  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.tableManager.doUpdateUrl.set(false);
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.showFilter.set(false);

    // Единственная точка загрузки данных: слушаем reload$ от родителя.
    // ReplaySubject(1) отдаёт последнее значение при подписке, поэтому если
    // родитель уже вызвал triggerReload до создания компонента — загрузимся сразу.
    this.actions().reload$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(agentId => this.initializeData(agentId));

    // Подписки на команды кнопок
    this.subscribeToActions();

    // Синхронизация состояния с actions-сервисом без effect.
    // toObservable эмитит текущее значение синхронно, затем — на каждое изменение.
    combineLatest([
      toObservable(this.hasChanges, { injector: this.injector }),
      toObservable(this.selectedItem, { injector: this.injector }),
      toObservable(this.isLoading, { injector: this.injector }),
      toObservable(this.isSaving, { injector: this.injector }),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([hasChanges, selected, loading, saving]) => {
        const a = this.actions();
        a.hasChanges.set(hasChanges);
        a.canDelete.set(!!selected);
        a.isLoading.set(loading);
        a.isSaving.set(saving);
      });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  private subscribeToActions(): void {
    const a = this.actions();
    a.add$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.callAdd());
    a.delete$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.callDelete());
    a.refresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.callRefresh());
    a.save$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.callSave());
  }

  private initializeData(agentId: string): void {
    this.currentAgentId = agentId;
    this.tableManager.doRefreshBase(() => this.loadFullData(agentId));
  }

  private loadFullData(agentId: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.categories = [];

    this.dataService.getServiceCategoriesForAgent(agentId)
      .pipe(
        map(list => list.map(dto =>
          yClientsServiceCategoryDtoToListView(dto, true, undefined, false))),
        switchMap(categories => {
          this.categories = categories;
          this.filterConfig.update(map => {
            const config = map.get('categoryId');
            if (config) {
              const dataSource = categories.map(p => ({ id: p.id, text: p.name }));
              const newMap = new Map(map);
              newMap.set('categoryId', { ...config, config: { ...config.config, dataSource } });
              return newMap;
            }
            return map;
          });
          return this.dataService.getServicesForAgent(agentId).pipe(
            map(list => list.map(dto => yClientsServiceDtoToView(dto, categories)))
          );
        }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: rows => {
          this.tableManager.setData(rows);
          this.table?.renderRows();
        },
        error: err => {
          const resError = processResponseError(err);
          this.notificationService.error(
            `Ошибка загрузки списка услуг: ${resError.message}`);
          this.tableManager.setData([]);
        },
      });
  }

  private callAdd(): void {
    this.dialogService.confirm('Добавить данные из CRM?').subscribe(confirmed => {
      if (confirmed) this.doAddFromCrm();
    });
  }

  callDelete(): void {
    const item = this.selectedItem();
    if (!item) return;
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить услугу "${item.name ?? item.ycName}"?`)
        .subscribe(confirmed => { if (confirmed) this.doDelete(item); });
    }
  }

  private callRefresh(): void {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.')
      .subscribe(confirmed => {
        if (confirmed) this.actions().triggerReload(this.currentAgentId);
      });
  }

  private callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  private doSelect = (item: YClientsServiceView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  doLoadedItem = (item: YClientsServiceView | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  };

  private doDelete = (item: YClientsServiceView) => {
    this.tableManager.doDeleteBase(item, () => this.table.renderRows());
  };

  doUpdate = (item: YClientsServiceView) => {
    this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  };

  private doAddFromCrm(): void {
    const actions = this.actions();
    actions.isLoadingFromCrm.set(true);

    this.dataService.getAllowedServices(this.currentAgentId)
      .pipe(finalize(() => actions.isLoadingFromCrm.set(false)))
      .subscribe({
        next: result => {
          if (!result.success) {
            this.notificationService.error(result.errorMessage ?? 'Ошибка при запросе списка услуг из CRM');
            return;
          }
          if (!result.data?.length) {
            this.notificationService.error(result.errorMessage ?? 'Получен пустой список услуг из CRM');
            return;
          }
          this.applyAddFromCrm(result.data);
        },
        error: err => {
          const resError = processResponseError(err);
          this.notificationService.error(`Ошибка запроса к CRM: ${resError.message}`);
        },
      });
  }

  private applyAddFromCrm(crmServices: YClientsServiceDto[]): void {
    const applyAddChanges = (
      toAdd: YClientsServiceDto[],
      toUpdate: { existing: YClientsServiceView; dto: YClientsServiceDto }[],
      toDelete: YClientsServiceView[]): void => {
      const render = () => this.table?.renderRows();

      for (const dto of [...toAdd].reverse()) {
        const view = yClientsServiceCrmDtoToView(dto, this.categories);
        this.tableManager.doAddBase(view, render, false, false);
      }
      for (const { existing, dto } of toUpdate) {
        this.tableManager.doUpdateBase({ ...existing, ycName: dto.ycName }, render);
      }
      for (const svc of toDelete) {
        this.tableManager.doDeleteBase(svc, render);
      }

      render();

      const firstNew = this.dataSource.data.find(s => this.isNewRow(s));
      if (firstNew) this.callSelect(firstNew);
    }

    const current = this.dataSource.data;
    const currentByYcId = new Map(current.map(s => [s.ycId, s]));
    const crmByYcId = new Map(crmServices.map(s => [s.ycId, s]));

    const toDelete: YClientsServiceView[] = [];
    const toUpdate: { existing: YClientsServiceView; dto: YClientsServiceDto }[] = [];
    const toAdd: YClientsServiceDto[] = [];

    for (const svc of current) {
      const crm = crmByYcId.get(svc.ycId);
      if (crm) {
        if (svc.ycName !== crm.ycName) toUpdate.push({ existing: svc, dto: crm });
      } else {
        toDelete.push(svc);
      }
    }
    for (const crm of crmServices) {
      if (!currentByYcId.has(crm.ycId)) toAdd.push(crm);
    }

    if (toDelete.length > 0) {
      this.dialogService.confirmWithCancel(
        `Найдено ${toDelete.length} услуг(и), отсутствующих в CRM. Удалить их?`,
        'Отсутствующие услуги',
        'Удалить', 'Оставить', 'Отмена'
      ).subscribe((result: ConfirmDialogCancelResult) => {

        if (result === 'cancel') return;
        const shouldDelete = result === 'yes';
        applyAddChanges(toAdd, toUpdate, shouldDelete ? toDelete : []);
      });
    } else {
      applyAddChanges(toAdd, toUpdate, []);
    }
  }



  private addItem = (item: YClientsServiceView): Observable<YClientsServiceView> => {
    const req = yClientsServiceViewToDto(item);
    //console.log(`req: ${JSON.stringify(req)}`);
    //return of(item)
    return this.dataService.addServiceForAgent(this.currentAgentId, req)
      .pipe(map(dto => yClientsServiceDtoToView(dto, this.categories)));
  };

  private updateItem = (item: YClientsServiceView): Observable<YClientsServiceView> => {
    const req = yClientsServiceViewToDto(item);
    //console.log(`update: ${JSON.stringify(req)}`);
    //return of(item)
    return this.dataService.updateServiceForAgent(this.currentAgentId, item.id!, req)
      .pipe(map(dto => yClientsServiceDtoToView(dto, this.categories)));;
  };

  private deleteItem = (item: YClientsServiceView): Observable<void> => {
    const req = yClientsServiceViewToDto(item);
    return this.dataService.deleteServiceForAgent(this.currentAgentId, item.id!);
    //console.log(`delete: ${JSON.stringify(req)}`);
    //return of();
  };

  private doSave(): void {
    const resApply = (result: SaveDataResult<YClientsServiceView>) => {
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

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  };

  callSelect = (item: YClientsServiceView) => this.doSelect(item, true);
}