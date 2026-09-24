import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, map, finalize } from 'rxjs';

import { ErrorResponseResult, processResponseError } from '@mon3/sa';
import { EvtAgentConfigDto, EvtAgentListDto } from '@mon3/sc';

import { EvtStructManageService } from '../../../services/evt-struct-manage.service';

@Component({
  selector: 'app-evt-agent-config',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './evt-agent-config.component.html',
  styleUrl: './evt-agent-config.component.scss'
})
export class EvtAgentConfigComponent implements OnInit {

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private dataService = inject(EvtStructManageService);

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});
  config = signal<RequestResult | undefined>(undefined);

  ngOnInit(): void {
    this.initializeData();
  }

  private initializeData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    const idParam = this.route.snapshot.queryParamMap.get('id');
    const orgParam = this.route.snapshot.queryParamMap.get('org');

    let request$: Observable<EvtAgentConfigDto | EvtAgentListDto | null> | undefined;

    if (idParam) {
      request$ = this.dataService.getAgentConfig(idParam);
    } else if (orgParam) {
      request$ = this.dataService.getAgentsByOrganization(orgParam).pipe(
        map(list => list.length > 0 ? list[0] : null)
      );
    }

    if (request$) {
      request$.pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: data => this.processResponse(data),
          error: err => this.processError(err),
        });
    } else {
      this.processResponse(undefined);
    }
  }

  private processError(err: any): void {
    const resError = processResponseError(err);
    this.hasError.set(true);
    this.error.set(resError);
    setTimeout(() => this.processResponse(undefined), 1000);
  }

  private processResponse(res: any): void {
    this.isLoading.set(false);

    if (!res) {
      this.router.navigate(['/', 'evt', 'agent-list']);
      return;
    }

    if (res?.id) this.config.set({ id: res.id, type: this.config()?.type });
    if (res?.agentType) this.config.set({ id: this.config()?.id, type: res.agentType });

    if (this.config()?.type === 'Macroscop') {
      if (this.config()?.id) {
        this.router.navigate(['/', 'macroscop', 'evt', 'config'], { queryParams: { id: this.config()?.id } });
      } else {
        this.error.set({ message: 'Empty agent id' });
        this.hasError.set(true);
        setTimeout(() => this.processResponse(undefined), 1000);
      }
    } else {
      this.error.set({ message: `Unknown agent type: ${this.config()?.type}` });
      this.hasError.set(true);
      setTimeout(() => this.processResponse(undefined), 1000);
    }
  }
}

interface RequestResult {
  id?: string;
  type?: string;
}