import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ImgAgentConfigDto,
  ImgAgentItemDto,
  ImgAgentListDto,
  ImgAgentTypeDto,
} from '@mon3/sc';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImgStructManageService {
  private http = inject(HttpClient);

  private adminApiUrl = '';
  private readonly IMG_CONTROLLER: string = '/img';

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }

  getAgentTypes(): Observable<ImgAgentTypeDto[]> {
    return this.http.get<ImgAgentTypeDto[]>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/types`);
  }

  getAllAgents(): Observable<ImgAgentListDto[]> {
    return this.http.get<ImgAgentListDto[]>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents`);
  }

  getAgentsByOrganization(orgId: string): Observable<ImgAgentListDto[]> {
    return this.http.get<ImgAgentListDto[]>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents?org=${orgId}`);
  }

  getAgentsByOrganizationWithUnbounded(orgId: string): Observable<ImgAgentListDto[]> {
    return this.http.get<ImgAgentListDto[]>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents?org=${orgId}&with_unbounded`);
  }

  getAgentById(id: string): Observable<ImgAgentItemDto> {
    return this.http.get<ImgAgentItemDto>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents/${id}`);
  }

  addAgent(agent: ImgAgentListDto): Observable<ImgAgentItemDto> {
    return this.http.post<ImgAgentItemDto>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents`, agent);
  }

  updateAgent(agent: ImgAgentItemDto): Observable<ImgAgentItemDto> {
    return this.http.put<ImgAgentItemDto>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents/${agent.id}`, agent);
  }

  deleteAgentsById(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents/${id}`);
  }

  unbindAgentFromOrg(id: string): Observable<ImgAgentItemDto> {
    return this.http.put<ImgAgentItemDto>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents/${id}/unbind`, null);
  }

  bindAgentToOrg(id: string, orgId: string): Observable<ImgAgentItemDto> {
    return this.http.put<ImgAgentItemDto>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/agents/${id}/bind?org=${orgId}`, null);
  }

  getAgentConfig(id: string): Observable<ImgAgentConfigDto> {
    return this.http.get<ImgAgentConfigDto>(
      `${this.adminApiUrl}${this.IMG_CONTROLLER}/configs/${id}`);
  }
}