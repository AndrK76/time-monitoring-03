import { AfterViewInit, Component, computed, inject, OnInit, signal, ViewChild, ViewEncapsulation, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SampleDataService } from '../../services/sample-data.service';
import { Place, EventStatus, PlaceEvents, EventData } from '../../models/sample-data-model';
import { catchError, finalize, forkJoin, Observable, of } from 'rxjs';
import { MatTable, MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { EventsEditorInplaceComponent } from '../events-editor-inplace/events-editor-inplace.component';
import { createEmptyEventRow, EventRow } from '../event-row';
import {
  DialogService, addModifyChangeToState, formatTableChanges, hasTableChanges, newTableDataChanges,
  TableDataChanges, updateDataSourceItem, addDeleteChangeToState, addNewChangeToState,
  addDataSourceItem, isNewItem, deleteDataSourceItem, selectDataSourceItem, isExpanded, doSaveData,
  NotificationService, TableFilterInfo, TableFilterType, FilterRootComponent,
  initFilterPredicate,
  applyFilters,
  clearFilterValues
} from '@mon3/sc';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSort, MatSortModule } from '@angular/material/sort';

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
    EventsEditorInplaceComponent,
    MatTooltipModule,
    MatSortModule,
    FilterRootComponent
  ],
  templateUrl: './test-table-2.component.html',
  styleUrl: './test-table-2.component.scss',
})
export class TestTable2Component implements OnInit, AfterViewInit {
  private dataService = inject(SampleDataService);
  private dialogService = inject(DialogService);
  private notificationService = inject(NotificationService);

  places = signal<Place[]>([]);
  statuses = signal<EventStatus[]>([]);

  isLoading = signal(false);
  isSaving = signal(false);
  error = signal<string | null>(null);

  @ViewChild(MatTable) table!: MatTable<EventRow>;
  displayedColumns = ['expand', 'placeName', 'statusName', 'start', 'end', 'booking_id', 'details'];
  dataSource = new MatTableDataSource<EventRow>([]);
  dataState = signal<TableDataChanges>(newTableDataChanges());
  trackById = (index: number, item: EventRow) => item.id;
  itemId = (item: EventRow) => item.id;

  @ViewChild(MatSort) sort!: MatSort;
  showFilter = signal(false);
  filterConfig: WritableSignal<Map<string, TableFilterInfo>> = signal(new Map<string, TableFilterInfo>([
    ['placeId', { key: 'placeId', type: TableFilterType.LIST, config: { dataSource: [] } }],
    ['start', { key: 'start', type: TableFilterType.DATE }],
    ['end', { key: 'end', type: TableFilterType.DATE }],
    ['booking_id', { key: 'booking_id', type: TableFilterType.TEXT }],
  ]));


  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    initFilterPredicate(this.dataSource, () => this.filterConfig());
  }


  selectedItem: WritableSignal<EventRow | undefined> = signal(undefined);
  hasChanges = computed(() => hasTableChanges(this.dataState()));
  changesSummary = computed(() => formatTableChanges(this.dataState()));


  ngOnInit(): void {
    this.initializeData();
  }

  private handleError(message: string) {
    return catchError((err: any) => {
      console.error(err);
      this.error.set(message);
      return of([]);
    });
  }


  private initializeData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      places: this.dataService.getPlaces().pipe(this.handleError('Ошибка загрузки мест')),
      statuses: this.dataService.getStatuses().pipe(this.handleError('Ошибка загрузки статусов'))
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

    this.dataService.getPlaceEvents()
      .pipe(
        this.handleError('Ошибка загрузки событий'),
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

          this.dataSource.data = rows;
          applyFilters(this.dataSource);
        }
      });
  }


  onFilterChange(val: TableFilterInfo) {
    this.filterConfig.update(v => {
      const newVal: TableFilterInfo = { ...v.get(val.key)!, value: val.value };
      v.set(val.key, newVal);
      return v;
    });
    applyFilters(this.dataSource);
  }

  toggleFilter(): void {
    this.showFilter.update(v => !v);
    if (!this.showFilter()) {
      this.filterConfig.update(map => clearFilterValues(map));
      applyFilters(this.dataSource);
    }
  }


  callSelect(item: EventRow) {
    const expanded = isExpanded(item);
    this.doSelect(item, !expanded);
  }
  isExpanded = (index: number, item: any): boolean => {
    return isExpanded(item);
  }


  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }
  callAdd() {
    this.doAdd();
  }
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


  private doSelect(item: EventRow, newState: boolean) {
    const result = selectDataSourceItem(this.dataSource.data, item, this.itemId, newState);
    this.selectedItem.set(undefined);
    if (result.selected) {
      this.dataSource.data = result.data;
      this.table.renderRows();
      this.selectedItem.set(item);
    }
  }
  private doRefresh(): void {
    this.loadEvents();
    this.dataState.set(newTableDataChanges());
    this.selectedItem.set(undefined);
  }
  private doAdd(): void {
    const newEvent = createEmptyEventRow(this.places()[0]?.id);
    this.selectedItem.set(undefined);
    const result = addDataSourceItem(this.dataSource.data, newEvent);
    if (result.added) {
      this.dataSource.data = result.data;
      this.table.renderRows();
      this.dataState.update(state => addNewChangeToState(state, newEvent.id));
      this.selectedItem.set(newEvent);
      // Прокручиваем таблицу к началу, чтобы новая строка была видна
      // (опционально)
    }
  }
  doUpdate(item: EventRow): void {
    const result = updateDataSourceItem(
      this.dataSource.data, item, this.itemId, undefined, true);
    if (result.updated) {
      this.dataSource.data = result.data;
      this.table.renderRows();
      this.dataState.update(state => addModifyChangeToState(state, item.id));
    }
  }
  private doDelete(item: EventRow): void {
    const result = deleteDataSourceItem(this.dataSource.data, item, this.itemId);
    if (result.deleted) {
      this.dataSource.data = result.data;
      this.table.renderRows();
      this.dataState.update(state => addDeleteChangeToState(state, item, this.itemId));
      this.selectedItem.set(undefined);
    }
  }

  private doSave(): void {
    this.isSaving.set(true);
    doSaveData(
      this.dataSource.data, this.itemId, this.dataState(),
      (item: EventRow) => this.dataService.addEventRow(item),
      (item: EventRow) => this.dataService.updateEventRow(item),
      (item: EventRow) => this.dataService.removeEventRow(item)).subscribe({
        next: result => {
          this.isSaving.set(false);
          this.dataSource.data = result.data;
          //this.table.renderRows();
          this.dataState.set(result.changes);
          if (result.success) {
            this.notificationService.success('Все изменения сохранены успешно');
          } else {
            const errorsMsg = result.errors.map(e => `Запись ${e.id}: ${e.message}`).join('\n');
            this.notificationService.error(`Ошибки при сохранении:\n${errorsMsg}`);
          }
        },
        error: err => {
          this.isSaving.set(false);
          console.error('Неожиданная ошибка:', err);
          this.error.set('Не удалось сохранить изменения');
        }
      })

  }
}