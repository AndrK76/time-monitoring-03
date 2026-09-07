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
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { OrgStructInfo } from '../struct-org-view.models';
import { finalize, map, Observable, of } from 'rxjs';
import { orgStructListDtofromView, orgStructListDtoToView } from '../struct-org-view.utils';
import { StructOrgEditorComponent } from '../struct-org-editor/struct-org-editor.component';
import { PermissionService } from '@mon3/sa';
import { authConstant } from '../../../auth-constants';

@Component({
  selector: 'app-struct-org-list',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule,
    MatTooltipModule, MatSortModule,
    FilterRootComponent, StructOrgEditorComponent],
  providers: [TableManageService],
  templateUrl: './struct-org-list.component.html',
  styleUrl: './struct-org-list.component.scss'
})
export class StructOrgListComponent implements OnInit, AfterViewInit {
  private dataService = inject(MainStructManageService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<OrgStructInfo>);
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

  @ViewChild(MatTable) table!: MatTable<OrgStructInfo>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'shortName', 'fullName', 'crmAgentSet', 'eventAgentsSet', 'cameraAgentsSet'];
  trackById = (index: number, item: OrgStructInfo) => item.id;
  itemId = (item: OrgStructInfo) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  canChangeInfo = signal(false);
  canSetAgents = signal(false);

  // Фильтры
  _yesNoSource1: TableFilterListValue[] = [{ id: true, text: 'Привязан' }, { id: false, text: 'Нет' }];
  _yesNoSource2: TableFilterListValue[] = [{ id: true, text: 'Вкл' }, { id: false, text: 'Откл' }];
  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['shortName', { key: 'shortName', type: TableFilterType.TEXT }],
    ['fullName', { key: 'fullName', type: TableFilterType.TEXT }],
    ['crmAgentSet', { key: 'crmAgentSet', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource1 } }],
    ['eventAgentsSet', { key: 'eventAgentsSet', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource2 } }],
    ['cameraAgentsSet', { key: 'cameraAgentsSet', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource2 } }],
  ]);

  ngOnInit(): void {
    this.canChangeInfo.set(this.permisService.checkPermissions(authConstant('structChangeOrg')));
    this.canSetAgents.set(this.permisService.checkPermissions(authConstant('structModifyAgents')));
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
    this.isLoading.set(true);
    this.error.set(null);
    this.loadData();
  };

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getOrganizations()
      .pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto))),
        this.tableManager.handleError<OrgStructInfo[]>('Ошибка загрузки организаций', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (result) => {
          const rows = result as OrgStructInfo[];
          this.tableManager.setData(rows);
          this.tableManager.handleUrlParams();
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

  updateItem = (item: OrgStructInfo): Observable<OrgStructInfo> => {
    const req = orgStructListDtofromView(item);
    return this.dataService.updateOrganization(item.id, req).pipe(
      map(dto => orgStructListDtoToView(dto))
    );
  };


  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);

  callSelect = (item: OrgStructInfo) => this.doSelect(item, true);
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


  private doSelect = (item: OrgStructInfo | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };


  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());


  doUpdate = (item: OrgStructInfo) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());

  private doSave(): void {

    const resApply = (result: SaveDataResult<OrgStructInfo>) => {
      if (result.success) {
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    };
    this.tableManager.doSaveBase(
      this.isSaving, undefined, (item) => this.updateItem(item), undefined, resApply);
  }

}
