import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { YClientsAgentConfigDto, YClientsDataResponseDto, YClientsOrganizationDto, YClientsPlaceDto, YClientsServiceCategoryDto, YClientsServiceDto, YClientsTokenRequestDto, YClientsTokenResponseDto } from '@mon3/sc';
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

  getServiceCategoriesForAgent(id: string): Observable<YClientsServiceCategoryDto[]> {
    return this.http.get<YClientsServiceCategoryDto[]>(`${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/service-categories`);
  }

  updateServiceCategoriesForAgent(id: string, data: YClientsServiceCategoryDto[]): Observable<YClientsServiceCategoryDto[]> {
    return this.http.put<YClientsServiceCategoryDto[]>(`${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/service-categories`, data);
  }

  getAllowedOrganizationsForAgent(id: string): Observable<YClientsDataResponseDto<YClientsOrganizationDto[]>> {
    return this.http.get<YClientsDataResponseDto<YClientsOrganizationDto[]>>(`${this.adminApiUrl}${this.YC_CONTROLLER}/misc/agent/${id}/allowed-orgs`);
  }

  getAllowedServiceCategories(id: string, orgId?: number): Observable<YClientsDataResponseDto<YClientsServiceCategoryDto[]>> {
    return this.http.get<YClientsDataResponseDto<YClientsServiceCategoryDto[]>>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/misc/agent/${id}/org/${orgId}/service-categories`);
  }

  getServicesForAgent(id: string): Observable<YClientsServiceDto[]> {
    return this.http.get<YClientsServiceDto[]>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/services`);
  }

  addServiceForAgent(id: string, data: YClientsServiceDto): Observable<YClientsServiceDto> {
    return this.http.post<YClientsServiceDto>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/services`, data);
  }

  updateServiceForAgent(id: string, serviceId: string, data: YClientsServiceDto): Observable<YClientsServiceDto> {
    return this.http.put<YClientsServiceDto>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/services/${serviceId}`, data);
  }

  deleteServiceForAgent(id: string, serviceId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/services/${serviceId}`);
  }

  getAllowedServices(id: string): Observable<YClientsDataResponseDto<YClientsServiceDto[]>> {
    return this.http.get<YClientsDataResponseDto<YClientsServiceDto[]>>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/misc/agent/${id}/services`);
  }

  getPlacesForAgent(id: string): Observable<YClientsPlaceDto[]> {
    return this.http.get<YClientsPlaceDto[]>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/places`);
  }

  addPlaceForAgent(id: string, data: YClientsPlaceDto): Observable<YClientsPlaceDto> {
    return this.http.post<YClientsPlaceDto>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/places`, data);
  }

  updatePlaceForAgent(id: string, placeId: string, data: YClientsPlaceDto): Observable<YClientsPlaceDto> {
    return this.http.put<YClientsPlaceDto>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/places/${placeId}`, data);
  }

  deletePlaceForAgent(id: string, placeId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/agents/${id}/places/${placeId}`);
  }

  getAllowedPlaces(id: string): Observable<YClientsDataResponseDto<YClientsPlaceDto[]>> {
    return this.http.get<YClientsDataResponseDto<YClientsPlaceDto[]>>(
      `${this.adminApiUrl}${this.YC_CONTROLLER}/misc/agent/${id}/places`);
  }

}
