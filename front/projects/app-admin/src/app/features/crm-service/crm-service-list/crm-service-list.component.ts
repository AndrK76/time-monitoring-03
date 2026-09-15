import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ErrorResponseResult, processResponseError } from '@mon3/sa';
import { CrmStructManageService } from '../../../services/crm-struct-manage.service';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { YcServiceListComponent } from '../../yclients/yc-service-list/yc-service-list.component';
import { CrmAgentItemView, CrmAgentTypeView } from '../../crm-agent/crm-agent-view.models';
import { crmAgentItemDtoToView, crmAgentTypeDtoToView } from '../../crm-agent/crm-agent-view.utils';
import { NotificationService } from '@mon3/sc';
import { CrmServiceActionsService } from '../crm-service-actions.service';

@Component({
  selector: 'app-crm-service-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatProgressSpinnerModule, MatSelectModule, MatTooltipModule,
    YcServiceListComponent,
  ],
  providers: [CrmServiceActionsService],
  templateUrl: './crm-service-list.component.html',
  styleUrl: './crm-service-list.component.scss'
})
export class CrmServiceListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);
  private readonly crmService = inject(CrmStructManageService);
  private readonly mainStructService = inject(MainStructManageService);
  readonly actions = inject(CrmServiceActionsService);

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});

  orgId = signal<string | undefined>(undefined);
  agent = signal<CrmAgentItemView | undefined>(undefined);
  isSelectingAgent = signal<boolean>(false);
  showBackLink = signal<boolean>(false);
  organizations = signal<OrgStructInfo[]>([]);
  agentTypes = signal<CrmAgentTypeView[]>([]);

  orgSelect = new FormControl<string | undefined>(undefined);

  readonly agentPage = ['/', 'struct', 'org'];

  orgName = computed(() => {
    const id = this.orgId();
    if (!id) return '';
    const org = this.organizations().find(o => o.id === id);
    return org ? 'для ' + org.shortName : '';
  });

  ngOnInit(): void {
    const orgParam = this.route.snapshot.queryParamMap.get('org') ?? undefined;
    this.showBackLink.set(!!orgParam);
    this.orgId.set(orgParam);

    if (orgParam) {
      this.loadAgent(orgParam);
    } else {
      this.loadOrganizations();
    }
  }

  private loadOrganizations(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    forkJoin({
      organizations: this.mainStructService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto)))
      ),
      types: this.crmService.getAgentTypes().pipe(
        map(list => list.map(dto => crmAgentTypeDtoToView(dto)))
      ),
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ organizations, types }) => {
        this.organizations.set(organizations);
        this.agentTypes.set(types);
      },
      error: err => this.processError(err, false),
    });
  }

  private loadAgent(orgId: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    forkJoin({
      organizations: this.mainStructService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto)))
      ),
      types: this.crmService.getAgentTypes().pipe(
        map(list => list.map(dto => crmAgentTypeDtoToView(dto)))
      ),
    }).pipe(
      switchMap(({ organizations, types }) => {
        this.organizations.set(organizations);
        this.agentTypes.set(types);
        return this.crmService.getAgentsByOrganization(orgId).pipe(
          switchMap(agents => agents.length
            ? this.crmService.getAgentById(agents[0].id)
            : of(undefined)),
          map(dto => dto ? crmAgentItemDtoToView(dto, types, organizations) : undefined)
        );
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: agent => this.processAgent(agent),
      error: err => this.processError(err, true),
    });
  }

  private processAgent(agent: CrmAgentItemView | undefined): void {
    if (!agent) {
      this.processError({ message: 'Агент для организации не найден' }, true);
      return;
    }
    if (agent.agentType !== 'YClients') {
      this.processError({ message: `Неизвестный тип агента: ${agent.agentType}` }, true);
      return;
    }
    this.applyAgent(agent);
  }

  /** Единственная точка, где обновляется агент и триггерится загрузка услуг */
  private applyAgent(agent: CrmAgentItemView): void {
    this.agent.set(agent);
    this.actions.triggerReload(agent.id);
  }

  private processError(err: any, redirect: boolean): void {
    const resError = processResponseError(err);
    this.hasError.set(true);
    this.error.set(resError);
    this.isLoading.set(false);
    if (redirect) {
      setTimeout(() => {
        this.router.navigate(this.agentPage, { queryParams: { id: this.orgId() } });
      }, 1500);
    }
  }

  onSelectOrganization(orgId: string | undefined): void {
    if (!orgId) return;
    if (this.isSelectingAgent()) return;

    this.isSelectingAgent.set(true);

    this.crmService.getAgentsByOrganization(orgId).pipe(
      switchMap(agents => agents.length
        ? this.crmService.getAgentById(agents[0].id)
        : of(undefined)),
      map(dto => dto
        ? crmAgentItemDtoToView(dto, this.agentTypes(), this.organizations())
        : undefined),
      finalize(() => this.isSelectingAgent.set(false))
    ).subscribe({
      next: agent => {
        if (!agent) {
          this.notificationService.error('Агент для выбранной организации не найден');
          return;
        }
        if (agent.agentType !== 'YClients') {
          this.notificationService.error(`Неизвестный тип агента: ${agent.agentType}`);
          return;
        }
        this.orgId.set(orgId);
        this.applyAgent(agent);
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка загрузки агента: ${resError.message}`);
      },
    });
  }
}