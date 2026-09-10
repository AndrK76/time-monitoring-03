import { Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { finalize, forkJoin, map, switchMap, Observable, debounceTime, distinctUntilChanged } from 'rxjs';
import { ErrorResponseResult, LoginRequestDto, processResponseError } from '@mon3/sa';
import { YclientsManageService } from '../../../services/yclients-manage.service';
import { CrmStructManageService } from '../../../services/crm-struct-manage.service';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { YClientCredentialsView, YClientsAgentConfigView } from '../yclients-view.models';
import { yClientsAgentConfigDtoFromView, yClientsAgentConfigDtoToView } from '../yclients-view.utils';
import { CrmAgentItemView, CrmAgentTypeView } from '../../crm-agent/crm-agent-view.models';
import { crmAgentItemDtoToView, crmAgentTypeDtoToView } from '../../crm-agent/crm-agent-view.utils';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { DialogService, hasChanges, LoginDialogResult, NotificationService, SizeService } from '@mon3/sc';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-yc-config-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatProgressSpinnerModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatDividerModule, MatCardModule],
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
  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});
  private configId: string | undefined = undefined;

  dataConfig = signal<YClientsAgentConfigView | undefined>(undefined);
  current = signal<YClientsAgentConfigView | undefined>(undefined);

  agent = signal<CrmAgentItemView | undefined>(undefined);
  organizations = signal<OrgStructInfo[]>([]);
  agentTypes = signal<CrmAgentTypeView[]>([]);

  readonly agentPage = ['/', 'crm', 'agent-list'];
  agentIdParams: WritableSignal<Params> = signal({ id: undefined })

  isSmallScreen = this.sizeService.isSmallScreen;
  hasChanges = signal<boolean>(false);

  form!: FormGroup;
  private readonly destroyRef = inject(DestroyRef);


  ngOnInit(): void {
    this.sizeService.breakpointsSubscribe();
    this.buildForm();
    this.initializeData();
  }

  private _beforeLoad = () => {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});
  }


  private buildForm(): void {
    this.form = this.fb.group({
      apiUrl: [''],
      partnerToken: [''],
      userToken: [''],
    });
  }

  private listenToChanges(): void {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const cfg = this.dataConfig();
        if (!cfg) {
          this.hasChanges.set(false);
          return;
        }
        const current = {
          apiUrl: values.apiUrl, partnerToken: values.partnerToken, userToken: values.userToken,
        } as YClientCredentialsView;
        this.hasChanges.set(
          hasChanges<YClientCredentialsView>(cfg.credentials, current));
        if (this.current() && this.hasChanges()) this.current.update(v => {
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
          agent: this.crmService.getAgentById(this.configId!).pipe(
            map(dto => crmAgentItemDtoToView(dto, types, organizations))
          ),
        });
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ config, agent }) => {
        this.agent.set(agent);
        this.afterLoadItem(config, undefined);
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
    action: string = 'загрузки'): void => {
    const patchForm = (config: YClientsAgentConfigView): void => {
      this.form.patchValue({
        apiUrl: config.credentials?.apiUrl ?? '',
        partnerToken: config.credentials?.partnerToken ?? '',
        userToken: config.credentials?.userToken ?? '',
      }, { emitEvent: false });
    }

    if (config) {
      this.dataConfig.set(config);
      patchForm(config);
      this.current.set(config);
      this.hasChanges.set(false);
    } else if (error) {
      const resError = processResponseError(error);
      this.notificationService.error(`Ошибка ${action} конфигурации: ${resError.message}`)
    }
  }
  private updateItem = (item: YClientsAgentConfigView): Observable<YClientsAgentConfigView> => {
    const value = yClientsAgentConfigDtoFromView(item);
    return this.dataService.updateAgentConfig(item.id, item).pipe(
      map(dto => yClientsAgentConfigDtoToView(dto))
    );
  }



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

  callSave(): void {
    this.dialogService.confirm('Сохранить изменения?').subscribe(confirmed => {
      if (confirmed) this.doSave();
    });
  }


  doRefresh = (): void => {
    if (!this.configId) return;
    this._beforeLoad();
    this.loadItem().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: config => {
        this.afterLoadItem(config, undefined);
      },
      error: err => this.afterLoadItem(undefined, err),
    });
  }

  doGetUserToken = (data: LoginRequestDto) => {
    console.log(data);
  }

  doSave = (): void => {
    if (!this.current()) return;
    this.isSaving.set(true);
    this.updateItem(this.current()!).pipe(
      finalize(() => this.isSaving.set(false))
    ).subscribe({
      next: config => {
        this.afterLoadItem(config, undefined);
        this.notificationService.success('Все изменения сохранены успешно');
      },
      error: err => this.afterLoadItem(undefined, err, 'сохранения'),
    });
  }









}