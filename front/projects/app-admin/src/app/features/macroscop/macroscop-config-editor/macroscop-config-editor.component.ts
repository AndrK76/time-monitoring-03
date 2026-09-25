import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, finalize, merge, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  MacroscopAgentConfigView, MacroscopCredentialsView,
} from '../macroscop-view.models';
import { DialogService, isNewItem, isNotFullLoadedItem, IsoNoMsPipe, MacroscopServerCredentials, MacroscopServerInfoDto, NotificationService } from '@mon3/sc';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MacroscopManageService } from '../../../services/macroscop-manage.service';
import { processResponseError } from '@mon3/sa';

@Component({
  selector: 'app-macroscop-config-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDividerModule, MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule,
    IsoNoMsPipe,
  ],
  templateUrl: './macroscop-config-editor.component.html',
  styleUrl: './macroscop-config-editor.component.scss',
})
export class MacroscopConfigEditorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  config = input<MacroscopAgentConfigView | undefined>(undefined);
  loadItemFn = input<(item: MacroscopAgentConfigView) => Observable<MacroscopAgentConfigView | undefined>>();

  valueChange = output<MacroscopAgentConfigView | undefined>();
  loaded = output<MacroscopAgentConfigView>();
  loading = signal(false);
  inLoadServerInfo = signal(false);

  currentServerInfo = signal<MacroscopServerInfoDto | undefined>(undefined);
  isNew = computed(() => { const cfg = this.config(); return !!cfg && isNewItem(cfg); });

  formName: FormGroup;   // { name }
  formServer: FormGroup; // { serverAddress, login, password }

  private currentConfig: MacroscopAgentConfigView | undefined;

  private readonly notificationService = inject(NotificationService);
  private readonly dialogService = inject(DialogService);
  private readonly macroscopManageService = inject(MacroscopManageService);

  constructor() {
    this.formName = this.fb.group({
      name: [''],
    });
    this.formServer = this.fb.group({
      serverAddress: [''],
      login: [''],
      password: [''],
    });

    effect(() => {
      const cfg = this.config();
      if (cfg && isNotFullLoadedItem(cfg) && !isNewItem(cfg) && this.loadItemFn()) {
        return;
      }
      this.applyConfig(this.config());
    }, { allowSignalWrites: true });

    merge(this.formName.valueChanges, this.formServer.valueChanges)
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.emitValue());
  }

  ngOnInit(): void {
    const cfg = this.config();
    if (cfg && isNotFullLoadedItem(cfg) && !isNewItem(cfg) && this.loadItemFn()) {
      this.loadDetails(cfg);
    } else {
      this.applyConfig(cfg);
    }
  }

  private loadDetails(cfg: MacroscopAgentConfigView): void {
    this.loading.set(true);
    this.loadItemFn()!(cfg)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: full => {
          this.loading.set(false);
          if (!full) return;
          this.applyConfig(full);
          this.loaded.emit(full);
        },
        error: () => this.loading.set(false),
      });
  }

  private applyConfig(cfg: MacroscopAgentConfigView | undefined): void {
    this.currentConfig = cfg;
    this.currentServerInfo.set(cfg?.serverInfo);

    this.formName.patchValue({ name: cfg?.name ?? '' }, { emitEvent: false });
    this.formServer.patchValue(
      {
        serverAddress: cfg?.serverAddress ?? '',
        login: cfg?.credentials?.login ?? '',
        password: cfg?.credentials?.password ?? '',
      },
      { emitEvent: false },
    );
  }

  private buildCurrentConfig(serverInfo?: MacroscopServerInfoDto): MacroscopAgentConfigView | undefined {
    const base = this.currentConfig;
    if (!base) return undefined;

    const { name } = this.formName.getRawValue();
    const { serverAddress, login, password } = this.formServer.getRawValue();

    const credentials = new MacroscopCredentialsView();
    credentials.login = login || undefined;
    credentials.password = password || undefined;

    return new MacroscopAgentConfigView(
      base.id,
      name,
      serverAddress || undefined,
      credentials,
      serverInfo ?? this.currentServerInfo(),
    );
  }

  private emitValue(): void {
    const base = this.currentConfig;
    if (!base) {
      this.valueChange.emit(undefined);
      return;
    }

    const current = this.buildCurrentConfig();
    if (!current) {
      this.valueChange.emit(undefined);
      return;
    }

    const same =
      (current.name ?? '') === (base.name ?? '') &&
      (current.serverAddress ?? '') === (base.serverAddress ?? '') &&
      (current.credentials?.login ?? '') === (base.credentials?.login ?? '') &&
      (current.credentials?.password ?? '') === (base.credentials?.password ?? '');

    if (!same) this.valueChange.emit(current);
  }


  callServerInfo() {
    const { serverAddress, login, password } = this.formServer.getRawValue();
    if (!serverAddress || !login || !password) {
      this.notificationService.error('Заполните информацию о сервере');
    } else {
      const creds: MacroscopServerCredentials = { address: serverAddress, login: login, password: password };
      this.dialogService.confirm(`Проверить соединение с сервером?`)
        .subscribe(confirmed => { if (confirmed) this.doGetServerInfo(creds); });

    }
  }

  doGetServerInfo(creds: MacroscopServerCredentials) {
    this.inLoadServerInfo.set(true);
    this.macroscopManageService.getServerInfoByCreds(creds).pipe(
      finalize(() => this.inLoadServerInfo.set(false))
    ).subscribe({
      next: result => {
        if (!result.success) {
          this.notificationService.error(result.errorMessage ?? 'Ошибка при проверке соединения');
          return;
        }
        const serverInfo = result.data;
        this.currentServerInfo.set(serverInfo);
        const updated = this.buildCurrentConfig(serverInfo);
        if (updated) this.valueChange.emit(updated);
        this.notificationService.success('Соединение успешно');
      },
      error: err => this.notificationService.error(processResponseError(err).message ?? 'Ошибка проверки соединения'),
    });

  }
}