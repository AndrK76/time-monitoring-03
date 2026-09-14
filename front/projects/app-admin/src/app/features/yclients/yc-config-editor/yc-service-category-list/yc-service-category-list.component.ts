import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, computed, effect, ElementRef, inject, input,
  OnInit, output, ViewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FilterRootComponent, isExpanded, TableFilterInfo, TableFilterListValue,
  TableFilterType, TableManageService
} from '@mon3/sc';
import { YClientsServiceCategoryListView } from '../../yclients-view.models';

@Component({
  selector: 'app-yc-service-category-list',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatIconModule,
    MatTooltipModule, MatSortModule, MatButtonModule, FilterRootComponent
  ],
  providers: [TableManageService],
  templateUrl: './yc-service-category-list.component.html',
  styleUrl: './yc-service-category-list.component.scss'
})
export class YcServiceCategoryListComponent implements OnInit, AfterViewInit {
  private tableManager = inject(TableManageService<YClientsServiceCategoryListView>);

  categoriesData = input.required<YClientsServiceCategoryListView[]>();
  currentOrgId = input<number | undefined>(undefined);
  selectedOrgId = input<number | undefined>(undefined);

  loadFromCrm = output<void>();

  dataSource = this.tableManager.dataSource;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<YClientsServiceCategoryListView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'name', 'orgId', 'exists'];
  trackById = (index: number, item: YClientsServiceCategoryListView) => item.id;
  itemId = (item: YClientsServiceCategoryListView) => item.id;

  _yesNoSource: TableFilterListValue[] = [{ id: true, text: 'Да' }, { id: false, text: 'Нет' }];

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['orgId', { key: 'orgId', type: TableFilterType.TEXT }],
    ['exists', { key: 'exists', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource } }],
  ]);

  canLoadFromCrm = computed(() => {
    return this.currentOrgId() !== undefined || this.selectedOrgId() !== undefined;
  });

  orgsMatch = computed(() => {
    const current = this.currentOrgId();
    const selected = this.selectedOrgId();
    return current !== undefined && selected !== undefined && current === selected;
  });

  constructor() {
    // Автоматически обновляем данные таблицы при изменении входного сигнала
    effect(() => {
      const data = this.categoriesData();
      this.tableManager.setData(data ?? []);
      if (this.table) {
        this.table.renderRows();
      }
    });
  }

  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.tableManager.doUpdateUrl.set(false);
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setData(this.categoriesData());
    this.showFilter.set(false);
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item);

  onLoadFromCrm(): void {
    this.loadFromCrm.emit();
  }
}