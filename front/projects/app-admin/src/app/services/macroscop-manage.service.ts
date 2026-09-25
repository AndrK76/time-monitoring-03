import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  MacroscopAgentConfigDto,
  MacroscopAgentConfigListDto,
  MacroscopDataResponse,
  MacroscopEvtAgentConfigDto,
  MacroscopServerCredentials,
  MacroscopServerInfoDto,
} from '@mon3/sc';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MacroscopManageService {
  private http = inject(HttpClient);

  private adminApiUrl = '';
  private readonly MACROSCOP_CONTROLLER: string = '/macroscop';

  setAdminApiUrl(url: string): void {
    this.adminApiUrl = url;
  }

  getEvtConfig(agentId: string): Observable<MacroscopEvtAgentConfigDto> {
    return this.http.get<MacroscopEvtAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/evt-configs/${agentId}`);
  }

  updateEvtConfig(agentId: string, dto: MacroscopEvtAgentConfigDto)
    : Observable<MacroscopEvtAgentConfigDto> {
    return this.http.put<MacroscopEvtAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/evt-configs/${agentId}`, dto);
  }

  bindEvtConfig(agentId: string, configId: string)
    : Observable<MacroscopEvtAgentConfigDto> {
    return this.http.put<MacroscopEvtAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/evt-configs/${agentId}/bind?cfg=${configId}`,
      null);
  }

  unbindEvtConfig(agentId: string): Observable<MacroscopEvtAgentConfigDto> {
    return this.http.put<MacroscopEvtAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/evt-configs/${agentId}/unbind`,
      null);
  }

  getConfigs(): Observable<MacroscopAgentConfigListDto[]> {
    return this.http.get<MacroscopAgentConfigListDto[]>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs`);
  }


  getConfig(configId: string): Observable<MacroscopAgentConfigDto> {
    return this.http.get<MacroscopAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs/${configId}`);
  }

  newConfig(): Observable<MacroscopAgentConfigDto> {
    return this.http.post<MacroscopAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs`, null);
  }

  updateConfig(configId: string, dto: MacroscopAgentConfigDto)
    : Observable<MacroscopAgentConfigDto> {
    return this.http.put<MacroscopAgentConfigDto>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs/${configId}`, dto);
  }

  deleteConfig(configId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs/${configId}`);
  }
  getServerInfoByCreds(creds: MacroscopServerCredentials): Observable<MacroscopDataResponse<MacroscopServerInfoDto>> {
    return this.http.post<MacroscopDataResponse<MacroscopServerInfoDto>>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/misc/server-info`, creds);
  }

}