import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { addNewItemFlag, addOrigData, applyChanges, DialogService, hasChanges, hasOrigData, isNewItem, NotificationService, removeOrigData, SizeService } from '@mon3/sc';
import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { ErrorResponseResult, PermissionService, processResponseError } from '@mon3/sa';
import { MacroscopAgentConfigListView, MacroscopAgentConfigView, MacroscopArchiveModeView, MacroscopChannelView, MacroscopImgAgentConfigView } from '../macroscop-view.models';
import { authConstant } from '../../../auth-constants';
import { distinctUntilChanged, finalize, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import {
  createEmptyMacroscopAgentConfigView, macroscopAgentConfigDtoToView, macroscopAgentConfigListDtoToView,
  macroscopAgentConfigViewToListView, macroscopArchiveModeDtoToView, macroscopChannelDtoToView,
  macroscopChannelViewToDto, macroscopImgAgentConfigDtoToView, macroscopImgAgentConfigViewToDto
} from '../macroscop-view.utils';
import { ImgStructManageService } from '../../../services/img-struct-manage.service';
import { ImgAgentItemView } from '../../img/img-view.models';
import { imgAgentItemDtoToView } from '../../img/img-view.utils';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MacroscopConfigEditorComponent } from '../macroscop-config-editor/macroscop-config-editor.component';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-macroscop-img-editor-container',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatTooltipModule, MatDividerModule,
    MacroscopConfigEditorComponent,
  ],
  providers: [],
  templateUrl: './macroscop-img-editor-container.component.html',
  styleUrl: './macroscop-img-editor-container.component.scss'
})
export class MacroscopImgEditorContainerComponent implements OnInit {

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly permissionService: PermissionService = inject(PermissionService);
  private readonly sizeService = inject(SizeService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialogService = inject(DialogService);

  private readonly macroscopManageService: MacroscopManageService = inject(MacroscopManageService);
  private readonly imgStructManageService: ImgStructManageService = inject(ImgStructManageService);
  private readonly mainStructService: MainStructManageService = inject(MainStructManageService);

  readonly agentListPage = ['/', 'img', 'agent-list'];
  readonly configListPage = ['/', 'macroscop', 'config-list'];

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});
  canManageAnyConfig = signal(false);
  backTarget: WritableSignal<any> = signal(undefined);
  backParams: WritableSignal<any> = signal(undefined);
  hasImgChanges = signal(false);
  hasCfgChanges = signal(false);

  id = signal<string | undefined>(undefined);
  agent = signal<ImgAgentItemView | undefined>(undefined);
  imgConfig = signal<MacroscopImgAgentConfigView | undefined>(undefined);
  configs = signal<MacroscopAgentConfigListView[]>([]);
  configMap: Map<string, MacroscopAgentConfigView> = new Map();
  organizations = signal<OrgStructInfo[]>([]);
  archiveModes = signal<MacroscopArchiveModeView[]>([]);

  isSmallScreen = this.sizeService.isSmallScreen;

  formGroup!: FormGroup;

  ngOnInit(): void {
    this.sizeService.breakpointsSubscribe();
    this.canManageAnyConfig.set(this.permissionService.checkPermissions(authConstant('macroscop/config-list')));
    this.buildForm();
    const idParam = this.route.snapshot.queryParamMap.get('id') ?? undefined;
    if (idParam) {
      this.backTarget.set(this.agentListPage);
      this.backParams.set({ queryParams: { id: idParam } });
      this.id.set(idParam);
    } else if (this.canManageAnyConfig()) {
      this.backTarget.set(this.configListPage);
    } else {
      this.backTarget.set(this.agentListPage);
    }
    if (!this.id()) {
      this.router.navigate(this.backTarget());
    } else {
      this.initData();
    }
  }

  private processError(err: any, redirect: boolean): void {
    const resError = processResponseError(err);
    this.hasError.set(true);
    this.error.set(resError);
    this.isLoading.set(false);
    if (redirect) {
      setTimeout(() => {
        this.router.navigate(this.backTarget(), this.backParams());
      }, 1500);
    } else {
      this.notificationService.error(`${resError.message}`)
    }
  }

  private buildForm(): void {
    this.formGroup = this.fb.group({
      config: [{ value: null as string | null, disabled: !this.canManageAnyConfig() }],
      organization: [{ value: null as string | null, readonly: true }]
    });
    this.onImgConfigChange();
  }

  private initData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    const canManage = this.canManageAnyConfig();

    this.mainStructService.getOrganizations().pipe(
      map(list => list.map(dto => orgStructListDtoToView(dto))),
      switchMap(organizations => forkJoin({
        organizations: of(organizations),
        archiveModes: this.macroscopManageService.getArchiveModes().pipe(
          map(list => list.map(dto => macroscopArchiveModeDtoToView(dto))),
        ),
        config: this.macroscopManageService.getImgConfig(this.id()!).pipe(
          map(dto => macroscopImgAgentConfigDtoToView(dto))
        ),
        agent: this.imgStructManageService.getAgentById(this.id()!).pipe(
          map(dto => imgAgentItemDtoToView(dto, undefined, organizations))
        ),
        configs: !canManage
          ? of([])
          : this.macroscopManageService.getConfigs().pipe(
            map(list => list.map(dto => macroscopAgentConfigListDtoToView(dto)))),
      })),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ organizations, archiveModes, config, agent, configs }) => {
        const hasBoundConfig = !!config?.config;
        if (!hasBoundConfig && !canManage) {
          this.processError({ message: 'Не установлена конфигурация сервера Macroscop' }, true);
          return;
        }
        this.organizations.set(organizations);
        this.archiveModes.set(archiveModes as MacroscopArchiveModeView[]);
        this.agent.set(agent);
        this.configs.set(canManage ? configs : [macroscopAgentConfigViewToListView(config!.config!)]);
        this.formGroup.patchValue({ organization: agent.organization?.shortName ?? '' }, { emitEvent: false });
        this.loadData();
      },
      error: err => this.processError(err, true),
    });
  }

  private afterLoad(config: MacroscopImgAgentConfigView | undefined | null) {
    this.configMap.clear();
    this.hasCfgChanges.set(false);
    this.hasImgChanges.set(false);
    if (this.imgConfig()) this.imgConfig.set(removeOrigData<MacroscopImgAgentConfigView>(this.imgConfig()!))
    if (config && !hasOrigData<MacroscopImgAgentConfigView>(config)) config = addOrigData<MacroscopImgAgentConfigView>(config);
    this.imgConfig.set(config ?? undefined);
    this.afterLoadConfig(config?.config);
    if (config) {
      this.hasImgChanges.set(hasChanges<MacroscopImgAgentConfigView>(config, (config as any)._orig));
    }
  }

  private loadData(): void {
    const modes = this.archiveModes();
    this.isLoading.set(true);
    this.macroscopManageService.getImgConfig(this.id()!).pipe(
      switchMap(dto => {
        const view = macroscopImgAgentConfigDtoToView(dto);
        const cfgId = view.config?.id;
        if (!cfgId) return of(view);
        return this.macroscopManageService.getChannelsForConfig(cfgId).pipe(
          map(list => {
            if (view.config) {
              view.config.channels = list.map(d => macroscopChannelDtoToView(d, modes));
            }
            return view;
          }),
        );
      }),
      finalize(() => this.isLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: config => this.afterLoad(config),
      error: err => this.processError(err, false),
    });
  }

  private afterLoadConfig(config: MacroscopAgentConfigView | undefined | null) {
    if (config && !hasOrigData<MacroscopAgentConfigView>(config)) config = addOrigData<MacroscopAgentConfigView>(config);
    if (!this.imgConfig()) return;
    this.imgConfig.update(e => {
      if (!e) return e;
      e.config = config ?? undefined;
      return e;
    });
    this.formGroup.patchValue({ config: config?.id ?? null, }, { emitEvent: false });
    if (config?.id) this.configMap.set(config.id, config);
    this.hasImgChanges.set(hasChanges<MacroscopImgAgentConfigView>(this.imgConfig()!, (this.imgConfig() as any)._orig));
    if (this.imgConfig()?.config) {
      this.hasCfgChanges.set(hasChanges<MacroscopAgentConfigView>(this.imgConfig()!.config!, (this.imgConfig()!.config as any)._orig));
    } else {
      this.hasCfgChanges.set(false);
    }
  }

  private loadConfig(configId: string): void {
    const cached = this.configMap.get(configId);
    const modes = this.archiveModes();
    if (cached) { this.afterLoadConfig(cached); return; }

    this.isLoading.set(true);
    forkJoin({
      config: this.macroscopManageService.getConfig(configId).pipe(
        map(dto => macroscopAgentConfigDtoToView(dto))),
      channels: this.macroscopManageService.getChannelsForConfig(configId).pipe(
        map(list => list.map(d => macroscopChannelDtoToView(d, modes)))),
    }).pipe(
      finalize(() => this.isLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ config, channels }) => {
        config.channels = channels;
        this.configMap.set(configId, config);
        this.afterLoadConfig(config);
      },
      error: err => this.processError(err, false),
    });
  }

  private onImgConfigChange(): void {
    this.formGroup.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        if (values.config !== this.imgConfig()?.config?.id) {
          this.loadConfig(values.config);
        }
      });
  }

  onConfigChange = (newData: MacroscopAgentConfigView | undefined): void => {
    if (this.imgConfig()?.config && newData) {
      var newVal = this.imgConfig()?.config!;
      if (hasChanges<MacroscopAgentConfigView>(this.imgConfig()!.config!, newData)) {
        applyChanges<MacroscopAgentConfigView>(newVal, newData);
        this.imgConfig.update(v => { v!.config = newVal; return v; });
      }
    }
    if (this.imgConfig()?.config) {
      this.hasCfgChanges.set(hasChanges<MacroscopAgentConfigView>(this.imgConfig()!.config!, (this.imgConfig()!.config as any)._orig));
    }
  }

  callRefresh() {
    this.dialogService.confirm('Перечитать данные? Все несохранённые изменения будут потеряны.').subscribe(confirmed => {
      if (confirmed) this.loadData();
    });
  }

  callAdd() {
    this.dialogService.confirm('Добавить новую конфигурацию сервера?').subscribe(confirmed => {
      if (confirmed) this.doAddConfig();
    });
  }

  callUnBind() {
    if (!this.imgConfig()?.config) return;
    this.dialogService.confirm(`Отвязать конфигурацию сервера ${this.imgConfig()?.config?.name} от агента?`)
      .subscribe(confirmed => { if (confirmed) this.doUnbindConfig(); });
  }

  callSave() {
    this.dialogService.confirm(`Сохранить изменения в конфигурации?`)
      .subscribe(confirmed => { if (confirmed) this.doSave(); });
  }

  private doAddConfig() {
    const cfg = addNewItemFlag(createEmptyMacroscopAgentConfigView());
    this.configs.update(list => [
      macroscopAgentConfigViewToListView(cfg),
      ...list,
    ]);
    this.afterLoadConfig(cfg);
  }

  private doUnbindConfig() {
    if (!this.imgConfig()?.config) return;
    var cfg = this.imgConfig()!.config;
    this.afterLoadConfig(undefined);
    if (isNewItem(cfg!)) {
      this.configs.update(list => list.filter(c => c.id !== cfg!.id));
      this.configMap.delete(cfg!.id);
    }
  }

  private doSave() {
    const createAndSaveConfig = (cfg: MacroscopAgentConfigView): Observable<MacroscopAgentConfigView> => {
      return this.macroscopManageService.newConfig().pipe(
        switchMap(created => {
          const patched = new MacroscopAgentConfigView(
            created.id,
            cfg.name,
            cfg.serverAddress,
            cfg.credentials,
            cfg.serverInfo,
            cfg.channels ?? [],
          );
          return this.macroscopManageService.updateConfig(patched.id, patched);
        }),
        map(dto => macroscopAgentConfigDtoToView(dto)),
      );
    }

    const syncImgBinding = (cfg: MacroscopAgentConfigView | undefined): Observable<MacroscopImgAgentConfigView> => {
      const agentId = this.id()!;
      if (!cfg) {
        return this.macroscopManageService.unbindImgConfig(agentId)
          .pipe(map(dto => macroscopImgAgentConfigDtoToView(dto)));
      }
      return this.macroscopManageService.bindImgConfig(agentId, cfg.id)
        .pipe(map(dto => macroscopImgAgentConfigDtoToView(dto)));
    }

    const updateImgConfig = (cfg: MacroscopAgentConfigView): Observable<MacroscopImgAgentConfigView> => {
      const patched: MacroscopImgAgentConfigView = {
        ...currImgCfg,
        config: cfg,
      } as MacroscopImgAgentConfigView;
      const dto = macroscopImgAgentConfigViewToDto(patched);
      return this.macroscopManageService.updateImgConfig(this.id()!, dto)
        .pipe(map(d => macroscopImgAgentConfigDtoToView(d)));
    };

    const currImgCfg = this.imgConfig();
    if (!currImgCfg) return;

    const currCfg = this.imgConfig()?.config;
    const isImgChanged = this.hasImgChanges();
    const isCfgChanged = this.hasCfgChanges();
    const isNewCfg = !!currCfg && isNewItem(currCfg);
    const oldCfgId = currCfg?.id;

    if (!isImgChanged && !isCfgChanged) {
      this.notificationService.info('Нет изменений для сохранения');
      return;
    }

    this.isSaving.set(true);

    const persistedCfg$: Observable<MacroscopAgentConfigView | undefined> = isNewCfg
      ? createAndSaveConfig(currCfg!)
      : of(currCfg);

    persistedCfg$.pipe(
      switchMap(cfg => {
        const img$: Observable<MacroscopImgAgentConfigView | null> =
          isImgChanged ? syncImgBinding(cfg) : of(null);

        const cfg$: Observable<MacroscopImgAgentConfigView | null> =
          (!isNewCfg && isCfgChanged && cfg)
            ? updateImgConfig(cfg)
            : of(null);

        const channels$: Observable<MacroscopChannelView[] | null> =
          (!isNewCfg && cfg?.id && (cfg.channels?.length ?? 0) > 0)
            ? this.macroscopManageService.updateChannelsForConfig(
              cfg.id,
              cfg.channels!.map(c => macroscopChannelViewToDto(c)))
              .pipe(map(list => list.map(d => macroscopChannelDtoToView(d))))
            : of(null);

        return forkJoin({ img: img$, cfg: cfg$, channels: channels$ });
      }),
      map(({ img, cfg, channels }) => {
        var res = img ?? cfg ?? this.imgConfig() ?? undefined;
        if (channels && res?.config) res!.config!.channels = channels;
        return res;
      }),
      finalize(() => this.isSaving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: result => {
        if (isNewCfg && result?.config && oldCfgId) {
          const realCfg = result.config;
          this.configs.update(list => list.map(c =>
            c.id === oldCfgId ? macroscopAgentConfigViewToListView(realCfg) : c));
        }
        this.afterLoad(result);
        this.notificationService.success('Изменения сохранены');
      },
      error: err => this.processError(err, false),
    });
  }
}