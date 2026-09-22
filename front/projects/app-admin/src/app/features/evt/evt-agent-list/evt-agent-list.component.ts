import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { finalize, forkJoin, map, Observable, tap } from 'rxjs';

import {
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, TableFilterInfo, TableFilterListValue, TableFilterType, TableManageService
} from '@mon3/sc';
import { PermissionService } from '@mon3/sa';

import { EvtStructManageService } from '../../../services/evt-struct-manage.service';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { authConstant } from '../../../auth-constants';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { EvtAgentItemView, EvtAgentTypeView } from '../evt-view.models';
import { EvtAgentBindEditorComponent } from '../evt-agent-bind-editor/evt-agent-bind-editor.component';
import {
  createNewEvtAgent, evtAgentItemDtoToView, evtAgentListDtoToView,
  evtAgentTypeDtoToView, evtAgentViewToItemDto, evtAgentViewToListDto
} from '../evt-view.utils';

@Component({
  selector: 'app-evt-agent-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, EvtAgentBindEditorComponent
  ],
  providers: [TableManageService],
  templateUrl: './evt-agent-list.component.html',
  styleUrl: './evt-agent-list.component.scss'
})
export class EvtAgentListComponent implements OnInit, AfterViewInit {

  private dataService = inject(EvtStructManageService);
  private mainStructManageService = inject(MainStructManageService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<EvtAgentItemView>);
  private permisService = inject(PermissionService);

  // === Данные ===
  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<EvtAgentItemView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  agentTypes = signal<EvtAgentTypeView[]>([]);
  organizations = signal<OrgStructInfo[]>([]);

  displayedColumns = ['expand', 'name', 'configured', 'agentTypeWithInfo', 'organization'];
  trackById = (index: number, item: EvtAgentItemView) => item.id;
  itemId = (item: EvtAgentItemView) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);
  currentOrg = signal<string | undefined>(undefined);
  orgName = computed(() => {
    if (!this.currentOrg()) return '';
    const org = this.organizations().find(f => f.id === this.currentOrg());
    return org ? 'для ' + org.shortName : '';
  });
  canAddAgent = signal(false);
  canBindAgent = signal(false);

  // === Фильтры ===
  _yesNoSource1: TableFilterListValue[] = [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }];
  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['configured', { key: 'configured', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource1 } }],
    ['agentType', { key: 'agentType', type: TableFilterType.LIST }],
    ['organizationId', { key: 'organizationId', type: TableFilterType.LIST }],
  ]);

  ngOnInit(): void {
    this.canBindAgent.set(this.permisService.checkPermissions(authConstant('structModifyAgents')));
    this.filterConfig.set(this._filterConfig);
    this.initializeData();
    this.tableManager.breakpointsSubscribe();
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.showFilter.set(false);
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  initializeData = (): void => {
    this.isLoading.set(false);
    this.error.set(null);

    forkJoin({
      types: this.dataService.getAgentTypes().pipe(
        map(list => list.map(dto => evtAgentTypeDtoToView(dto))),
        this.tableManager.handleError<EvtAgentTypeView[]>('Ошибка загрузки списка типов агентов', []),
      ),
      organizations: this.mainStructManageService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto))),
        this.tableManager.handleError<OrgStructInfo[]>('Ошибка загрузки списка организаций', []),
      ),
    }).subscribe({
      next: (result) => {
        const { types, organizations } = result as { types: EvtAgentTypeView[]; organizations: OrgStructInfo[] };
        this.agentTypes.set(types);
        this.organizations.set(organizations);

        this.filterConfig.update(map => {
          const newMap = new Map(map);
          const typeCfg = newMap.get('agentType');
          if (typeCfg) {
            const dataSource = types.map(p => ({ id: p.value, text: p.name }));
            newMap.set('agentType', { ...typeCfg, config: { ...typeCfg.config, dataSource } });
          }
          const orgCfg = newMap.get('organizationId');
          if (orgCfg) {
            const dataSource = organizations.map(p => ({ id: p.id, text: p.shortName }));
            newMap.set('organizationId', { ...orgCfg, config: { ...orgCfg.config, dataSource } });
          }
          return newMap;
        });

        this.loadData();
      },
      error: () => this.isLoading.set(false)
    });
  }

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getAllAgents()
      .pipe(
        map(list => list.map(dto => evtAgentListDtoToView(dto, this.agentTypes(), this.organizations()))),
        this.tableManager.handleError<EvtAgentItemView[]>('Ошибка загрузки списка агентов', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          let idVal: string | undefined = undefined;
          const orgParam = this.tableManager.getRoute().snapshot.queryParamMap.get('org');

          if (orgParam) {
            this.currentOrg.set(orgParam);
            const idRec = result.find(f => f.organizationId === orgParam);
            this.canAddAgent.set(!(idRec?.organizationId));
            idVal = idRec?.id;

            // Показываем фильтр и устанавливаем его на выбранную организацию
            const orgShortName = this.organizations().find(o => o.id === orgParam)?.shortName || '';
            this.tableManager.onFilterChange({
              key: 'organizationId',
              type: TableFilterType.LIST,
              value: { id: orgParam, text: orgShortName } as TableFilterListValue
            });
            this.showFilter.set(true);

            this.tableManager.getRouter().navigate([], {
              relativeTo: this.tableManager.getRoute(),
              queryParams: { id: idVal },
              queryParamsHandling: 'replace',
              replaceUrl: true
            });
          } else {
            this.canAddAgent.set(true);
          }

          this.tableManager.setData(result as EvtAgentItemView[]);
          this.tableManager.handleUrlParams(idVal);

          if (this.selectedItem()) {
            const _item = this.selectedItem();
            this.canAddAgent.set(!(_item?.organizationId));
            this.currentOrg.set(_item?.organizationId);
            this.selectedItem.set(undefined);
            this.tableManager.scrollToItemId(_item?.id);
            setTimeout(() => this.selectedItem.set(_item), 300);
          }
        }
      });
  };

  loadItem = (item: EvtAgentItemView): Observable<EvtAgentItemView | undefined> => {
    const agentTypes = this.agentTypes();
    const orgs = this.organizations();
    this.tableManager.snackError.set(null);
    return this.dataService.getAgentById(item.id).pipe(
      map(dto => evtAgentItemDtoToView(dto, agentTypes, orgs)),
      this.tableManager.handleError<EvtAgentItemView | undefined>(
        'Ошибка загрузки информации об агенте', undefined, this.tableManager.snackError),
      tap(() => {
        const err = this.tableManager.snackError();
        if (err) {
          this.notificationService.error(err);
          this.tableManager.snackError.set(null);
        }
      })
    );
  }

  addItem = (item: EvtAgentItemView): Observable<EvtAgentItemView> => {
    const req = evtAgentViewToListDto(item);
    return this.dataService.addAgent(req).pipe(
      map(dto => evtAgentItemDtoToView(dto, this.agentTypes(), this.organizations())));
  };

  updateItem = (item: EvtAgentItemView): Observable<EvtAgentItemView> => {
    const req = evtAgentViewToItemDto(item);
    return this.dataService.updateAgent(req).pipe(
      map(dto => evtAgentItemDtoToView(dto, this.agentTypes(), this.organizations())));
  };

  deleteItem = (item: EvtAgentItemView): Observable<void> =>
    this.dataService.deleteAgentsById(item.id);

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = () => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => !!this.selectedItem() && isNewItem(this.selectedItem()!);

  callSelect = (item: EvtAgentItemView) => this.doSelect(item, true);

  callRefresh(): void {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.')
      .subscribe(confirmed => { if (confirmed) this.doRefresh(); });
  }

  callAdd = () => this.doAdd();

  callDelete(item: EvtAgentItemView): void {
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить агента "${item.name}"?`)
        .subscribe(confirmed => { if (confirmed) this.doDelete(item); });
    }
  }

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?')
      .subscribe(confirmed => { if (confirmed) this.doSave(); });
  }

  private doSelect = (item: EvtAgentItemView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  doLoadedItem = (item: EvtAgentItemView | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  }

  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());

  private doAdd(): void {
    const agentType = this.agentTypes()!.at(0)!.value;
    const newItem = createNewEvtAgent(this.currentOrg(), agentType, this.agentTypes(), this.organizations());
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }

  private doDelete = (item: EvtAgentItemView) =>
    this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  doUpdate = (item: EvtAgentItemView) =>
    this.tableManager.doUpdateBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<EvtAgentItemView>) => {
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