import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
    EvtAgentConfigDto,
    EvtAgentItemDto,
    EvtAgentListDto,
    EvtAgentTypeDto,
} from '@mon3/sc';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EvtStructManageService {
    private http = inject(HttpClient);

    private adminApiUrl = '';
    private readonly EVT_CONTROLLER: string = '/evt';

    setAdminApiUrl(url: string): void {
        this.adminApiUrl = url;
    }

    // ============================================================
    // Типы агентов событий
    // ============================================================

    getAgentTypes(): Observable<EvtAgentTypeDto[]> {
        return this.http.get<EvtAgentTypeDto[]>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/types`);
    }

    // ============================================================
    // Агенты событий
    // ============================================================

    getAllAgents(): Observable<EvtAgentListDto[]> {
        return this.http.get<EvtAgentListDto[]>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents`);
    }

    getAgentsByOrganization(orgId: string): Observable<EvtAgentListDto[]> {
        return this.http.get<EvtAgentListDto[]>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents?org=${orgId}`);
    }

    getAgentsByOrganizationWithUnbounded(orgId: string): Observable<EvtAgentListDto[]> {
        return this.http.get<EvtAgentListDto[]>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents?org=${orgId}&with_unbounded`);
    }

    getAgentById(id: string): Observable<EvtAgentItemDto> {
        return this.http.get<EvtAgentItemDto>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents/${id}`);
    }

    addAgent(agent: EvtAgentListDto): Observable<EvtAgentItemDto> {
        return this.http.post<EvtAgentItemDto>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents`, agent);
    }

    updateAgent(agent: EvtAgentItemDto): Observable<EvtAgentItemDto> {
        return this.http.put<EvtAgentItemDto>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents/${agent.id}`, agent);
    }

    deleteAgentsById(id: string): Observable<void> {
        return this.http.delete<void>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents/${id}`);
    }

    unbindAgentFromOrg(id: string): Observable<EvtAgentItemDto> {
        return this.http.put<EvtAgentItemDto>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents/${id}/unbind`, null);
    }

    bindAgentToOrg(id: string, orgId: string): Observable<EvtAgentItemDto> {
        return this.http.put<EvtAgentItemDto>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/agents/${id}/bind?org=${orgId}`, null);
    }

    // ============================================================
    // Конфигурация агента событий
    // ============================================================

    getAgentConfig(id: string): Observable<EvtAgentConfigDto> {
        return this.http.get<EvtAgentConfigDto>(
            `${this.adminApiUrl}${this.EVT_CONTROLLER}/configs/${id}`);
    }
}