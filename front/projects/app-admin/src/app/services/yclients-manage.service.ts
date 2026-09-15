import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { YClientsAgentConfigDto, YClientsDataResponseDto, YClientsOrganizationDto, YClientsServiceCategoryListDto, YClientsTokenRequestDto, YClientsTokenResponseDto } from '@mon3/sc';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class YclientsManageService {
  private http = inject(HttpClient);

  private adminApiUrl = '';
  private readonly YC_CONTROLLER: string = '/yc';

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }

  getAgentConfig(id: string): Observable<YClientsAgentConfigDto> {
    return this.http.get<YClientsAgentConfigDto>(`${this.adminApiUrl}${this.YC_CONTROLLER}/configs/${id}`);
  }

  updateAgentConfig(id: string, data: YClientsAgentConfigDto): Observable<YClientsAgentConfigDto> {
    return this.http.put<YClientsAgentConfigDto>(`${this.adminApiUrl}${this.YC_CONTROLLER}/configs/${id}`, data);
  }

  getClientToken(request: YClientsTokenRequestDto): Observable<YClientsTokenResponseDto> {
    return this.http.post<YClientsTokenResponseDto>(`${this.adminApiUrl}${this.YC_CONTROLLER}/misc/get-token`, request);
  }

  getOrganizationForAgent(id: string): Observable<YClientsOrganizationDto> {
    return this.http.get<YClientsOrganizationDto>(`${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/organization`);
  }

  updateOrganizationForAgent(id: string, data: YClientsOrganizationDto): Observable<YClientsOrganizationDto> {
    return this.http.put<YClientsOrganizationDto>(`${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/organization`, data);
  }

  getServiceCategoriesForAgent(id: string): Observable<YClientsServiceCategoryListDto[]> {
    return this.http.get<YClientsServiceCategoryListDto[]>(`${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/service-categories`);
  }

  updateServiceCategoriesForAgent(id: string, data: YClientsServiceCategoryListDto[]): Observable<YClientsServiceCategoryListDto[]> {
    return this.http.put<YClientsServiceCategoryListDto[]>(`${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/service-categories`, data);
  }

  getAllowedOrganizationsForAgent(id: string): Observable<YClientsDataResponseDto<YClientsOrganizationDto[]>> {
    return this.http.get<YClientsDataResponseDto<YClientsOrganizationDto[]>>(`${this.adminApiUrl}${this.YC_CONTROLLER}/misc/agent/${id}/allowed-orgs`);
  }

  getAllowedServiceCategories(id: string, orgId?: number): Observable<YClientsDataResponseDto<YClientsServiceCategoryListDto[]>> {
    return this.http.get<YClientsDataResponseDto<YClientsServiceCategoryListDto[]>>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/misc/agent/${id}/org/${orgId}/service-categories`);
  }


}
