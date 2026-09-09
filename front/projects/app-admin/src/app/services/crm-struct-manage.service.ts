import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CrmAgentItemDto, CrmAgentListDto, CrmAgentTypeDto, OrgStructListDto } from '@mon3/sc';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CrmStructManageService {
  private http = inject(HttpClient);

  private adminApiUrl = '';
  private readonly CRM_CONTROLLER: string = '/crm';

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }


  // ============================================================
  // Агенты CRM
  // ============================================================

  getAgentTypes(): Observable<CrmAgentTypeDto[]> {
    return this.http.get<CrmAgentTypeDto[]>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/types`);
  }


  getAllAgents(): Observable<CrmAgentListDto[]> {
    return this.http.get<CrmAgentListDto[]>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents`);
  }

  getAgentsByOrganization(orgId: string): Observable<CrmAgentListDto[]> {
    return this.http.get<CrmAgentListDto[]>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents?org=${orgId}`);
  }
  getAgentsByOrganizationWithUnbounded(orgId: string): Observable<CrmAgentListDto[]> {
    return this.http.get<CrmAgentListDto[]>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents?org=${orgId}&with_unbounded`);
  }

  getAgentById(id: string): Observable<CrmAgentItemDto> {
    return this.http.get<CrmAgentItemDto>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents/${id}`);
  }

  addAgent(agent: CrmAgentListDto): Observable<CrmAgentItemDto> {
    return this.http.post<CrmAgentItemDto>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents`, agent);
  }

  updateAgent(agent: CrmAgentItemDto): Observable<CrmAgentItemDto> {
    return this.http.put<CrmAgentItemDto>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents/${agent.id}`, agent);
  }


  deleteAgentsById(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents/${id}`);
  }

  unbindAgentFromOrg(id: string): Observable<CrmAgentItemDto> {
    return this.http.put<CrmAgentItemDto>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents/${id}/unbind`, null);
  }

  bindAgentToOrg(id: string, orgId: string): Observable<CrmAgentItemDto> {
    return this.http.put<CrmAgentItemDto>(`${this.adminApiUrl}${this.CRM_CONTROLLER}/agents/${id}/bind?org=${orgId}`, null);
  }


}
