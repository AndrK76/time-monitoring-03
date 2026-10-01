import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
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
import { finalize, forkJoin, map } from 'rxjs';
import { ErrorResponseResult, PermissionService, processResponseError } from '@mon3/sa';
import { SizeService, TableActionsInformerService } from '@mon3/sc';

import { ImgStructManageService } from '../../../../services/img-struct-manage.service';
import { MainStructManageService } from '../../../../services/main-struct-manage.service';
import { OrgStructInfo } from '../../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../../struct-org/struct-org-view.utils';
import { ImgAgentItemView, ImgAgentTypeView } from '../../img-view.models';
import { imgAgentListDtoToView, imgAgentTypeDtoToView } from '../../img-view.utils';
import { MacroscopPlaceListComponent } from '../../../macroscop/macroscop-place-list/macroscop-place-list.component';
import { authConstant } from '../../../../auth-constants';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-img-place-list-header',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatProgressSpinnerModule, MatSelectModule, MatTooltipModule,
    MatCheckboxModule,
    MacroscopPlaceListComponent,
  ],
  providers: [TableActionsInformerService],
  templateUrl: './img-place-list-header.component.html',
  styleUrl: './img-place-list-header.component.scss'
})
export class ImgPlaceListHeaderComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly imgService = inject(ImgStructManageService);
  private readonly mainStructService = inject(MainStructManageService);
  private readonly permissionService = inject(PermissionService);
  private readonly sizeService = inject(SizeService);
  readonly actions = inject(TableActionsInformerService);

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});

  orgId = signal<string | undefined>(undefined);
  agents = signal<ImgAgentItemView[]>([]);
  selectedAgent = signal<ImgAgentItemView | undefined>(undefined);
  showBackLink = signal<boolean>(false);

  canFullActions = signal(false);
  showDeleted = signal(false);

  organizations = signal<OrgStructInfo[]>([]);
  agentTypes = signal<ImgAgentTypeView[]>([]);

  orgSelect = new FormControl<string | undefined>(undefined);
  agentSelect = new FormControl<string | undefined>(undefined);

  readonly agentPage = ['/', 'struct', 'org'];

  orgName = computed(() => {
    const id = this.orgId();
    if (!id) return '';
    const org = this.organizations().find(o => o.id === id);
    return org ? 'для ' + org.shortName : '';
  });
  agentSelectDisabled = computed(() => this.agents().length <= 1);
  isSmallScreen = this.sizeService.isSmallScreen;


  constructor() {
    effect(() => {
      const shouldDisable = this.agentSelectDisabled();
      if (shouldDisable) this.agentSelect.disable({ emitEvent: false });
      else this.agentSelect.enable({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.canFullActions.set(this.permissionService.checkPermissions(authConstant('imgPlaceAllActions')));
    const orgParam = this.route.snapshot.queryParamMap.get('org') ?? undefined;
    const idParam = this.route.snapshot.queryParamMap.get('id') ?? undefined;
    this.showBackLink.set(!!orgParam);
    this.orgId.set(orgParam);
    this.orgSelect.setValue(orgParam ?? null);
    this.sizeService.breakpointsSubscribe();

    if (orgParam) {
      this.loadInitial(orgParam, idParam);
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
        map(list => list.map(dto => orgStructListDtoToView(dto)))),
      types: this.imgService.getAgentTypes().pipe(
        map(list => list.map(dto => imgAgentTypeDtoToView(dto)))),
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

  private loadInitial(orgId: string, agentId: string | undefined): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    forkJoin({
      organizations: this.mainStructService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto)))),
      types: this.imgService.getAgentTypes().pipe(
        map(list => list.map(dto => imgAgentTypeDtoToView(dto)))),
      agents: this.imgService.getAgentsByOrganization(orgId),
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ organizations, types, agents }) => {
        this.organizations.set(organizations);
        this.agentTypes.set(types);

        const agentViews = agents.map(dto =>
          imgAgentListDtoToView(dto, types, organizations));
        this.agents.set(agentViews);

        const target = agentId
          ? agentViews.find(a => a.id === agentId)
          : agentViews.at(0);
        if (target) this.applyAgent(target);
      },
      error: err => this.processError(err, true),
    });
  }

  onSelectOrganization(orgId: string | undefined): void {
    this.agents.set([]);
    this.selectedAgent.set(undefined);
    this.agentSelect.setValue(null);

    if (!orgId) {
      this.orgId.set(undefined);
      return;
    }
    this.orgId.set(orgId);
    this.loadAgentsForOrg(orgId);
  }

  private loadAgentsForOrg(orgId: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    this.imgService.getAgentsByOrganization(orgId).pipe(
      map(list => list.map(dto =>
        imgAgentListDtoToView(dto, this.agentTypes(), this.organizations()))),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: agents => {
        this.agents.set(agents);
        if (agents.length > 0) this.applyAgent(agents[0]);
      },
      error: err => this.processError(err, false),
    });
  }

  onSelectAgent(agentId: string | undefined): void {
    if (!agentId) {
      this.selectedAgent.set(undefined);
      return;
    }
    const agent = this.agents().find(a => a.id === agentId);
    if (agent) this.applyAgent(agent);
  }

  private applyAgent(agent: ImgAgentItemView): void {
    this.selectedAgent.set(agent);
    this.agentSelect.setValue(agent.id);
    this.actions.triggerReload(agent.id);
  }

  onShowDeletedChange(checked: boolean): void {
    this.showDeleted.set(checked);
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
}