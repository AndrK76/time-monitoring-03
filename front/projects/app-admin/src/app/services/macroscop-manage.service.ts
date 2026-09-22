import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  MacroscopAgentConfigDto,
  MacroscopEvtAgentConfigDto,
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

  // ============================================================
  // Конфигурация Macroscop-Evt-агента (обёртка над общей конфигурацией)
  // ============================================================

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

  // ============================================================
  // Общая конфигурация Macroscop
  // ============================================================

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
}