import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganizationItemDto, OrganizationListDto } from '../models/admin-main.models';
import { UserListItemDto } from '@mon3/sa';


@Injectable({
  providedIn: 'root'
})
export class AdminAccessService {
  private http = inject(HttpClient);
  private adminApiUrl = '';
  private readonly ACCESS_CONTROLLER: string = '/access';

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }

  // ============================================================
  // Организации
  // ============================================================

  getOrganizations(): Observable<OrganizationListDto[]> {
    return this.http.get<OrganizationListDto[]>(`${this.adminApiUrl}${this.ACCESS_CONTROLLER}/organizations`);
  }

  getOrganization(id: string): Observable<OrganizationItemDto> {
    return this.http.get<OrganizationItemDto>(`${this.adminApiUrl}${this.ACCESS_CONTROLLER}/organizations/${id}`);
  }

  addOrganization(data: OrganizationListDto): Observable<OrganizationListDto> {
    return this.http.post<OrganizationListDto>(`${this.adminApiUrl}${this.ACCESS_CONTROLLER}/organizations`, data);
  }

  updateOrganization(id: string, data: OrganizationItemDto): Observable<OrganizationItemDto> {
    return this.http.put<OrganizationItemDto>(`${this.adminApiUrl}${this.ACCESS_CONTROLLER}/organizations/${id}`, data);
  }

  deleteOrganization(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminApiUrl}${this.ACCESS_CONTROLLER}/organizations/${id}`);
  }

  getUsersList(): Observable<UserListItemDto[]> {
    return this.http.get<UserListItemDto[]>(`${this.adminApiUrl}${this.ACCESS_CONTROLLER}/users`);
  }
}