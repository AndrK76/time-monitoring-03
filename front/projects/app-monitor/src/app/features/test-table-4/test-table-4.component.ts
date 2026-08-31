import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, inject, OnInit, signal, ViewChild, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SampleDataService } from '../../services/sample-data.service';
import { Place, EventStatus, PlaceEvents, EventData } from '../../models/sample-data-model';
import { finalize, forkJoin, } from 'rxjs';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { createEmptyEventRow, EventRow } from '../event-row';
import {
  DialogService, isNewItem, isExpanded,
  NotificationService, TableFilterInfo, TableFilterType, FilterRootComponent,
  TableManageService, SaveDataResult,
  isNotApplyItem
} from '@mon3/sc';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { EventsEditorContainerComponent } from '../events-editor-container/events-editor-container.component';

@Component({
  selector: 'app-test-table-1',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatTooltipModule,
    MatSortModule,
    FilterRootComponent,
    EventsEditorContainerComponent
  ],
  providers: [TableManageService],
  templateUrl: './test-table-4.component.html',
  styleUrl: './test-table-4.component.scss',
})
export class TestTable4Component implements OnInit, AfterViewInit {
  private dataService = inject(SampleDataService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);
  private tableManager = inject(TableManageService<EventRow>);

  private cdr = inject(ChangeDetectorRef);

  dataSource = this.tableManager.dataSource;
  dataState = this.tableManager.dataState;
  selectedItem = this.tableManager.selectedItem;
  hasChanges = this.tableManager.hasChanges;
  changesSummary = this.tableManager.changesSummary;
  filterConfig = this.tableManager.filterConfig;
  showFilter = this.tableManager.showFilter;
  error = this.tableManager.error;

  @ViewChild(MatTable) table!: MatTable<EventRow>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('tableWrapper') tableWrapper!: ElementRef<HTMLDivElement>

  places = signal<Place[]>([]);
  statuses = signal<EventStatus[]>([]);

  displayedColumns = ['expand', 'placeName', 'statusName', 'start', 'end', 'booking_id', 'details'];
  trackById = (index: number, item: EventRow) => item.id;
  itemId = (item: EventRow) => item.id;

  isLoading = signal(false);
  isSaving = signal(false);

  _filterConfig: Map<string, TableFilterInfo> = new Map<string, TableFilterInfo>([
    ['placeId', { key: 'placeId', type: TableFilterType.LIST, config: { dataSource: [] } }],
    ['start', { key: 'start', type: TableFilterType.DATE }],
    ['end', { key: 'end', type: TableFilterType.DATE }],
    ['booking_id', { key: 'booking_id', type: TableFilterType.TEXT }],
  ]);

  ngOnInit(): void {
    this.filterConfig.set(this._filterConfig);
    this.initializeData();
    this.tableManager.setItemIdFn(this.itemId);
    this.tableManager.setSelectFn(this.doSelect);
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.tableManager.initFilterPredicate();
    this.tableManager.setTableWrapper(this.tableWrapper);
  }

  private initializeData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      places: this.dataService.getPlaces().pipe(this.tableManager.handleError<Place[]>('Ошибка загрузки мест', [])),
      statuses: this.dataService.getStatuses().pipe(this.tableManager.handleError<EventStatus[]>('Ошибка загрузки статусов', []))
    }).subscribe({
      next: (result) => {
        const { places, statuses } = result as { places: Place[]; statuses: EventStatus[] };
        this.places.set(places);
        this.statuses.set(statuses);

        this.filterConfig.update(map => {
          const config = map.get('placeId');
          if (config) {
            const dataSource = places.map(p => ({ id: p.id, text: p.name }));
            const newMap = new Map(map);
            newMap.set('placeId', { ...config, config: { ...config.config, dataSource } });
            return newMap;
          }
          return map;
        });
        this.loadEvents();
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private loadEvents(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.toggleFilter(true);

    this.dataService.getPlaceEvents()
      .pipe(
        this.tableManager.handleError<PlaceEvents[]>('Ошибка загрузки событий', []),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (events) => {
          const placeEvents = events as PlaceEvents[];
          const rows: EventRow[] = [];
          const placesMap = new Map(this.places().map(p => [p.id, p.name]));
          const statusesMap = new Map(this.statuses().map(s => [s.code, s]));

          placeEvents.forEach(pe => {
            const placeName = placesMap.get(pe.place) || pe.place;
            pe.events.forEach((evt: EventData) => {
              const status = statusesMap.get(evt.status);
              const startStr = evt.start.replace('T', ' ').slice(0, 16);
              const endStr = evt.end.replace('T', ' ').slice(0, 16);
              rows.push({
                id: evt.id,
                placeId: pe.place,
                placeName: placeName,
                statusCode: evt.status,
                statusName: status?.name || evt.status,
                statusColor: status?.color,
                start: evt.start,
                end: evt.end,
                booking_id: evt.booking_id,
                details: `Место: ${placeName} | Статус: ${status?.name || evt.status} | ${startStr} – ${endStr} | ID: ${evt.booking_id || '—'}`
              });
            });
          });

          this.tableManager.setData(rows);
          this.tableManager.handleUrlParams();
        }
      });
  }

  onFilterChange = (val: TableFilterInfo) => this.tableManager.onFilterChange(val);
  toggleFilter = (reset?: boolean) => this.tableManager.toggleFilter();
  isExpanded = (index: number, item: any): boolean => isExpanded(item)

  callSelect = (item: EventRow) => this.doSelect(item, true);
  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd = () => this.doAdd();
  callDelete(item: EventRow) {
    if (isNewItem(item)) {
      this.doDelete(item);
    } else {
      this.dialogService.confirm(`Удалить запись с ID = ${item.id}?`).subscribe(confirmed => {
        if (confirmed) this.doDelete(item)
      });
    }
  }
  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }

  private doSelect = (item: EventRow | undefined, newState: boolean, updateUrl: boolean = true, scrollTo: boolean = false) => {
    this.tableManager.doSelectBaseWithCollapse(item, newState, () => this.table.renderRows(), updateUrl, scrollTo, undefined, undefined);
  }
  private doRefresh = () => this.tableManager.doRefreshBase(() => this.loadEvents());
  private doAdd(): void {
    const newItem = createEmptyEventRow(this.places()[0]?.id);
    this.tableManager.doAddBase(newItem, () => this.table.renderRows(), true);
  }
  doUpdate = (item: EventRow) => this.tableManager.doUpdateBase(item, () => this.table.renderRows());
  private doDelete = (item: EventRow) => this.tableManager.doDeleteBase(item, () => this.table.renderRows());

  private doSave(): void {
    const resApply = (result: SaveDataResult<EventRow>) => {
      if (result.success) {
        this.notificationService.success('Все изменения сохранены успешно');
      } else {
        const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
        this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
      }
    }
    this.tableManager.doSaveBase(this.isSaving,
      (item: EventRow) => this.dataService.addEventRow(item),
      (item: EventRow) => this.dataService.updateEventRow(item),
      (item: EventRow) => this.dataService.removeEventRow(item),
      resApply);
  }

  onEditorClose(item: EventRow) {
    if (isNotApplyItem(item)) {
      this.doDelete(item);
    } else {
      const _id = (this.selectedItem()?.id) ?? null;
      this.tableManager.doSelectBaseWithCollapse(this.selectedItem(), false, undefined, true, false, undefined, undefined);
      this.tableManager.scrollToItemId(_id);
    }
  }



}