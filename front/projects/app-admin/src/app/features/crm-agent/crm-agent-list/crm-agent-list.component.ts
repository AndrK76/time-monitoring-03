import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService, SaveDataResult, TableFilterInfo, TableFilterListValue, TableFilterType, TableManageService } from '@mon3/sc';
import { CrmStructManageService } from '../../../services/crm-struct-manage.service';
import { CrmAgentItemView, CrmAgentTypeView } from '../crm-agent-view.models';
import { PermissionService } from '@mon3/sa';
import { authConstant } from '../../../auth-constants';
import { finalize, forkJoin, map, Observable, of, tap } from 'rxjs';
import { createNewAgent, crmAgentItemDtoToView, crmAgentListDtoToView, crmAgentTypeDtoToView, crmAgentViewToItemDto, crmAgentViewToListDto } from '../crm-agent-view.utils';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { RouterModule } from '@angular/router';
import { CrmAgentBindEditorComponent } from './crm-agent-bind-editor/crm-agent-bind-editor.component';

@Component({
  selector: 'app-crm-agent-list',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule,
    MatTooltipModule, MatSortModule, RouterModule,
    FilterRootComponent, CrmAgentBindEditorComponent],
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
  currentOrg = signal<string | undefined>(undefined);
  orgName = computed(() => {
    if (!this.currentOrg()) return '';
    const org = this.organizations().find(f => f.id === this.currentOrg());
    return org ? 'для ' + org.shortName : '';
  });
  canAddAgent = signal(false);
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
        this.tableManager.handleError<CrmAgentItemView[]>('Ошибка загрузки списка агентов', []),
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
            this.tableManager.getRouter().navigate([], {
              relativeTo: this.tableManager.getRoute(),
              queryParams: { id: idVal },
              queryParamsHandling: 'replace'
            });
          } else {
            this.canAddAgent.set(true);
          }

          const rows = result as CrmAgentItemView[];
          this.tableManager.setData(rows);
          this.tableManager.handleUrlParams(idVal);

          if (this.selectedItem()) {
            const _item = this.selectedItem();
            this.canAddAgent.set(!(_item?.organizationId));
            this.currentOrg.set(_item?.organizationId);
            this.selectedItem.set(undefined);
            this.tableManager.scrollToItemId(_item?.id);
            setTimeout(() => {
              this.selectedItem.set(_item);
            }, 300);
          }
        }
      });
  };

  loadItem = (item: CrmAgentItemView): Observable<CrmAgentItemView | undefined> => {
    const agentTypes = this.agentTypes();
    const organizationns = this.organizations();
    this.tableManager.snackError.set(null);
    return this.dataService.getAgentById(item.id).pipe(
      map(dto => crmAgentItemDtoToView(dto, agentTypes, organizationns)),
      this.tableManager.handleError<CrmAgentItemView | undefined>('Ошибка загрузки информации об агенте', undefined, this.tableManager.snackError),
      tap(v => {
        const err = this.tableManager.snackError();
        if (err) {
          this.notificationService.error(err);
          this.tableManager.snackError.set(null);
        }
      })
    );
  }

  addItem = (item: CrmAgentItemView): Observable<CrmAgentItemView> => {
    const req = crmAgentViewToListDto(item);
    return this.dataService.addAgent(req).pipe(
      map(dto => crmAgentItemDtoToView(dto, this.agentTypes(), this.organizations())));
  };

  updateItem = (item: CrmAgentItemView): Observable<CrmAgentItemView> => {
    const req = crmAgentViewToItemDto(item);
    return this.dataService.updateAgent(req).pipe(
      map(dto => crmAgentItemDtoToView(dto, this.agentTypes(), this.organizations())));
  };

  deleteItem = (item: CrmAgentItemView): Observable<void> => {
    return this.dataService.deleteAgentsById(item.id);
  };

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => {
    if (!this.selectedItem()) return false;
    return isNewItem(this.selectedItem()!);
  }

  callSelect = (item: CrmAgentItemView) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd = () => this.doAdd();
  callDelete(item: CrmAgentItemView) {
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить агента "${item.name}"?`).subscribe(confirmed => {
        if (confirmed) this.doDelete(item);
      });
    }
  }

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }


  private doSelect = (item: CrmAgentItemView | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };
  doLoadedItem = (item: CrmAgentItemView | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  }
  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());

  private doAdd(): void {
    const agentType = this.agentTypes()!.at(0)!.value;
    const newItem = createNewAgent(this.currentOrg(), agentType, this.agentTypes(), this.organizations());
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }
  private doDelete = (item: CrmAgentItemView) => this.tableManager.doDeleteBase(item, () => this.table.renderRows());


  doUpdate = (item: CrmAgentItemView) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<CrmAgentItemView>) => {
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
