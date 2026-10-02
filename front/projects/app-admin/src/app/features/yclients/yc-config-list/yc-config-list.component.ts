import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin, map } from 'rxjs';

import {
  DialogService, FilterRootComponent, isExpanded,
  NotificationService, TableFilterInfo, TableFilterType, TableManageService,
} from '@mon3/sc';
import { processResponseError } from '@mon3/sa';

import { CrmStructManageService } from '../../../services/crm-struct-manage.service';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { CrmAgentItemView } from '../../crm/crm-view.models';
import { crmAgentListDtoToView } from '../../crm/crm-view.utils';
import { YcConfigEditorComponent } from '../yc-config-editor/yc-config-editor.component';

const YC_AGENT_TYPE = 'YClients';

@Component({
  selector: 'app-yc-config-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, YcConfigEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './yc-config-list.component.html',
  styleUrl: './yc-config-list.component.scss'
})
export class YcConfigListComponent implements OnInit, AfterViewInit {
  private readonly crmService = inject(CrmStructManageService);
  private readonly mainStructService = inject(MainStructManageService);
  private readonly dialogService = inject(DialogService);
  private readonly notificationService = inject(NotificationService);
  private readonly tableManager = inject(TableManageService<CrmAgentItemView>);

  dataSource = this.tableManager.dataSource;
  selectedItem = this.tableManager.selectedItem;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<CrmAgentItemView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'name', 'organization', 'configured'];
  trackById = (i: number, item: CrmAgentItemView) => item.id;
  itemId = (item: CrmAgentItemView) => item.id;

  isLoading = signal(false);
  organizations = signal<OrgStructInfo[]>([]);

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['organizationId', { key: 'organizationId', type: TableFilterType.LIST }],
    ['configured', {
      key: 'configured', type: TableFilterType.LIST,
      config: { dataSource: [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }] }
    }],
  ]);

  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.tableManager.breakpointsSubscribe();
    this.tableManager.doUpdateUrl.set(false);
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.showFilter.set(false);
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      agents: this.crmService.getAllAgents(),
      organizations: this.mainStructService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto)))),
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ agents, organizations }) => {
        this.organizations.set(organizations);

        this.filterConfig.update(map => {
          const newMap = new Map(map);
          const orgCfg = newMap.get('organizationId');
          if (orgCfg) {
            const dataSource = organizations.map(o => ({ id: o.id, text: o.shortName }));
            newMap.set('organizationId', { ...orgCfg, config: { ...orgCfg.config, dataSource } });
          }
          return newMap;
        });

        const rows = agents
          .filter(a => a.agentType === YC_AGENT_TYPE)
          .map(dto => crmAgentListDtoToView(dto, undefined, organizations));

        this.tableManager.setData(rows as CrmAgentItemView[]);
        this.render();
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка загрузки списка YClients-агентов: ${resError.message}`);
        this.tableManager.setData([]);
      },
    });
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = () => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);

  callSelect = (item: CrmAgentItemView) => this.doSelect(item, true);

  private doSelect = (item: CrmAgentItemView | undefined, newState: boolean,
    updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  callRefresh(): void {
    this.dialogService.confirm('Перечитать данные?')
      .subscribe(confirmed => { if (confirmed) this.loadData(); });
  }

  private render = (): void => this.table?.renderRows();
}