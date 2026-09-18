import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, computed, effect, ElementRef, inject, input,
  OnInit, output, ViewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FilterRootComponent, TableFilterInfo, TableFilterListValue,
  TableFilterType, TableManageService
} from '@mon3/sc';
import { YClientsServiceCategoryView } from '../../yclients-view.models';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-yc-service-category-list',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatSortModule, MatButtonModule, MatCheckboxModule,
    FilterRootComponent
  ],
  providers: [TableManageService],
  templateUrl: './yc-service-category-list.component.html',
  styleUrl: './yc-service-category-list.component.scss'
})
export class YcServiceCategoryListComponent implements OnInit, AfterViewInit {
  private tableManager = inject(TableManageService<YClientsServiceCategoryView>);

  categoriesData = input.required<YClientsServiceCategoryView[]>();
  currentOrgId = input<number | undefined>(undefined);
  selectedOrgId = input<number | undefined>(undefined);
  loadingCategories = input<boolean>(false);

  loadFromCrm = output<void>();
  selectedChange = output<{ id: number; selected: boolean }>();

  dataSource = this.tableManager.dataSource;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  isSmallScreen = this.tableManager.isSmallScreen;

  @ViewChild(MatTable) table!: MatTable<YClientsServiceCategoryView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;

  displayedColumns = ['expand', 'name', 'id'];
  trackById = (index: number, item: YClientsServiceCategoryView) => item.id;
  itemId = (item: YClientsServiceCategoryView) => item.id;

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['id', { key: 'id', type: TableFilterType.TEXT }],
  ]);

  canLoadFromCrm = computed(() => {
    if (this.loadingCategories()) return false;
    return this.currentOrgId() !== undefined || this.selectedOrgId() !== undefined;
  });

  hasNoCategories = computed(() => this.categoriesData().length === 0);
  

  constructor() {
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

  onLoadFromCrm(): void {
    this.loadFromCrm.emit();
  }

  onSelectedChange(row: YClientsServiceCategoryView, checked: boolean): void {
    this.selectedChange.emit({ id: row.id, selected: checked });
  }
}