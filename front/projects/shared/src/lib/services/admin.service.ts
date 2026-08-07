import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { TestResponse, UpdateUserRequest, UserResponse } from '../models/auth.models';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private http: HttpClient = inject(HttpClient);
  private authService: AuthService = inject(AuthService);

  constructor() { }

  private adminApiUrl = '';
  private authApiUrl = "";

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }

  setAuthApiUrl(url: string): void {
    this.authApiUrl = url;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': this.authService.getAuthHeader()
    });
  }

  // ============================================================
  // Управление пользователями
  // ============================================================

  getAllUsers(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(`${this.authApiUrl}/users`, {
      headers: this.getHeaders()
    });
  }

  getUserById(userId: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.authApiUrl}/users/${userId}`, {
      headers: this.getHeaders()
    });
  }

  getCurrentUser(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.authApiUrl}/users/me`, {
      headers: this.getHeaders()
    });
  }

  updateUser(userId: string, data: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.authApiUrl}/users/${userId}`, data, {
      headers: this.getHeaders()
    });
  }

  updateCurrentUser(data: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.authApiUrl}/users/me`, data, {
      headers: this.getHeaders()
    });
  }


  // ============================================================
  // Прочее
  // ============================================================

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
