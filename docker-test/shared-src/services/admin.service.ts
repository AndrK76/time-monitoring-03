import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TestResponse } from '../models/auth.models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private adminApiUrl = '';

  setApiUrl(url: string): void {
    this.adminApiUrl = url;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': this.authService.getAuthHeader()
    });
  }

  getPublic(): Observable<TestResponse> {
    return this.http.get<TestResponse>(`${this.adminApiUrl}/test/public`);
  }

  getAuthenticated(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/authenticated`,
      { headers: this.getHeaders() }
    );
  }

  approveDeviation(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/deviation/approve`,
      { headers: this.getHeaders() }
    );
  }

  systemAdminOnly(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/admin/system`,
      { headers: this.getHeaders() }
    );
  }

  orgAdminOnly(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/admin/org`,
      { headers: this.getHeaders() }
    );
  }

  dispatcherOnly(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/dispatcher`,
      { headers: this.getHeaders() }
    );
  }

  dispatcherWithApprove(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/dispatcher/approve`,
      { headers: this.getHeaders() }
    );
  }

  getMyPermissions(): Observable<TestResponse> {
    return this.http.get<TestResponse>(
      `${this.adminApiUrl}/test/my-permissions`,
      { headers: this.getHeaders() }
    );
  }
}