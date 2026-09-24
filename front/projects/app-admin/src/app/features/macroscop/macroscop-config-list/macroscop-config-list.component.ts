import { AfterViewInit, Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, map, Observable, switchMap, tap } from 'rxjs';

import {
  addNewItemFlag, addNotFullLoadItemFlag,
  DialogService, FilterRootComponent, isExpanded, isNewItem, NotificationService,
  SaveDataResult, TableFilterInfo, TableFilterType, TableManageService,
} from '@mon3/sc';

import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { MacroscopConfigEditorComponent } from '../macroscop-config-editor/macroscop-config-editor.component';
import { MacroscopAgentConfigView } from '../macroscop-view.models';
import {
  createEmptyMacroscopAgentConfigView,
  macroscopAgentConfigDtoToView,
  macroscopAgentConfigListDtoToFullView,
  macroscopAgentConfigViewToDto,
} from '../macroscop-view.utils';

@Component({
  selector: 'app-macroscop-config-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatTooltipModule, MatSortModule,
    FilterRootComponent, MacroscopConfigEditorComponent,
  ],
  providers: [TableManageService],
  templateUrl: './macroscop-config-list.component.html',
  styleUrl: './macroscop-config-list.component.scss',
})
export class MacroscopConfigListComponent implements OnInit, AfterViewInit {
  private dataService = inject(MacroscopManageService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<MacroscopAgentConfigView>);

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<MacroscopAgentConfigView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'name', 'serverAddress'];
  trackById = (index: number, item: MacroscopAgentConfigView) => item.id;
  itemId = (item: MacroscopAgentConfigView) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  _filterConfig: Map<string, TableFilterInfo> = new Map<string, TableFilterInfo>([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['serverAddress', { key: 'serverAddress', type: TableFilterType.TEXT }],
  ]);

  ngOnInit(): void {
    this.tableManager.breakpointsSubscribe();
    this.filterConfig.set(this._filterConfig);
    this.loadData();
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.showFilter.set(false);
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  private loadData = (): void => {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getConfigs()
      .pipe(
        map(list => list.map(dto =>
          addNotFullLoadItemFlag(macroscopAgentConfigListDtoToFullView(dto)))),
        this.tableManager.handleError<MacroscopAgentConfigView[]>(
          'Ошибка загрузки списка конфигураций', []),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: rows => {
          this.tableManager.setData(rows as MacroscopAgentConfigView[]);
          this.tableManager.handleUrlParams();
          if (this.selectedItem()) {
            const _item = this.selectedItem();
            this.selectedItem.set(undefined);
            this.tableManager.scrollToItemId(_item?.id);
            setTimeout(() => this.selectedItem.set(_item), 300);
          }
        },
      });
  };

  loadItem = (item: MacroscopAgentConfigView): Observable<MacroscopAgentConfigView | undefined> => {
    this.tableManager.snackError.set(null);
    return this.dataService.getConfig(item.id).pipe(
      map(dto => macroscopAgentConfigDtoToView(dto)),
      this.tableManager.handleError<MacroscopAgentConfigView | undefined>(
        'Ошибка загрузки конфигурации', undefined, this.tableManager.snackError),
      tap(() => {
        const err = this.tableManager.snackError();
        if (err) {
          this.notificationService.error(err);
          this.tableManager.snackError.set(null);
        }
      }),
    );
  };

  addItem = (item: MacroscopAgentConfigView): Observable<MacroscopAgentConfigView> => {
    const req = macroscopAgentConfigViewToDto(item);
    return this.dataService.newConfig().pipe(
      switchMap(created => {
        const patched = { ...req, id: created.id };
        return this.dataService.updateConfig(created.id, patched);
      }),
      map(dto => macroscopAgentConfigDtoToView(dto)),
    );
  };

  updateItem = (item: MacroscopAgentConfigView): Observable<MacroscopAgentConfigView> => {
    const req = macroscopAgentConfigViewToDto(item);
    return this.dataService.updateConfig(item.id, req)
      .pipe(map(dto => macroscopAgentConfigDtoToView(dto)));
  };

  deleteItem = (item: MacroscopAgentConfigView): Observable<void> =>
    this.dataService.deleteConfig(item.id);

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = () => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);
  isNewItem = () => !!this.selectedItem() && isNewItem(this.selectedItem()!);

  callSelect = (item: MacroscopAgentConfigView) => this.doSelect(item, true);

  callRefresh(): void {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.')
      .subscribe(c => { if (c) this.doRefresh(); });
  }

  callAdd = () => this.doAdd();

  callDelete(item: MacroscopAgentConfigView): void {
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить конфигурацию "${item.name}"?`)
        .subscribe(c => { if (c) this.doDelete(item); });
    }
  }

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?')
      .subscribe(c => { if (c) this.doSave(); });
  }

  private doSelect = (item: MacroscopAgentConfigView | undefined, newState: boolean,
    updateUrl = true, scrollTo = false) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  doLoadedItem = (item: MacroscopAgentConfigView | undefined) => {
    this.tableManager.doAfterLoadItem(item, () => this.table.renderRows());
  };

  doUpdate = (item: MacroscopAgentConfigView | undefined) => {
    // Эмит `undefined` = пользователь вернул форму к исходному.
    // Пока не поддерживаем откат — состояние modified останется,
    // но при сохранении сервер получит актуальные значения.
    if (!item) return;
    this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  };

  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadData());

  private doAdd(): void {
    const newItem = addNewItemFlag(createEmptyMacroscopAgentConfigView());
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), false, true);
  }

  private doDelete = (item: MacroscopAgentConfigView) =>
    this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<MacroscopAgentConfigView>) => {
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
      resApply,
    );
  }
}