import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { PermissionDto, RoleDto, TestResponse, UpdateUserRequest, UserListItem, UserResponse } from '../models/auth.models';
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

  getCurrentUser(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.authApiUrl}/usermanage/users/me`, {
      headers: this.getHeaders()
    });
  }

  updateCurrentUser(data: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.authApiUrl}/usermanage/users/me`, data, {
      headers: this.getHeaders()
    });
  }

  getCurrentUserRoles(): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(`${this.authApiUrl}/usermanage/users/me/roles`, {
      headers: this.getHeaders()
    });
  }

  getCurrentUserPermissions(): Observable<PermissionDto[]> {
    return this.http.get<PermissionDto[]>(`${this.authApiUrl}/usermanage/users/me/permissions`, {
      headers: this.getHeaders()
    });
  }

  getUsersList(): Observable<UserListItem[]> {
    return this.http.get<UserListItem[]>(`${this.authApiUrl}/usermanage/users`, {
      headers: this.getHeaders()
    });
  }

  getUserById(userId: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.authApiUrl}/usermanage/users/${userId}`, {
      headers: this.getHeaders()
    });
  }

  updateUser(userId: string, data: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.authApiUrl}/usermanage/users/${userId}`, data, {
      headers: this.getHeaders()
    });
  }

  getUserRoles(userId: string): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(`${this.authApiUrl}/usermanage/users/${userId}/roles`, {
      headers: this.getHeaders()
    });
  }

  getUserPermissions(userId: string): Observable<PermissionDto[]> {
    return this.http.get<PermissionDto[]>(`${this.authApiUrl}/usermanage/users/${userId}/permissions`, {
      headers: this.getHeaders()
    });
  }

  getAllRoles(): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(`${this.authApiUrl}/usermanage/roles`, {
      headers: this.getHeaders()
    });
  }

  getAllPermissions(): Observable<PermissionDto[]> {
    return this.http.get<PermissionDto[]>(`${this.authApiUrl}/usermanage/permissions`, {
      headers: this.getHeaders()
    });
  }

  resetPassword(userId: string): Observable<void> {
    return this.http.put<void>(`${this.authApiUrl}/usermanage/users/${userId}/reset-password`, {}, {
      headers: this.getHeaders()
    });
  }

  setPassword(userId: string, newPassword: string): Observable<void> {
    return this.http.put<void>(
      `${this.authApiUrl}/usermanage/users/${userId}/set-password`,
      { newPassword },
      { headers: this.getHeaders() }
    );
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
