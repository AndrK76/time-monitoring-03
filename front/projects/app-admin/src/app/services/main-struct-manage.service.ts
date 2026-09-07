import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { OrgStructListDto } from '@mon3/sc';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MainStructManageService {
  private http = inject(HttpClient);

  private adminApiUrl = '';
  private readonly MAIN_DICT_CONTROLLER: string = '/dict';

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }


  // ============================================================
  // Организации
  // ============================================================

  getOrganizations(): Observable<OrgStructListDto[]> {
    return this.http.get<OrgStructListDto[]>(`${this.adminApiUrl}${this.MAIN_DICT_CONTROLLER}/org`);
  }

  getOrganization(id: string): Observable<OrgStructListDto> {
    return this.http.get<OrgStructListDto>(`${this.adminApiUrl}${this.MAIN_DICT_CONTROLLER}/org/${id}`);
  }

  updateOrganization(id: string, data: OrgStructListDto) {
    return this.http.post<OrgStructListDto>(`${this.adminApiUrl}${this.MAIN_DICT_CONTROLLER}/org/${id}`, data);
  }
}
