import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { addNewItemFlag, addOrigData, applyChanges, DialogService, hasChanges, hasOrigData, isNewItem, NotificationService, removeOrigData, SizeService, TableActionsInformerService } from '@mon3/sc';
import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { ErrorResponseResult, PermissionService, processResponseError } from '@mon3/sa';
import { MacroscopAgentConfigListView, MacroscopAgentConfigView, MacroscopArchiveModeView, MacroscopChannelView, MacroscopEvtAgentConfigView, MacroscopEvtAgentModeView } from '../macroscop-view.models';
import { authConstant } from '../../../auth-constants';
import { distinctUntilChanged, finalize, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { createEmptyMacroscopAgentConfigView, macroscopAgentConfigDtoToView, macroscopAgentConfigListDtoToView, macroscopAgentConfigViewToListView, macroscopArchiveModeDtoToView, macroscopChannelDtoToView, macroscopChannelViewToDto, macroscopEvtAgentConfigDtoToView, macroscopEvtAgentConfigViewToDto, macroscopEvtAgentModeDtoToView, macroscopEvtAgentModeFromId } from '../macroscop-view.utils';
import { EvtStructManageService } from '../../../services/evt-struct-manage.service';
import { EvtAgentItemView } from '../../evt/evt-view.models';
import { evtAgentItemDtoToView } from '../../evt/evt-view.utils';
import { OrgStructInfo } from '../../struct-org/struct-org-view.models';
import { MainStructManageService } from '../../../services/main-struct-manage.service';
import { orgStructListDtoToView } from '../../struct-org/struct-org-view.utils';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MacroscopConfigEditorComponent } from '../macroscop-config-editor/macroscop-config-editor.component';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-macroscop-evt-editor-container',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatTooltipModule, MatDividerModule,
    MacroscopConfigEditorComponent,
  ],
  providers: [],
  templateUrl: './macroscop-evt-editor-container.component.html',
  styleUrl: './macroscop-evt-editor-container.component.scss'
})
export class MacroscopEvtEditorContainerComponent implements OnInit {

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly permissionService: PermissionService = inject(PermissionService);
  private readonly sizeService = inject(SizeService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialogService = inject(DialogService);


  private readonly macroscopManageService: MacroscopManageService = inject(MacroscopManageService);
  private readonly evtStructManageService: EvtStructManageService = inject(EvtStructManageService);
  private readonly mainStructService: MainStructManageService = inject(MainStructManageService);


  readonly agentListPage = ['/', 'evt', 'agent-list'];
  readonly configListPage = ['/', 'macroscop', 'config-list'];


  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  hasError = signal<boolean>(false);
  error = signal<ErrorResponseResult>({});
  canManageAnyConfig = signal(false);
  backTarget: WritableSignal<any> = signal(undefined);
  backParams: WritableSignal<any> = signal(undefined);
  hasEvtChanges = signal(false);
  hasCfgChanges = signal(false);
  hasModeChanges = computed(() => {
    const cfg = this.evtConfig();
    if (!cfg) return false;
    const orig = (cfg as any)._orig as MacroscopEvtAgentConfigView | undefined;
    if (!orig) return false;
    return (orig.mode ?? null) !== (cfg.mode ?? null);
  });

  id = signal<string | undefined>(undefined);
  agent = signal<EvtAgentItemView | undefined>(undefined);
  evtConfig = signal<MacroscopEvtAgentConfigView | undefined>(undefined);
  configs = signal<MacroscopAgentConfigListView[]>([]);
  configMap: Map<string, MacroscopAgentConfigView> = new Map();
  organizations = signal<OrgStructInfo[]>([]);
  archiveModes = signal<MacroscopArchiveModeView[]>([]);
  evtAgentModes = signal<MacroscopEvtAgentModeView[]>([]);
  availableModes = computed(() => {
    const all = this.evtAgentModes();
    const current = this.evtConfig()?.modeWithInfo;
    if (current?.set === true) {
      return all.filter(m => m.set === true);
    }
    return all;
  });

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
      mode: [{ value: 'unknown' as string, disabled: false }, Validators.required],
      organization: [{ value: null as string | null, readonly: true }]
    });
    this.onEvtConfigChange();
    this.onModeChange();
  }

  private initData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.error.set({});

    const canManage = this.canManageAnyConfig();

    forkJoin({
      organizations: this.mainStructService.getOrganizations().pipe(
        map(list => list.map(dto => orgStructListDtoToView(dto)))),
      archiveModes: this.macroscopManageService.getArchiveModes().pipe(
        map(list => list.map(dto => macroscopArchiveModeDtoToView(dto)))),
      evtAgentModes: this.macroscopManageService.getEvtAgentModes().pipe(
        map(list => list.map(dto => macroscopEvtAgentModeDtoToView(dto)))),
    }).pipe(
      switchMap(({ organizations, archiveModes, evtAgentModes }) => {
        this.evtAgentModes.set(evtAgentModes);
        return forkJoin({
          config: this.macroscopManageService.getEvtConfig(this.id()!).pipe(
            map(dto => macroscopEvtAgentConfigDtoToView(dto, evtAgentModes))),
          agent: this.evtStructManageService.getAgentById(this.id()!).pipe(
            map(dto => evtAgentItemDtoToView(dto, undefined, organizations))),
          configs: !canManage
            ? of([])
            : this.macroscopManageService.getConfigs().pipe(
              map(list => list.map(dto => macroscopAgentConfigListDtoToView(dto)))),
          organizations: of(organizations),
          archiveModes: of(archiveModes as MacroscopArchiveModeView[]),
        });
      }),
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: ({ organizations, archiveModes, config, agent, configs }) => {
        const hasBoundConfig = !!config?.config;
        if (!hasBoundConfig && !canManage) {
          this.processError({ message: 'Не установлена конфигурация сервера Macroscop' }, true);
          return;
        }
        this.organizations.set(organizations);
        this.archiveModes.set(archiveModes);
        this.agent.set(agent);
        this.configs.set(canManage ? configs : [macroscopAgentConfigViewToListView(config!.config!)]);
        this.formGroup.patchValue({ organization: agent.organization?.shortName ?? '' }, { emitEvent: false });
        this.loadData();
      },
      error: err => this.processError(err, true),
    });
  }

  private afterLoad(config: MacroscopEvtAgentConfigView | undefined | null) {
    this.configMap.clear();
    this.hasCfgChanges.set(false);
    this.hasEvtChanges.set(false);
    if (this.evtConfig()) this.evtConfig.set(removeOrigData<MacroscopEvtAgentConfigView>(this.evtConfig()!));
    if (config && !hasOrigData<MacroscopEvtAgentConfigView>(config)) {
      config = addOrigData<MacroscopEvtAgentConfigView>(config);
    }
    this.evtConfig.set(config ?? undefined);
    this.afterLoadConfig(config?.config);

    // Обновляем поле mode в форме (emitEvent: false, чтобы не дёргать onModeChange)
    this.formGroup.patchValue({ mode: config?.mode ?? 'unknown' }, { emitEvent: false });

    if (config) {
      this.hasEvtChanges.set(
        hasChanges<MacroscopEvtAgentConfigView>(
          config, (config as any)._orig, ['mode', 'modeWithInfo']));
    }
  }

  private loadData(): void {
    const modes = this.archiveModes();
    const evtModes = this.evtAgentModes();
    this.isLoading.set(true);
    this.macroscopManageService.getEvtConfig(this.id()!).pipe(
      switchMap(dto => {
        const view = macroscopEvtAgentConfigDtoToView(dto, evtModes);
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
    if (!this.evtConfig()) return;
    this.evtConfig.update(e => {
      if (!e) return e;
      e.config = config ?? undefined;
      return e;
    });
    this.formGroup.patchValue({ config: config?.id ?? null, }, { emitEvent: false });
    if (config?.id) this.configMap.set(config.id, config);
    this.hasEvtChanges.set(hasChanges<MacroscopEvtAgentConfigView>(this.evtConfig()!, (this.evtConfig() as any)._orig));
    if (this.evtConfig()?.config) {
      this.hasCfgChanges.set(hasChanges<MacroscopAgentConfigView>(this.evtConfig()!.config!, (this.evtConfig()!.config as any)._orig));
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


  private onEvtConfigChange(): void {
    this.formGroup.get('config')!.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((configId: string | null) => {
        if (!configId) {
          this.afterLoadConfig(undefined);
          return;
        }
        if (configId !== this.evtConfig()?.config?.id) {
          this.loadConfig(configId);
        }
      });
  }

  private onModeChange(): void {
    this.formGroup.get('mode')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(mode => {
        const cfg = this.evtConfig();
        if (!cfg) return;
        if (cfg.mode === mode) return;

        const updated: MacroscopEvtAgentConfigView = {
          ...cfg,
          mode,
          modeWithInfo: macroscopEvtAgentModeFromId(mode, this.evtAgentModes()),
        } as MacroscopEvtAgentConfigView;
        (updated as any)._orig = (cfg as any)._orig;

        this.evtConfig.set(updated);
      });
  }

  onConfigChange = (newData: MacroscopAgentConfigView | undefined): void => {
    if (this.evtConfig()?.config && newData) {
      var newVal = this.evtConfig()?.config!;
      if (hasChanges<MacroscopAgentConfigView>(this.evtConfig()!.config!, newData)) {
        applyChanges<MacroscopAgentConfigView>(newVal, newData);
        this.evtConfig.update(v => { v!.config = newVal; return v; });
      }
    }
    if (this.evtConfig()?.config) {
      this.hasCfgChanges.set(hasChanges<MacroscopAgentConfigView>(this.evtConfig()!.config!, (this.evtConfig()!.config as any)._orig));
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
    if (!this.evtConfig()?.config) return;
    this.dialogService.confirm(`Отвязать конфигурацию сервера ${this.evtConfig()?.config?.name} от агента?`)
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
    if (!this.evtConfig()?.config) return;
    var cfg = this.evtConfig()!.config;
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

    const syncEvtBinding = (cfg: MacroscopAgentConfigView | undefined): Observable<MacroscopEvtAgentConfigView> => {
      const agentId = this.id()!;
      const modes = this.evtAgentModes();
      if (!cfg) {
        return this.macroscopManageService.unbindEvtConfig(agentId)
          .pipe(map(dto => macroscopEvtAgentConfigDtoToView(dto, modes)));
      }
      return this.macroscopManageService.bindEvtConfig(agentId, cfg.id)
        .pipe(map(dto => macroscopEvtAgentConfigDtoToView(dto, modes)));
    };

    const updateEvtConfig = (cfg: MacroscopAgentConfigView | undefined): Observable<MacroscopEvtAgentConfigView> => {
      const modes = this.evtAgentModes();
      const patched: MacroscopEvtAgentConfigView = {
        ...currEvtCfg,
        config: cfg,
      } as MacroscopEvtAgentConfigView;
      const dto = macroscopEvtAgentConfigViewToDto(patched);
      return this.macroscopManageService.updateEvtConfig(this.id()!, dto)
        .pipe(map(d => macroscopEvtAgentConfigDtoToView(d, modes)));
    };

    const currEvtCfg = this.evtConfig();
    if (!currEvtCfg) return;

    const currCfg = this.evtConfig()?.config;
    const isEvtChanged = this.hasEvtChanges();
    const isCfgChanged = this.hasCfgChanges();
    const isModeChanged = this.hasModeChanges();
    const isNewCfg = !!currCfg && isNewItem(currCfg);
    const oldCfgId = currCfg?.id;

    if (!isEvtChanged && !isCfgChanged && !isModeChanged) {
      this.notificationService.info('Нет изменений для сохранения');
      return;
    }

    this.isSaving.set(true);

    const persistedCfg$: Observable<MacroscopAgentConfigView | undefined> = isNewCfg
      ? createAndSaveConfig(currCfg!)
      : of(currCfg);

    persistedCfg$.pipe(
      switchMap(cfg => {
        const evt$: Observable<MacroscopEvtAgentConfigView | null> =
          isEvtChanged ? syncEvtBinding(cfg) : of(null);

        const cfg$: Observable<MacroscopEvtAgentConfigView | null> =
          (!isNewCfg && (isCfgChanged || isModeChanged))
            ? updateEvtConfig(cfg)
            : of(null);

        const channels$: Observable<MacroscopChannelView[] | null> =
          (!isNewCfg && cfg?.id && (cfg.channels?.length ?? 0) > 0)
            ? this.macroscopManageService.updateChannelsForConfig(
              cfg.id,
              cfg.channels!.map(c => macroscopChannelViewToDto(c)))
              .pipe(map(list => list.map(d => macroscopChannelDtoToView(d))))
            : of(null);

        return forkJoin({ evt: evt$, cfg: cfg$, channels: channels$ });
      }),
      map(({ evt, cfg, channels }) => {
        var res = evt ?? cfg ?? this.evtConfig() ?? undefined;
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
