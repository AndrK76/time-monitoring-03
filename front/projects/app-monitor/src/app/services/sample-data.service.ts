import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { delay, map, Observable, of, tap } from 'rxjs';
import { EventData, EventStatus, Place, PlaceEvents, SampleData } from '../models/sample-data-model';
import { EventRow } from '../features/event-row';
import { toUtcDateStringAlways } from '@mon3/sc';

@Injectable({
  providedIn: 'root'
})
export class SampleDataService {

  private http = inject(HttpClient);
  private readonly SPLIT_DATA_URL = '/sample_split_data.json';
  private readonly NOSPLIT_DATA_URL = '/sample-nosplit-data.json';

  // Ключи для localStorage
  private readonly STORAGE_PLACES = 'sampleData_places';
  private readonly STORAGE_STATUSES = 'sampleData_statuses';
  private readonly STORAGE_PLACE_EVENTS = 'sampleData_placeEvents';

  // Кеш данных
  private placesCache: Place[] | null = null;
  private statusesCache: EventStatus[] | null = null;
  private placeEventsCache: PlaceEvents[] | null = null;
  private dataLoaded = false;

  constructor() {
    this.loadCacheFromStorage();
  }

  // ------------------------------------------------------------
  // Методы для работы с диаграммой
  // ------------------------------------------------------------
  getData(split: boolean): Observable<SampleData> {
    const url = split ? this.SPLIT_DATA_URL : this.NOSPLIT_DATA_URL;
    return this.http.get<SampleData>(url);
  }


  // ------------------------------------------------------------
  //Методы для работы с таблицей
  // ------------------------------------------------------------

  // Работа с localStorage
  private loadCacheFromStorage(): void {
    try {
      const places = localStorage.getItem(this.STORAGE_PLACES);
      const statuses = localStorage.getItem(this.STORAGE_STATUSES);
      const placeEvents = localStorage.getItem(this.STORAGE_PLACE_EVENTS);

      if (places && statuses && placeEvents) {
        this.placesCache = JSON.parse(places);
        this.statusesCache = JSON.parse(statuses);
        this.placeEventsCache = JSON.parse(placeEvents);
        this.dataLoaded = true;
        console.log('Cache loaded from localStorage');
      }
    } catch (e) {
      console.warn('Failed to load cache from localStorage:', e);
    }
  }

  private saveCacheToStorage(): void {
    if (Math.random() < 0.25) {
      throw new Error('Simulated save error (random)');
    }
    if (this.placesCache) {
      localStorage.setItem(this.STORAGE_PLACES, JSON.stringify(this.placesCache));
    }
    if (this.statusesCache) {
      localStorage.setItem(this.STORAGE_STATUSES, JSON.stringify(this.statusesCache));
    }
    if (this.placeEventsCache) {
      localStorage.setItem(this.STORAGE_PLACE_EVENTS, JSON.stringify(this.placeEventsCache));
    }
  }


  // Приватный метод загрузки данных в кеш (если ещё не загружены)
  private ensureDataLoaded(): Observable<boolean> {
    if (this.dataLoaded) {
      return of(true).pipe(delay(1000));;
    }
    return this.getData(false).pipe(
      tap(data => {
        this.placesCache = data.places;
        this.statusesCache = data.statuses;
        this.placeEventsCache = data.content.flatMap(item => item.group.bars);
        this.dataLoaded = true;
        this.saveCacheToStorage();
      }),
      delay(1000),
      map(() => true)
    );
  }

  // Методы выборки (с кешированием)
  getPlaces(): Observable<Place[]> {
    return this.ensureDataLoaded().pipe(
      map(() => {
        if (!this.placesCache) {
          throw new Error('Places cache not initialized (500)');
        }
        return this.placesCache;
      })
    );
  }

  getStatuses(): Observable<EventStatus[]> {
    return this.ensureDataLoaded().pipe(
      map(() => {
        if (!this.statusesCache) {
          throw new Error('Statuses cache not initialized (500)');
        }
        return this.statusesCache;
      })
    );
  }

  getPlaceEvents(): Observable<PlaceEvents[]> {
    return this.ensureDataLoaded().pipe(
      map(() => {
        if (!this.placeEventsCache) {
          throw new Error('PlaceEvents cache not initialized (500)');
        }
        return this.placeEventsCache.map(pm => {
          let ret = { ...pm };
          ret.events = ret.events.map(e => {
            let eRet = { ...e };
            if (eRet.start) eRet.start = toUtcDateStringAlways(eRet.start);
            if (eRet.end) eRet.end = toUtcDateStringAlways(eRet.end);
            return eRet;
          })
          return ret;
        })
        //return [];
      })
    );
  }


  // ------------------------------------------------------------
  // Методы модификации (работают с локальным кешем)
  // ------------------------------------------------------------
  updateEventRow(event: EventRow): Observable<EventRow> {
    return this.ensureDataLoaded().pipe(
      map(() => {
        if (!this.placeEventsCache) {
          throw new Error('Data cache not initialized (500)');
        }
        const placeEvents = this.placeEventsCache.find(pe => pe.place === event.placeId);
        if (!placeEvents) {
          throw new Error(`Place ${event.placeId} not found (404)`);
        }
        const evtIndex = placeEvents.events.findIndex(e => e.id === event.id);
        if (evtIndex === -1) {
          throw new Error(`Event ${event.id} not found (404)`);
        }
        const existing = placeEvents.events[evtIndex];
        existing.start = event.start;
        existing.end = event.end;
        existing.status = event.statusCode;
        existing.booking_id = event.booking_id;
        this.saveCacheToStorage();
        return event;
      }
      ), delay(500));
  }

  addEventRow(event: EventRow): Observable<EventRow> {
    return this.ensureDataLoaded().pipe(
      map(() => {
        if (!this.placeEventsCache) {
          throw new Error('Data cache not initialized (500)');
        }
        const newId = crypto.randomUUID ? crypto.randomUUID() : this.generateFallbackUUID();
        const newEventData: EventData = {
          id: newId,
          start: event.start,
          end: event.end,
          status: event.statusCode,
          booking_id: event.booking_id
        };
        let placeEvents = this.placeEventsCache.find(pe => pe.place === event.placeId);
        if (!placeEvents) {
          placeEvents = { place: event.placeId, events: [] };
          this.placeEventsCache.push(placeEvents);
        }
        console.log(placeEvents);
        placeEvents.events.push(newEventData);
        console.log(placeEvents);
        this.saveCacheToStorage();
        return { ...event, id: newId };
      }), delay(500)
    );
  }

  removeEventRow(event: EventRow): Observable<void> {
    return this.ensureDataLoaded().pipe(
      map(() => {
        if (!this.placeEventsCache) {
          throw new Error('Data cache not initialized (500)');
        }
        const placeEvents = this.placeEventsCache.find(pe => pe.place === event.placeId);
        if (!placeEvents) {
          throw new Error(`Place ${event.placeId} not found (404)`);
        }
        const index = placeEvents.events.findIndex(e => e.id === event.id);
        if (index === -1) {
          throw new Error(`Event ${event.id} not found (404)`);
        }
        placeEvents.events.splice(index, 1);
        if (placeEvents.events.length === 0) {
          const idx = this.placeEventsCache.indexOf(placeEvents);
          if (idx !== -1) this.placeEventsCache.splice(idx, 1);
        }
        this.saveCacheToStorage();
      }), delay(500)
    );
  }

  private generateFallbackUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}