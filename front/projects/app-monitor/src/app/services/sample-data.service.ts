import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SampleData } from '../models/sample-data-model';

@Injectable({
  providedIn: 'root'
})
export class SampleDataService {

  private http = inject(HttpClient);

  getData(split: boolean): Observable<SampleData> {
    const url = split
      ? '/sample_split_data.json'
      : '/sample-nosplit-data.json';
    return this.http.get<SampleData>(url);
  }
}
