import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, merge, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  MacroscopAgentConfigView, MacroscopCredentialsView,
} from '../macroscop-view.models';
import { isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-macroscop-config-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatProgressSpinnerModule,
    MatDividerModule, MatFormFieldModule, MatInputModule,
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

  formName: FormGroup;   // { name }
  formServer: FormGroup; // { serverAddress, login, password }

  private currentConfig: MacroscopAgentConfigView | undefined;

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
    });

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

    this.formName.patchValue(
      { name: cfg?.name ?? '' },
      { emitEvent: false },
    );
    this.formServer.patchValue(
      {
        serverAddress: cfg?.serverAddress ?? '',
        login: cfg?.credentials?.login ?? '',
        password: cfg?.credentials?.password ?? '',
      },
      { emitEvent: false },
    );
  }

  private emitValue(): void {
    const base = this.currentConfig;
    if (!base) {
      this.valueChange.emit(undefined);
      return;
    }

    const { name } = this.formName.getRawValue();
    const { serverAddress, login, password } = this.formServer.getRawValue();

    const same =
      (name ?? '') === (base.name ?? '') &&
      (serverAddress ?? '') === (base.serverAddress ?? '') &&
      (login ?? '') === (base.credentials?.login ?? '') &&
      (password ?? '') === (base.credentials?.password ?? '');

    if (same) return;

    const credentials = new MacroscopCredentialsView();
    credentials.login = login || undefined;
    credentials.password = password || undefined;

    this.valueChange.emit(new MacroscopAgentConfigView(
      base.id,
      name,
      serverAddress || undefined,
      credentials,
    ));
  }
}