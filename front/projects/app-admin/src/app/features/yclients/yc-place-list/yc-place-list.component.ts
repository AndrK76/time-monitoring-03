import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, inject, Injector,
  input, OnInit, ViewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, map, Observable, of } from 'rxjs';
import {
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, TableActionsInformerService, TableFilterInfo, TableFilterType, TableManageService,
  YClientsPlaceDto
} from '@mon3/sc';
import { YclientsManageService } from '../../../services/yclients-manage.service';
import { YClientsPlaceView } from '../yclients-view.models';
import {
  yClientsPlaceCrmDtoToView, yClientsPlaceDtoToView, yClientsPlaceViewToDto
} from '../yclients-view.utils';
import { YcPlaceInplaceEditorComponent } from './yc-place-inplace-editor/yc-place-inplace-editor.component';
import { processResponseError } from '@mon3/sa';

@Component({
  selector: 'app-yc-place-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, YcPlaceInplaceEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './yc-place-list.component.html',
  styleUrl: './yc-place-list.component.scss'
})
export class YcPlaceListComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(YclientsManageService);
  private readonly dialogService = inject(DialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly tableManager = inject(TableManageService<YClientsPlaceView>);

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

  @ViewChild(MatTable) table!: MatTable<YClientsPlaceView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'isNew', 'available', 'name', 'ycName', 'ycId'];
  trackById = (index: number, item: YClientsPlaceView) => item.id ?? `yc-${item.ycId}`;
  itemId = (item: YClientsPlaceView) => item.id ?? `yc-${item.ycId}`;
  isNewRow = (row: YClientsPlaceView): boolean => row.isNew === true;

  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  };


  get isLoading() { return this.actions().isLoading; }
  get isSaving() { return this.actions().isSaving; }
  get isLoadingFromCrm() { return this.actions().isLoadingOther1; }

  private currentAgentId = '';

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['ycName', { key: 'ycName', type: TableFilterType.TEXT }],
    ['isNew', {
      key: 'isNew', type: TableFilterType.LIST,
      config: { dataSource: [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }] }
    }],
    ['available', {
      key: 'available', type: TableFilterType.LIST,
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

    this.dataService.getPlacesForAgent(agentId)
      .pipe(
        map(list => list.map(dto => yClientsPlaceDtoToView(dto))),
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
            `Ошибка загрузки списка мест: ${resError.message}`);
          this.tableManager.setData([]);
        },
      });
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  
  private render = (): void => this.table?.renderRows();

  callSelect = (item: YClientsPlaceView) => this.doSelect(item, true);

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
      this.dialogService.confirm(`Удалить место "${item.name ?? item.ycName}"?`)
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



  private doSelect = (item: YClientsPlaceView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  private doDelete = (item: YClientsPlaceView) => {
    this.tableManager.doDeleteBase(item, () => this.render());
  };

  doUpdate = (item: YClientsPlaceView) => {
    this.tableManager.doUpdateBase(item, () => this.render());
  };

  private doAddFromCrm(): void {
    this.isLoadingFromCrm.set(true); 

    this.dataService.getAllowedPlaces(this.currentAgentId)
      .pipe(finalize(() => this.isLoadingFromCrm.set(false)))
      .subscribe({
        next: result => {
          if (!result.success) {
            this.notificationService.error(result.errorMessage ?? 'Ошибка при запросе списка мест из CRM');
            return;
          }
          if (!result.data?.length) {
            this.notificationService.error(result.errorMessage ?? 'Получен пустой список мест из CRM');
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

  private afterReceiveAddDataFromCrm(crmPlaces: YClientsPlaceDto[]): void {
    const current = this.dataSource.data;
    const currentByYcId = new Map(current.map(s => [s.ycId, s]));
    const crmByYcId = new Map(crmPlaces.map(s => [s.ycId, s]));

    const toAdd: YClientsPlaceDto[] = [];
    const toUpdate: { existing: YClientsPlaceView; changes: Partial<YClientsPlaceView> }[] = [];

    for (const place of current) {
      const crm = crmByYcId.get(place.ycId);
      if (crm) {
        const changes: Partial<YClientsPlaceView> = {};
        if (place.ycName !== crm.ycName) changes.ycName = crm.ycName;
        if (place.available !== crm.available) changes.available = crm.available;
        if (Object.keys(changes).length > 0) {
          toUpdate.push({ existing: place, changes });
        }
      } else if (place.available) {
        toUpdate.push({ existing: place, changes: { available: false } });
      }
    }

    for (const crm of crmPlaces) {
      if (!currentByYcId.has(crm.ycId)) toAdd.push(crm);
    }

    for (const dto of [...toAdd].reverse()) {
      const view = yClientsPlaceCrmDtoToView(dto);
      this.tableManager.doAddBase(view, undefined, false, false);
    }
    for (const { existing, changes } of toUpdate) {
      this.tableManager.doUpdateBase({ ...existing, ...changes }, undefined);
    }

    this.render();

    const firstNew = this.dataSource.data.find(s => this.isNewRow(s));
    if (firstNew) this.callSelect(firstNew);
  }



  private addItem = (item: YClientsPlaceView): Observable<YClientsPlaceView> => {
    const req = yClientsPlaceViewToDto(item);
    return this.dataService.addPlaceForAgent(this.currentAgentId, req)
      .pipe(map(dto => yClientsPlaceDtoToView(dto)));
  };

  private updateItem = (item: YClientsPlaceView): Observable<YClientsPlaceView> => {
    const req = yClientsPlaceViewToDto(item);
    return this.dataService.updatePlaceForAgent(this.currentAgentId, item.id!, req)
      .pipe(map(dto => yClientsPlaceDtoToView(dto)));
  };

  private deleteItem = (item: YClientsPlaceView): Observable<void> => {
    return this.dataService.deletePlaceForAgent(this.currentAgentId, item.id!);
  };

  private doSave(): void {
    const resApply = (result: SaveDataResult<YClientsPlaceView>) => {
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