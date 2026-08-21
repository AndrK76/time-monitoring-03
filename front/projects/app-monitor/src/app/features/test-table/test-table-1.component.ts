import { Component, inject, OnInit, signal, ViewChild, ViewEncapsulation } from '@angular/core';
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
import { EventRow } from '../event-row';


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
    EventsEditorInplaceComponent
  ],
  templateUrl: './test-table-1.component.html',
  styleUrl: './test-table-1.component.scss',
})
export class TestTable1Component implements OnInit {
  private dataService = inject(SampleDataService);

  places = signal<Place[]>([]);
  statuses = signal<EventStatus[]>([]);
  //eventRows = signal<EventRow[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  @ViewChild(MatTable) table!: MatTable<EventRow>;
  displayedColumns = ['expand', 'placeName', 'statusName', 'start', 'end', 'booking_id', 'details'];
  dataSource = new MatTableDataSource<EventRow>([]);


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
              if (evt.status === 'empty') return;
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

          //this.eventRows.set(rows);
          this.dataSource.data = rows;
        }
      });
  }

  refreshData(): void {
    this.loadEvents();
  }

  toggleRow(row: any): void {
    const updatedRows = this.dataSource.data.map(r => {
      const rowAny = r as any;
      if (rowAny.id === row.id) {
        const expanded = rowAny._expanded === undefined ? true : !rowAny._expanded;
        return { ...r, _expanded: expanded };
      }
      return r;
    });
    this.dataSource.data = updatedRows;
  }

  isExpanded = (index: number, row: any): boolean => {
    return (row as any)._expanded === true;
  }

  // test-table.component.ts
  updateEvent(updatedEvent: EventRow): void {
    const index = this.dataSource.data.findIndex(e => e.id === updatedEvent.id);
    if (index === -1) return;

    // Получаем справочники
    const placesMap = new Map(this.places().map(p => [p.id, p.name]));
    const statusesMap = new Map(this.statuses().map(s => [s.code, s]));

    // Пересчитываем имена и цвета
    const placeName = placesMap.get(updatedEvent.placeId) || updatedEvent.placeId;
    const status = statusesMap.get(updatedEvent.statusCode);
    const statusName = status?.name || updatedEvent.statusCode;
    const statusColor = status?.color;

    // Формируем обновлённую строку
    const newRow: EventRow = {
      ...updatedEvent,
      placeName,
      statusName,
      statusColor,
      details: `Место: ${placeName} | Статус: ${statusName} | ${updatedEvent.start.replace('T', ' ').slice(0, 16)} – ${updatedEvent.end.replace('T', ' ').slice(0, 16)} | ID: ${updatedEvent.booking_id || '—'}`
    };

    // Обновляем dataSource
    const newData = [...this.dataSource.data];
    newData[index] = newRow;
    this.dataSource.data = newData;
    this.table.renderRows();
  }

}