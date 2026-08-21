import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SampleDataService } from '../../services/sample-data.service';
import { Place, EventStatus, PlaceEvents, EventData } from '../../models/sample-data-model';
import { catchError, finalize, forkJoin, Observable, of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

export interface EventRow {
  placeId: string;
  placeName: string;
  statusCode: string;
  statusName: string;
  statusColor?: string;
  start: string;
  end: string;
  booking_id?: string;
  details: string; // длинная "мусорная" колонка
}

@Component({
  selector: 'app-test-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './test-table.component.html',
  styleUrl: './test-table.component.scss',
  //encapsulation: ViewEncapsulation.None
})
export class TestTableComponent implements OnInit {
  private dataService = inject(SampleDataService);

  places = signal<Place[]>([]);
  statuses = signal<EventStatus[]>([]);
  eventRows = signal<EventRow[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  displayedColumns = ['placeName', 'statusName', 'start', 'end', 'booking_id', 'details'];

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

          this.eventRows.set(rows);
        }
      });
  }

  refreshData(): void {
    this.loadEvents();
  }
}