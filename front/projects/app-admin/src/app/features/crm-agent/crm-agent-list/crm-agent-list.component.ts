import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DialogService, FilterRootComponent, isExpanded, NotificationService, SaveDataResult, TableFilterInfo, TableFilterListValue, TableFilterType, TableManageService } from '@mon3/sc';
import { CrmStructManageService } from '../../../services/crm-struct-manage.service';
import { CrmAgentItemView, CrmAgentTypeView } from '../crm-agent-view.models';
import { PermissionService } from '@mon3/sa';
import { authConstant } from '../../../auth-constants';
import { finalize, forkJoin, map } from 'rxjs';
import { crmAgentItemDtoToView, crmAgentListDtoToView, crmAgentTypeDtoToView } from '../crm-agent-view.utils';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';

@Component({
  selector: 'app-crm-agent-list',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule,
    MatTooltipModule, MatSortModule,
    FilterRootComponent],
  providers: [TableManageService],
  templateUrl: './crm-agent-list.component.html',
  styleUrl: './crm-agent-list.component.scss'
})
export class CrmAgentListComponent implements OnInit, AfterViewInit {

  private dataService = inject(CrmStructManageService);
  private mainStructManageService = inject(MainStructManageService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<CrmAgentItemView>);
  private permisService = inject(PermissionService);

  // Данные
  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;


  @ViewChild(MatTable) table!: MatTable<CrmAgentItemView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  crmAgents = signal<CrmAgentItemView[]>([]);
  agentTypes = signal<CrmAgentTypeView[]>([]);
  organizations = signal<OrgStructInfo[]>([]);

  displayedColumns = ['expand', 'name', 'configured', 'agentTypeWithInfo', 'organization'];
  trackById = (index: number, item: CrmAgentItemView) => item.id;
  itemId = (item: CrmAgentItemView) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  canBindAgent = signal(false);

  // Фильтры
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
      types: this.dataService.getAgentTypes()
        .pipe(
          map(list => list.map(dto => crmAgentTypeDtoToView(dto))),
          this.tableManager.handleError<CrmAgentTypeView[]>('Ошибка загрузки списка типов агентов', []),
        ),
      organizations: this.mainStructManageService.getOrganizations()
        .pipe(
          map(list => list.map(dto => orgStructListDtoToView(dto))),
          this.tableManager.handleError<OrgStructInfo[]>('Ошибка загрузки списка организаций', []),
        ),

    }).subscribe({
      next: (result) => {
        const { types, organizations } = result as { types: CrmAgentTypeView[]; organizations: OrgStructInfo[] };

        this.agentTypes.set(types);
        this.organizations.set(organizations);
        this.filterConfig.update(map => {
          const config = map.get('agentType');
          if (config) {
            const dataSource = types.map(p => ({ id: p.value, text: p.name }));
            const newMap = new Map(map);
            newMap.set('agentType', { ...config, config: { ...config.config, dataSource } });
            return newMap;
          }
          return map;
        });
        this.filterConfig.update(map => {
          const config = map.get('organizationId');
          if (config) {
            const dataSource = organizations.map(p => ({ id: p.id, text: p.shortName }));
            const newMap = new Map(map);
            newMap.set('organizationId', { ...config, config: { ...config.config, dataSource } });
            return newMap;
          }
          return map;
        });

        this.loadData();
      },
      error: () => {
        this.isLoading.set(false);
      }
    })
  }

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getAllAgents()
      .pipe(
        map(list => list.map(dto => crmAgentListDtoToView(dto, this.agentTypes(), this.organizations()))),
        this.tableManager.handleError<CrmAgentItemView[]>('Ошибка загрузки организаций', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          let idVal: string | undefined = undefined;
          const orgParam = this.tableManager.getRoute().snapshot.queryParamMap.get('org');
          if (orgParam) {
            idVal = result.find(f => f.organizationId === orgParam)?.id;
            this.tableManager.getRouter().navigate([], {
              relativeTo: this.tableManager.getRoute(),
              queryParams: { id: idVal },
              queryParamsHandling: 'replace'
            });
          }

          const rows = result as CrmAgentItemView[];
          this.tableManager.setData(rows);
          this.tableManager.handleUrlParams(idVal);

          if (this.selectedItem()) {
            const _item = this.selectedItem();
            this.selectedItem.set(undefined);
            this.tableManager.scrollToItemId(_item?.id);
            setTimeout(() => {
              this.selectedItem.set(_item);
            }, 300);
          }
        }
      });
  };


  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);

  callSelect = (item: CrmAgentItemView) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }


  private doSelect = (item: CrmAgentItemView | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };


  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());


  doUpdate = (item: CrmAgentItemView) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());

  private doSave(): void {

    /*
    const resApply = (result: SaveDataResult<CrmAgentItemView>) => {
      if (result.success) {
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    };
    this.tableManager.doSaveBase(
      this.isSaving, undefined, (item) => this.updateItem(item), undefined, resApply);
      */
  }


}
