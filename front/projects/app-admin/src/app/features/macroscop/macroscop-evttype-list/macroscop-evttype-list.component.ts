import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin, map, Observable, of } from 'rxjs';

import {
  DialogService, FilterRootComponent, isExpanded,
  MacroscopEventTypeDto,
  newTableDataChanges,
  NotificationService, SelectValueDialogData, TableFilterInfo, TableFilterType, TableManageService,
} from '@mon3/sc';
import { PermissionService, processResponseError } from '@mon3/sa';

import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { authConstant } from '../../../auth-constants';
import {
  MacroscopActivityEventTypeView,
  MacroscopAgentConfigListView,
  MacroscopEventTypeView,
} from '../macroscop-view.models';
import {
  macroscopActivityEventTypeDtoToView,
  macroscopAgentConfigListDtoToView,
  macroscopEventTypeDtoToView,
  macroscopEventTypeViewToDto,
} from '../macroscop-view.utils';
import { MacroscopEvttypeInplaceEditorComponent } from './macroscop-evttype-inplace-editor/macroscop-evttype-inplace-editor.component';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-macroscop-evttype-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule, MatCheckboxModule,
    FilterRootComponent, MacroscopEvttypeInplaceEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './macroscop-evttype-list.component.html',
  styleUrl: './macroscop-evttype-list.component.scss'
})
export class MacroscopEvttypeListComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(MacroscopManageService);
  private readonly dialogService = inject(DialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly tableManager = inject(TableManageService<MacroscopEventTypeView>);

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<MacroscopEventTypeView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'name', 'activityType'];
  trackById = (i: number, item: MacroscopEventTypeView) => item.id;
  itemId = (item: MacroscopEventTypeView) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);
  canFullActions = signal(false);
  onlyBound = signal(true);

  activityTypes = signal<MacroscopActivityEventTypeView[]>([]);
  configs = signal<MacroscopAgentConfigListView[]>([]);
  private allRows = signal<MacroscopEventTypeView[]>([]);

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['activityTypeId', { key: 'activityTypeId', type: TableFilterType.LIST, config: { dataSource: [] } }],
  ]);


  ngOnInit(): void {
    this.canFullActions.set(this.permissionService.checkPermissions(authConstant('evtTypesAllCations')));
    if (!this.canFullActions()) this.onlyBound.set(true);
    this.filterConfig.set(this._filterConfig);
    this.tableManager.breakpointsSubscribe();
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.showFilter.set(false);
    this.initializeData();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  initializeData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      activities: this.dataService.getActivityEventTypes().pipe(
        map(list => list.map(dto => macroscopActivityEventTypeDtoToView(dto))),
        this.tableManager.handleError<MacroscopActivityEventTypeView[]>(
          'Ошибка загрузки типов активностей', []),
      ),
      configs: this.canFullActions()
        ? this.dataService.getConfigs().pipe(
          map(list => list.map(dto => macroscopAgentConfigListDtoToView(dto))),
          this.tableManager.handleError<MacroscopAgentConfigListView[]>(
            'Ошибка загрузки списка конфигураций Macroscop', []),
        )
        : of([] as MacroscopAgentConfigListView[]),
    }).subscribe({
      next: ({ activities, configs }) => {
        this.activityTypes.set(activities);
        this.configs.set(configs);

        this.filterConfig.update(map => {
          const newMap = new Map(map);
          const cfg = newMap.get('activityTypeId');
          if (cfg) {
            const dataSource = activities.map(a => ({ id: a.id, text: a.description }));
            newMap.set('activityTypeId', { ...cfg, config: { ...cfg.config, dataSource } });
          }
          return newMap;
        });

        this.loadData();
      },
      error: () => this.isLoading.set(false),
    });
  };

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);
    const activities = this.activityTypes();

    this.dataService.getEventTypes()
      .pipe(
        map(list => list.map(dto => macroscopEventTypeDtoToView(dto, activities))),
        this.tableManager.handleError<MacroscopEventTypeView[]>(
          'Ошибка загрузки типов событий', []),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: rows => this.afterLoadData(rows as MacroscopEventTypeView[]),
      });
  };

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter(reset);
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  private render = (): void => this.table?.renderRows();


  private afterLoadData(rows: MacroscopEventTypeView[]): void {
    this.allRows.set(rows);
    this.tableManager.dataSource.data = [];
    this.doApplyBoundFilter();
    this.tableManager.handleUrlParams();

    const selected = this.selectedItem();
    if (selected) {
      this.selectedItem.set(undefined);
      this.tableManager.scrollToItemId(selected.id);
      setTimeout(() => this.selectedItem.set(selected), 300);
    }
  }

  callBoundChange(checked: boolean): void {
    this.onlyBound.set(checked);
    this.doApplyBoundFilter();
  }

  callSelect = (item: MacroscopEventTypeView) => this.doSelect(item, true);

  callRefresh(): void {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.')
      .subscribe(confirmed => { if (confirmed) this.doRefresh(); });
  }

  callAdd(): void {
    if (!this.canFullActions()) return;

    const configs = this.configs();
    if (configs.length === 0) {
      this.notificationService.error('Нет доступных конфигураций Macroscop');
      return;
    }

    const data = new SelectValueDialogData(
      'Загрузить типы событий с сервера Macroscop',
      configs.map(c => ({ id: c.id, name: c.name })),
      undefined,                       // selectedId — выберет первый
      'Загрузить',
      'Отмена',
    );

    this.dialogService.selectValue(data).subscribe(selectedId => {
      if (!selectedId) return;
      this.doLoadFromMacroscop(selectedId);
    });
  }

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  doSelect = (item: MacroscopEventTypeView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.render(), updateUrl, scrollTo, true, undefined);
  };

  doUpdate = (item: MacroscopEventTypeView) => {
    this.tableManager.doUpdateBase(item, () => this.render());
    this.allRows.update(list => list.map(r => r.id === item.id ? item : r))
  };

  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());

  private doLoadFromMacroscop(configId: string): void {

    const applyMacroscopEventTypes = (remoteDtos: MacroscopEventTypeDto[]): void => {
      const current = this.dataSource.data;
      const currentById = new Map(current.map(c => [c.id, c]));
      const remoteById = new Map(remoteDtos.map(d => [d.id, d]));

      const result: MacroscopEventTypeView[] = [];

      // Существующие: обновляем только name, привязку не трогаем.
      for (const cur of current) {
        const r = remoteById.get(cur.id);
        if (!r) continue;                              // нет на сервере — удаляем
        result.push(new MacroscopEventTypeView(
          cur.id,
          r.name ?? cur.name,                        // имя — с сервера
          cur.activityTypeId,                        // привязка — наша
          cur.activityType,
        ));
      }

      // Новые: добавляем с пустой привязкой.
      for (const r of remoteDtos) {
        if (currentById.has(r.id)) continue;
        result.push(new MacroscopEventTypeView(
          r.id,
          r.name,
          undefined,
          undefined,
        ));
      }

      this.allRows.set(result);
      this.doApplyBoundFilter();
      this.tableManager.dataState.set(newTableDataChanges());
      this.tableManager.selectedItem.set(undefined);
      this.tableManager.expandedItem.set(undefined);
    }

    this.isLoading.set(true);
    this.dataService.getMacroscopEventTypes(configId).pipe(
      finalize(() => this.isLoading.set(false)),
    ).subscribe({
      next: result => {
        if (!result.success || !result.data) {
          this.notificationService.error(
            result.errorMessage ?? 'Ошибка загрузки типов событий с сервера Macroscop');
          return;
        }
        applyMacroscopEventTypes(result.data);
        this.notificationService.success('Список типов событий получен с сервера Macroscop');
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка запроса к Macroscop: ${resError.message}`);
      },
    });
  }

  private doApplyBoundFilter(): void {
    const all = this.allRows();
    const currentById = new Map(this.dataSource.data.map(r => [r.id, r]));
    const merged = all.map(r => currentById.get(r.id) ?? r);

    const filtered = this.onlyBound()
      ? merged.filter(r => !!r.activityTypeId)
      : merged;

    this.tableManager.setData(filtered);
    this.render();
  }

  private doSave(): void {
    const dtos = this.allRows().map(v => macroscopEventTypeViewToDto(v));
    const activities = this.activityTypes();

    this.isSaving.set(true);
    this.dataService.updateEventTypes(dtos).pipe(
      finalize(() => this.isSaving.set(false)),
    ).subscribe({
      next: result => {
        const rows = result.map(dto => macroscopEventTypeDtoToView(dto, activities));
        this.tableManager.doRefreshBase();
        this.afterLoadData(rows);
        this.tableManager.dataState.set(newTableDataChanges());
        this.notificationService.success('Изменения сохранены');
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка сохранения: ${resError.message}`);
      },
    });
  }

}