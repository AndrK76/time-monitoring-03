import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, computed, DestroyRef, ElementRef, inject, Injector,
  input, OnInit, signal, ViewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, map, Observable, switchMap } from 'rxjs';
import {
  ConfirmDialogCancelResult,
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, TableActionsInformerService, TableFilterInfo, TableFilterType, TableManageService,
  YClientsServiceDto
} from '@mon3/sc';
import { YclientsManageService } from '../../../services/yclients-manage.service';
import { YClientsServiceCategoryView, YClientsServiceView } from '../yclients-view.models';
import {
  yClientsServiceCategoryDtoToView, yClientsServiceCrmDtoToView, yClientsServiceDtoToView,
  yClientsServiceViewToDto
} from '../yclients-view.utils';
import { YcServiceInplaceEditorComponent } from './yc-service-inplace-editor/yc-service-inplace-editor.component';
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

  actions = input.required<TableActionsInformerService>();

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;
  totalCount = this.tableManager.totalCount;

  @ViewChild(MatTable) table!: MatTable<YClientsServiceView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'isNew', 'name', 'categoryName', 'ycId', 'ycName'];
  trackById = (index: number, item: YClientsServiceView) => item.id ?? `yc-${item.ycId}`;
  itemId = (item: YClientsServiceView) => item.id ?? `yc-${item.ycId}`;
  isNewRow = (row: YClientsServiceView): boolean => (row as any)._new === true;

  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  };

  get isLoading() { return this.actions().isLoading; }
  get isSaving() { return this.actions().isSaving; }
  get isLoadingFromCrm() { return this.actions().isLoadingOther1; }

  private currentAgentId = '';
  categories: YClientsServiceCategoryView[] = [];

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

    this.tableManager.setActionsInformer(this.actions(), {
      onTriggerAdd: () => this.callAdd(),
      onTriggerDelete: () => this.callDelete(),
      onTriggerRefresh: () => this.callRefresh(),
      onTriggerSave: () => this.callSave(),
      onTriggerReload: (agentId) => this.initializeData(agentId),
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
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
          yClientsServiceCategoryDtoToView(dto, true, undefined, false))),
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
          this.render();
        },
        error: err => {
          const resError = processResponseError(err);
          this.notificationService.error(
            `Ошибка загрузки списка услуг: ${resError.message}`);
          this.tableManager.setData([]);
        },
      });
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();

  private render = (): void => this.table?.renderRows();

  callSelect = (item: YClientsServiceView) => this.doSelect(item, true);

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

  private doDelete = (item: YClientsServiceView) => {
    this.tableManager.doDeleteBase(item, () => this.render());
  };

  doUpdate = (item: YClientsServiceView) => {
    this.tableManager.doUpdateBase(item, () => () => this.render());
  };

  private doAddFromCrm(): void {
    this.isLoadingFromCrm.set(true);

    this.dataService.getAllowedServices(this.currentAgentId)
      .pipe(finalize(() => this.isLoadingFromCrm.set(false)))
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
          this.afterReceiveAddDataFromCrm(result.data);
        },
        error: err => {
          const resError = processResponseError(err);
          this.notificationService.error(`Ошибка запроса к CRM: ${resError.message}`);
        },
      });
  }

  private afterReceiveAddDataFromCrm(crmServices: YClientsServiceDto[]): void {
    const applyAddChanges = (
      toAdd: YClientsServiceDto[],
      toUpdate: { existing: YClientsServiceView; dto: YClientsServiceDto }[],
      toDelete: YClientsServiceView[]): void => {

      for (const dto of [...toAdd].reverse()) {
        const view = yClientsServiceCrmDtoToView(dto, this.categories);
        this.tableManager.doAddBase(view, undefined, false, false);
      }
      for (const { existing, dto } of toUpdate) {
        this.tableManager.doUpdateBase({ ...existing, ycName: dto.ycName }, undefined);
      }
      for (const svc of toDelete) {
        this.tableManager.doDeleteBase(svc, undefined);
      }
      this.render();

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
    return this.dataService.addServiceForAgent(this.currentAgentId, req)
      .pipe(map(dto => yClientsServiceDtoToView(dto, this.categories)));
  };

  private updateItem = (item: YClientsServiceView): Observable<YClientsServiceView> => {
    const req = yClientsServiceViewToDto(item);
    return this.dataService.updateServiceForAgent(this.currentAgentId, item.id!, req)
      .pipe(map(dto => yClientsServiceDtoToView(dto, this.categories)));;
  };

  private deleteItem = (item: YClientsServiceView): Observable<void> => {
    const req = yClientsServiceViewToDto(item);
    return this.dataService.deleteServiceForAgent(this.currentAgentId, item.id!);
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


}