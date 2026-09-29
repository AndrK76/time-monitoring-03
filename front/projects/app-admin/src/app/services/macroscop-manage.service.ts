import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  MacroscopAgentConfigDto,
  MacroscopAgentConfigListDto,
  MacroscopArchiveModeDto,
  MacroscopChannelDto,
  MacroscopDataResponse,
  MacroscopEvtAgentConfigDto,
  MacroscopServerCredentials,
  MacroscopServerInfoDto,
  toFailMacroscopDataResponse,
} from '@mon3/sc';
import { catchError, map, Observable } from 'rxjs';

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

  getChannelsForConfig(configId: string): Observable<MacroscopChannelDto[]> {
    return this.http.get<MacroscopChannelDto[]>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs/${configId}/channels`);
  }

  updateChannelsForConfig(configId: string, dto: MacroscopChannelDto[])
    : Observable<MacroscopChannelDto[]> {
    return this.http.put<MacroscopChannelDto[]>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/configs/${configId}/channels`, dto);
  }

  getAllowedChannels(configId: string)
    : Observable<MacroscopDataResponse<MacroscopChannelDto[]>> {
    return this.http.get<MacroscopDataResponse<MacroscopChannelDto[]>>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/misc/configs/${configId}/channels`);
  }

  getArchiveModes(): Observable<MacroscopArchiveModeDto[]> {
    return this.http.get<MacroscopArchiveModeDto[]>(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/misc/archive-modes`);
  }


  getCurrentScreenshot(configId: string, channelId: string): Observable<MacroscopDataResponse<Blob>> {
    return this.getScreenshot$(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/misc/configs/${configId}/channels/${channelId}/current-screenshot`
    );
  }

  getArchiveScreenshot(configId: string, channelId: string): Observable<MacroscopDataResponse<Blob>> {
    return this.getScreenshot$(
      `${this.adminApiUrl}${this.MACROSCOP_CONTROLLER}/misc/configs/${configId}/channels/${channelId}/last-archive-screenshot`
    );
  }


  private getScreenshot$(url: string): Observable<MacroscopDataResponse<Blob>> {
    return this.http.get(url, { responseType: 'blob', observe: 'response' }).pipe(
      map((resp: HttpResponse<Blob>) => ({
        statusCode: resp.status,
        success: true,
        data: resp.body ?? undefined,
      } as MacroscopDataResponse<Blob>)),
      catchError(err => toFailMacroscopDataResponse(err)),
    );
  }

}