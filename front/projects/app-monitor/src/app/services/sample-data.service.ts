import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { EventStatus, Place, PlaceEvents, SampleData } from '../models/sample-data-model';

@Injectable({
  providedIn: 'root'
})
export class SampleDataService {

  private http = inject(HttpClient);
  private readonly SPLIT_DATA_URL = '/sample_split_data.json';
  private readonly NOSPLIT_DATA_URL = '/sample-nosplit-data.json';

  getData(split: boolean): Observable<SampleData> {
    const url = split
      ? this.SPLIT_DATA_URL
      : this.NOSPLIT_DATA_URL;
    return this.http.get<SampleData>(url);
  }

  getPlaces(): Observable<Place[]> {
    return this.http.get<SampleData>(this.NOSPLIT_DATA_URL).pipe(
      map(data => data.places));
  }

  getStatuses(): Observable<EventStatus[]> {
    return this.http.get<SampleData>(this.NOSPLIT_DATA_URL).pipe(
      map(data => data.statuses));
  }

  getPlaceEvents(): Observable<PlaceEvents[]> {
    return this.http.get<SampleData>(this.NOSPLIT_DATA_URL).pipe(
      map(data => data.content.flatMap(item => item.group.bars))
    );
  }

  updatePlaceEvent(event: PlaceEvents): Observable<PlaceEvents> {
    return of(event);
  }

  addPlaceEvents(event: PlaceEvents): Observable<PlaceEvents> {
    return of(event);
  }

  removePlaceEvents(event: PlaceEvents): Observable<void> {
    return of();
  }
}
