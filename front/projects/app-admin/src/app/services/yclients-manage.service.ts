import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { YClientsAgentConfigDto } from '@mon3/sc';
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


}
