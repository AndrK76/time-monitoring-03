import { Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { finalize, forkJoin, map, switchMap, Observable, debounceTime, distinctUntilChanged, of, tap } from 'rxjs';
import { ErrorResponseResult, LoginRequestDto, processResponseError } from '@mon3/sa';
import { YclientsManageService } from '../../../services/yclients-manage.service';
import { CrmStructManageService } from '../../../services/crm-struct-manage.service';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { YClientCredentialsView, YClientsAgentConfigView, YClientsOrganizationView, YClientsServiceCategoryView } from '../yclients-view.models';
import { yClientsAgentConfigDtoFromView, yClientsAgentConfigDtoToView, yClientsOrganizationDtoFromView, yClientsOrganizationDtoPopulate, yClientsOrganizationDtoToView, yClientsServiceCategoryDtoToView, yClientsServiceCategoryFromView } from '../yclients-view.utils';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { DialogService, hasChanges, LoginDialogResult, NotificationService, SizeService, YClientsTokenRequestDto } from '@mon3/sc';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableModule } from '@angular/material/table';
import { YcServiceCategoryListComponent } from './yc-service-category-list/yc-service-category-list.component';
import { CrmAgentItemView, CrmAgentTypeView } from '../../crm/crm-view.models';
import { crmAgentItemDtoToView, crmAgentTypeDtoToView } from '../../crm/crm-view.utils';

@Component({
  selector: 'app-yc-config-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatProgressSpinnerModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatDividerModule, MatCardModule, MatTableModule,
    YcServiceCategoryListComponent,
  ],
  templateUrl: './yc-config-editor.component.html',
  styleUrl: './yc-config-editor.component.scss'
})
export class YcConfigEditorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  private readonly dataService = inject(YclientsManageService);
  private readonly crmService = inject(CrmStructManageService);
  private readonly mainStructService = inject(MainStructManageService);

  private readonly notificationService = inject(NotificationService);
  private readonly sizeService = inject(SizeService);
  private readonly dialogService = inject(DialogService);

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isGetUserToken = signal<boolean>(false);
  isLoadCrmOrgList = signal<boolean>(false);
  isLoadServiceCategories = signal<boolean>(false);
  canLoadCrmOrg = computed(() => {
    if (this.isLoading() || this.isSaving() || this.isLoadCrmOrgList()) return false;
    if (!this.currentConfig()?.credentials.partnerToken || !this.currentConfig()?.credentials.userToken) return false;
    return true;
  });

  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});
  private configId: string | undefined = undefined;

  dataConfig = signal<YClientsAgentConfigView | undefined>(undefined);
  currentConfig = signal<YClientsAgentConfigView | undefined>(undefined);
  currentCrmOrg = signal<YClientsOrganizationView | undefined>(undefined);
  currentServiceCategories = signal<YClientsServiceCategoryView[]>([]);
  private categoriesByOrg: Map<number, YClientsServiceCategoryView[]> = new Map();

  agent = signal<CrmAgentItemView | undefined>(undefined);
  organizations = signal<OrgStructInfo[]>([]);
  agentTypes = signal<CrmAgentTypeView[]>([]);
  lstYcOrgs = signal<YClientsOrganizationView[]>([]);
  curLstYcOrg = signal<YClientsOrganizationView | undefined>(undefined);


  readonly agentPage = ['/', 'crm', 'agent-list'];
  agentIdParams: WritableSignal<Params> = signal({ id: undefined })

  isSmallScreen = this.sizeService.isSmallScreen;
  hasConfigChanged = signal<boolean>(false);
  hasCrmOrgChanged = signal<boolean>(false);
  hasServiceCategoriesChanged = computed(() => {
    const list = this.currentServiceCategories();
    return list.some(c => c.selected !== c.existsNow);
  });

  formConfig!: FormGroup;
  formCrmOrg!: FormGroup;
  private readonly destroyRef = inject(DestroyRef);


  ngOnInit(): void {
    this.sizeService.breakpointsSubscribe();
    this.buildForms();
    this.initializeData();
  }

  private _beforeLoad = () => {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});
  }


  private buildForms(): void {
    this.formConfig = this.fb.group({
      partnerToken: [''],
      userToken: [''],
    });
    this.formCrmOrg = this.fb.group({
      ycId: [{ value: '', disabled: false, readonly: true }],
      name: [{ value: '', disabled: false, readonly: true }],
      timezone: [{ value: '', disabled: false, readonly: true }],
    });
  }

  private listenToChanges(): void {
    this.formConfig.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const cfg = this.dataConfig();
        if (!cfg) {
          this.hasConfigChanged.set(false);
          return;
        }
        const current = {
          partnerToken: values.partnerToken, userToken: values.userToken,
        } as YClientCredentialsView;
        this.hasConfigChanged.set(
          hasChanges<YClientCredentialsView>(cfg.credentials, current));
        if (this.currentConfig() && this.hasConfigChanged()) this.currentConfig.update(v => {
          v!.credentials = current;
          return v;
        });
      });
  }

  private initializeData(): void {
    this._beforeLoad();

    this.configId = this.route.snapshot.queryParamMap.get('id') ?? undefined;
    if (!this.configId) {
      this.processError({ message: 'Empty config id in URL' });
      return;
    }
    this.agentIdParams.set({ id: this.configId });

    forkJoin({
      types: this.crmService.getAgentTypes().pipe(
        map(list => list.map(dto => crmAgentTypeDtoToView(dto)))
      ),
      organizations: this.mainStructService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto)))
      ),
    }).pipe(
      switchMap(({ types, organizations }) => {
        this.agentTypes.set(types);
        this.organizations.set(organizations);
        return forkJoin({
          config: this.loadItem(),
          crmorg: this.loadCrmOrg(),
          agent: this.crmService.getAgentById(this.configId!).pipe(
            map(dto => crmAgentItemDtoToView(dto, types, organizations))
          ),
          serviceCategories: this.loadServiceCategories(),
        });
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ config, crmorg: org, agent, serviceCategories }) => {
        this.agent.set(agent);
        this.afterLoadCrmOrg(org);
        this.afterLoadItem(config, undefined);
        this.afterLoadServiceCategories(serviceCategories);
        this.listenToChanges();
      },
      error: err => this.processError(err),
    });
  }

  private processError = (err: any): void => {
    const resError = processResponseError(err);
    this.hasError.set(true);
    this.error.set(resError);
    this.isLoading.set(false);
    setTimeout(() => {
      this.router.navigate(this.agentPage, { queryParams: this.agentIdParams() });
    }, 1000);
  }

  private loadItem = (): Observable<YClientsAgentConfigView> => {
    return this.dataService.getAgentConfig(this.configId!).pipe(
      map(dto => yClientsAgentConfigDtoToView(dto))
    );
  }
  private afterLoadItem = (config: YClientsAgentConfigView | undefined, error: any,
    action: string = 'загрузки конфигурации'): void => {
    const patchForm = (config: YClientsAgentConfigView): void => {
      this.formConfig.patchValue({
        partnerToken: config.credentials?.partnerToken ?? '',
        userToken: config.credentials?.userToken ?? '',
      }, { emitEvent: false });
    }

    if (config) {
      this.dataConfig.set(config);
      patchForm(config);
      this.currentConfig.set(config);
      this.hasConfigChanged.set(false);
    } else if (error) {
      const resError = processResponseError(error);
      this.notificationService.error(`Ошибка ${action}: ${resError.message}`)
    }
  }

  private _beforeLoadCrmOrgList = () => {
    this.lstYcOrgs.set([]);
    this.curLstYcOrg.set(undefined);
    this.hasCrmOrgChanged.set(false);
  }
  private loadCrmOrg = (): Observable<YClientsOrganizationView | undefined> => {
    return this.dataService.getOrganizationForAgent(this.configId!).pipe(
      map(dto => yClientsOrganizationDtoToView(dto))
    );
  }
  private afterLoadCrmOrg = (org: YClientsOrganizationView | undefined): void => {
    this._beforeLoadCrmOrgList();
    this.currentCrmOrg.set(org);
    this.formCrmOrg.patchValue({
      ycId: org?.ycId ?? '',
      name: org?.name ?? '',
      timezone: org?.timezone ?? '',
    }, { emitEvent: false });
  }


  private _beforeLoadServiceCategories = () => {
    this.currentServiceCategories.set([]);
  }

  private loadServiceCategories = (): Observable<YClientsServiceCategoryView[]> => {
    return this.dataService.getServiceCategoriesForAgent(this.configId!).pipe(
      map(dto => dto.map(v => yClientsServiceCategoryDtoToView(v, true, undefined, true)))
    );
  }
  private afterLoadServiceCategories = (lst: YClientsServiceCategoryView[]): void => {
    this.currentServiceCategories.set(lst);
    const activeOrgId = this.curLstYcOrg()?.ycId ?? this.currentCrmOrg()?.ycId;
    this.categoriesByOrg.clear();
    if (activeOrgId !== undefined) {
      this.categoriesByOrg.set(activeOrgId, lst);
    }
  };


  private updateItem = (item: YClientsAgentConfigView): Observable<YClientsAgentConfigView> => {
    const value = yClientsAgentConfigDtoFromView(item);
    return this.dataService.updateAgentConfig(item.id, item).pipe(
      map(dto => yClientsAgentConfigDtoToView(dto))
    );
  }
  private updateCrmOrg = (oldItem: YClientsOrganizationView, item: YClientsOrganizationView): Observable<YClientsOrganizationView> => {
    const req = yClientsOrganizationDtoPopulate(yClientsOrganizationDtoFromView(oldItem), item);
    return this.dataService.updateOrganizationForAgent(req.agentId, req).pipe(
      map(dto => yClientsOrganizationDtoToView(dto))
    );
  }
  private updateCategories = (items: YClientsServiceCategoryView[]): Observable<YClientsServiceCategoryView[]> => {
    const toSave = items
      .filter(c => c.selected)
      .map(v => yClientsServiceCategoryFromView(v));
    console.log(this.configId);
    console.log(this.currentCrmOrg()?.id);
    console.log(JSON.stringify(toSave));
    return this.dataService.updateServiceCategoriesForAgent(this.configId!, toSave).pipe(
      map(dto => dto.map(v => yClientsServiceCategoryDtoToView(v, true, undefined, true)))
    );
  };



  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.doRefresh();
    });
  }

  callGetUserToken() {
    this.dialogService.loginDialog({
      title: 'Генерация токена',
      submitLabel: 'Сгенерировать',
      cancelLabel: 'Отмена',
    }).subscribe((result: LoginDialogResult) => {
      if (result.action === 'submitted') this.doGetUserToken(result.data);
    });
  }

  callLoadAvaibleOrgs(): void {
    this.doLoadAvaibleOrgs();
  }

  callLoadCategories(): void {
    this.dialogService.confirm('Считать актуальный список категорий?').subscribe(confirmed => {
      if (confirmed) this.doLoadCategories();
    });
  }

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }


  onSelectYcOrg(row: YClientsOrganizationView): void {
    const oldId = this.lstYcOrgs().find(f => f._selected)?.ycId;
    this.lstYcOrgs.update(list =>
      list.map(v => {
        v._selected = v === row;
        return v;
      })
    );
    this.formCrmOrg.patchValue({
      ycId: row.ycId ?? '',
      name: row.name ?? '',
      timezone: row.timezone ?? '',
    });
    this.curLstYcOrg.set(row);
    this.hasCrmOrgChanged.set((this.curLstYcOrg()?.ycId !== this.currentCrmOrg()?.ycId));
    const newId = this.lstYcOrgs().find(f => f._selected)?.ycId;
    if (oldId != newId) {
      if (oldId) {
        this.categoriesByOrg.set(oldId!, this.currentServiceCategories() ?? [])
      }
      if (newId && this.categoriesByOrg.has(newId!)) {
        this.currentServiceCategories.set(this.categoriesByOrg.get(newId)!);
      } else {
        this.currentServiceCategories.set([]);
      }
    }
  }

  onCategorySelectedChange(event: { id: number; selected: boolean }): void {
    const newList = this.currentServiceCategories().map(c =>
      c.id === event.id ? { ...c, selected: event.selected } : c
    );
    this.currentServiceCategories.set(newList);
  }

  doRefresh = (): void => {
    if (!this.configId) return;
    this._beforeLoad();
    this._beforeLoadCrmOrgList();
    this._beforeLoadServiceCategories();
    forkJoin({
      config: this.loadItem(),
      org: this.loadCrmOrg(),
      serviceCatgories: this.loadServiceCategories(),
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ config, org, serviceCatgories }) => {
        this.afterLoadItem(config, undefined);
        this.afterLoadCrmOrg(org);
        this.afterLoadServiceCategories(serviceCatgories);
      },
      error: err => this.afterLoadItem(undefined, err),
    });
  }

  doGetUserToken = (data: LoginRequestDto) => {
    const request: YClientsTokenRequestDto = {
      login: data.username, password: data.password, partnerToken: this.currentConfig()?.credentials.partnerToken
    } as YClientsTokenRequestDto
    this.isGetUserToken.set(true);

    const applySuccess = (val: string | undefined) => {
      if (!this.currentConfig() || !val || this.currentConfig()?.credentials.partnerToken === val) return;
      const current = {
        partnerToken: this.currentConfig()!.credentials.partnerToken, userToken: val,
      } as YClientCredentialsView;
      this.hasConfigChanged.set(
        hasChanges<YClientCredentialsView>(this.currentConfig()!.credentials, current));
      if (this.hasConfigChanged()) {
        this.currentConfig.update(v => {
          v!.credentials = current;
          return v;
        });
        this.formConfig.patchValue({ userToken: val ?? '', }, { emitEvent: false });
      }
    }

    this.dataService.getClientToken(request).pipe(
      finalize(() => this.isGetUserToken.set(false))
    ).subscribe({
      next: result => {
        if (!result.success) {
          this.notificationService.error(result.errorMessage ?? 'Ошибка при запросе токена')
        } else {
          applySuccess(result.userToken);
          this.notificationService.success('Токен получен');
        }
      },
      error: err => this.afterLoadItem(undefined, err, 'запроса токена'),
    });
  }

  doLoadAvaibleOrgs = () => {
    if (!this.canLoadCrmOrg()) return;
    this.isLoadCrmOrgList.set(true);
    this._beforeLoadCrmOrgList();
    this.dataService.getAllowedOrganizationsForAgent(this.currentConfig()!.id).pipe(
      finalize(() => this.isLoadCrmOrgList.set(false))
    ).subscribe({
      next: result => {
        if (!result.success) {
          this.notificationService.error(result.errorMessage ?? 'Ошибка при запросе списка доступных организаций')
        } else if (!result.data?.length) {
          this.notificationService.error(result.errorMessage ?? 'Получен пустой список доступных организаций')
        } else {
          const curYcId = this.formCrmOrg.value.ycId;
          const lst = result.data!.map(v => yClientsOrganizationDtoToView(v, curYcId));
          this.lstYcOrgs.set(lst);
          this.curLstYcOrg.set(lst.find(f => f._selected));
        }
      },
      error: err => this.afterLoadItem(undefined, err, 'при запросе списка доступных организаций'),
    });
  }

  doLoadCategories(): void {
    const id = this.curLstYcOrg()?.ycId ?? this.currentCrmOrg()?.ycId;
    if (!id) return;

    this.isLoadServiceCategories.set(true);
    this.dataService.getAllowedServiceCategories(this.configId!, id).pipe(
      finalize(() => this.isLoadServiceCategories.set(false))
    ).subscribe({
      next: result => {
        if (!result.success) {
          this.notificationService.error(result.errorMessage ?? 'Ошибка при запросе списка категорий');
          return;
        }
        if (!result.data?.length) {
          this.notificationService.error(result.errorMessage ?? 'Получен пустой список категорий');
          return;
        }

        const current = this.currentServiceCategories();
        const currentMap = new Map(current.map(c => [c.id, c]));
        const resultMap = new Map(result.data.map(d => [d.id, d]));

        const newList: YClientsServiceCategoryView[] = [];

        // 1. Корректируем существующий список
        for (const cat of current) {
          const dto = resultMap.get(cat.id);
          if (dto) {
            // Есть и у нас, и в CRM:
            // existsCRM=true, название и orgId из CRM, selected и existsNow не трогаем
            cat.existsCRM = true;
            cat.name = dto.name;
            cat.orgId = dto.orgId;
          } else {
            // В CRM не найдена: снимаем selected и existsCRM
            cat.selected = false;
            cat.existsCRM = false;
          }
          newList.push(cat);
        }

        // 2. Добавляем новые записи из CRM (которых у нас ещё нет)
        for (const dto of result.data) {
          if (!currentMap.has(dto.id)) {
            newList.push(yClientsServiceCategoryDtoToView(dto, false, true, false));
          }
        }

        this.currentServiceCategories.set(newList);
      },
      error: err => this.afterLoadItem(undefined, err, 'при запросе списка категорий'),
    });
  }

  doSave = (): void => {
    const saveConfig = this.hasConfigChanged() && this.currentConfig();
    const saveOrg = this.hasCrmOrgChanged() && this.curLstYcOrg() && this.currentCrmOrg();
    const saveCategories = this.hasServiceCategoriesChanged();

    if (!saveConfig && !saveOrg && !saveCategories) {
      this.notificationService.error('Нет изменений для сохранения');
      return;
    }

    this.isSaving.set(true);

    const config$ = saveConfig
      ? this.updateItem(this.currentConfig()!)
      : of(null);
    const org$ = saveOrg
      ? this.updateCrmOrg(this.currentCrmOrg()!, this.curLstYcOrg()!)
      : of(null);
    const categories$ = saveCategories
      ? this.updateCategories(this.currentServiceCategories())
      : of(null);

    forkJoin({ config: config$, org: org$, categories: categories$ })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: ({ config, org, categories }) => {
          if (config) this.afterLoadItem(config, undefined);
          if (org) this.afterLoadCrmOrg(org);
          if (categories) this.afterLoadServiceCategories(categories);

          this.notificationService.success('Все изменения сохранены успешно. Если изменяли организацию, то обновите список услуг и их категорий');
        },
        error: err => {
          const resError = processResponseError(err);
          const parts: string[] = [];
          if (saveConfig) parts.push('конфигурации');
          if (saveOrg) parts.push('организации');
          if (saveCategories) parts.push('категорий услуг');
          this.notificationService.error(`Ошибка сохранения ${parts.join(' и ')}: ${resError.message}`);
        },
      });
  };

}