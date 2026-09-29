import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, computed, effect, ElementRef, inject, input,
  OnInit, output, ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FilterRootComponent, isExpanded, TableFilterInfo, TableFilterListValue,
  TableFilterType, TableManageService,
} from '@mon3/sc';
import { MacroscopChannelView } from '../../macroscop-view.models';

@Component({
  selector: 'app-macroscop-channel-list',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatSortModule, MatButtonModule, MatCheckboxModule,
    FilterRootComponent,
  ],
  providers: [TableManageService],
  templateUrl: './macroscop-channel-list.component.html',
  styleUrl: './macroscop-channel-list.component.scss',
})
export class MacroscopChannelListComponent implements OnInit, AfterViewInit {
  private tableManager = inject(TableManageService<MacroscopChannelView>);

  channelsData = input.required<MacroscopChannelView[]>();
  loadingChannels = input<boolean>(false);

  loadChannels = output<void>();
  usedChange = output<{ macroscopId: string; used: boolean }>();
  getChannelScreenShot = output<{ mode: string; channel: MacroscopChannelView }>()


  dataSource = this.tableManager.dataSource;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  isSmallScreen = this.tableManager.isSmallScreen;
  selectedItem = this.tableManager.selectedItem;

  @ViewChild(MatTable) table!: MatTable<MacroscopChannelView>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>;


  displayedColumns = ['expand', 'name', 'enabled', 'exists', 'macroscopId'];
  detailsColumns = ['detail-expand', 'detail-info'];

  trackById = (index: number, item: MacroscopChannelView) => item.macroscopId;
  itemId = (item: MacroscopChannelView) => item.macroscopId;

  private _yesNoSource: TableFilterListValue[] = [
    { id: true, text: 'Да' },
    { id: false, text: 'Нет' },
  ];

  _filterConfig: Map<string, TableFilterInfo> = new Map([
    ['name', { key: 'name', type: TableFilterType.TEXT }],
    ['enabled', { key: 'enabled', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource } }],
    ['exists', { key: 'exists', type: TableFilterType.LIST, config: { dataSource: this._yesNoSource } }],
    ['macroscopId', { key: 'macroscopId', type: TableFilterType.TEXT }],
  ]);

  hasNoChannels = computed(() => this.channelsData().length === 0);

  constructor() {
    effect(() => {
      const data = this.channelsData();
      this.tableManager.setData(data ?? []);
      if (this.table) {
        this.table.renderRows();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.tableManager.doUpdateUrl.set(false);
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
    this.tableManager.setData(this.channelsData());
    this.showFilter.set(false);
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();

  callLoadFromMacroscop(): void {
    this.loadChannels.emit();
  }

  onUsedChange(row: MacroscopChannelView, checked: boolean): void {
    this.usedChange.emit({ macroscopId: row.macroscopId, used: checked });
  }

  callSelect = (row: MacroscopChannelView) => this.doSelect(row, true);

  isExpanded = (index: number, row: any): boolean => isExpanded(row);

  private doSelect = (
    item: MacroscopChannelView | undefined, newState: boolean,
    updateUrl = true, scrollTo = false,
  ) => {
    this.tableManager.doSelectBaseWithCollapse(
      item, newState, () => this.table.renderRows(), updateUrl, scrollTo, true, undefined);
  };

  streamTypes(row: MacroscopChannelView): string {
    const types = (row.streams ?? [])
      .map(s => s.type)
      .filter((t): t is string => !!t);
    return types.length ? types.join(', ') : '—';
  }

  callGetCurrentScreenshot(row: MacroscopChannelView | undefined) {
    if (!row) return;
    this.getChannelScreenShot.emit({ mode: 'current', channel: row });
  }

  callGetArchiveScreenshot(row: MacroscopChannelView | undefined) {
    if (!row) return;
    this.getChannelScreenShot.emit({ mode: 'archive', channel: row });
  }
}