import { Component, Inject, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { finalize, map } from 'rxjs';
import { NotificationService } from '@mon3/sc';
import { processResponseError } from '@mon3/sa';

import { MacroscopChannelView, MacroscopEvtPlaceView } from '../../macroscop-view.models';
import { macroscopEvtPlaceDtoToView } from '../../macroscop-view.utils';
import { MacroscopManageService } from '../../../../services/macroscop-manage.service';

export interface MacroscopEvtPlaceAddDialogData {
  agentId: string;
  mode: string;                       // 'byAnalytic' | 'byMovingDetector' | 'unknown'
  searchPlaceDepthInHours: number;
  channels: MacroscopChannelView[];
}

export type MacroscopEvtPlaceAddDialogResult = MacroscopEvtPlaceView[] | undefined;

interface SearchResult {
  success: boolean;
  errorMessage?: string;
  places: MacroscopEvtPlaceView[];
  lastTime?: string;
}

@Component({
  selector: 'app-macroscop-evt-place-add-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule,
    MatIconModule, MatProgressSpinnerModule, MatDividerModule,
  ],
  templateUrl: './macroscop-evt-place-add-dialog.component.html',
  styleUrl: './macroscop-evt-place-add-dialog.component.scss'
})
export class MacroscopEvtPlaceAddDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<MacroscopEvtPlaceAddDialogComponent, MacroscopEvtPlaceAddDialogResult>);
  private readonly dataService = inject(MacroscopManageService);
  private readonly notificationService = inject(NotificationService);

  selectedChannelId: string | undefined;

  isSearching = signal(false);
  searched = signal(false);
  places = signal<MacroscopEvtPlaceView[]>([]);
  lastTime = signal<string | undefined>(undefined);

  private readonly knownIds = new Set<string>();

  isAnalyticMode = computed(() => this.data.mode === 'byAnalytic');
  canContinue = computed(() => this.isAnalyticMode() && !!this.lastTime() && !this.isSearching());

  constructor(@Inject(MAT_DIALOG_DATA) public data: MacroscopEvtPlaceAddDialogData) {
    this.selectedChannelId = data.channels[0]?.macroscopId;
  }

  onChannelChange(channelId: string | undefined): void {
    this.selectedChannelId = channelId;
    this.places.set([]);
    this.knownIds.clear();
    this.lastTime.set(undefined);
    this.searched.set(false);
  }

  find(): void {
    const channelId = this.selectedChannelId;
    if (!channelId) return;

    this.places.set([]);
    this.knownIds.clear();
    this.lastTime.set(undefined);
    this.searched.set(false);

    this.doSearch(channelId, undefined);
  }

  continueSearch(): void {
    const channelId = this.selectedChannelId;
    const before = this.lastTime();
    if (!channelId || !before) return;

    this.doSearch(channelId, before);
  }

  private doSearch(channelId: string, before: string | undefined): void {
    this.isSearching.set(true);

    const req$ = this.isAnalyticMode()
      ? this.dataService.getEvtPlacesInActionModeForChannel(this.data.agentId, channelId, before).pipe(
        map(resp => ({
          success: !!resp.success,
          errorMessage: resp.errorMessage,
          places: (resp.data?.places ?? []).map(dto => macroscopEvtPlaceDtoToView(dto)),
          lastTime: resp.data?.lastTime,
        } as SearchResult)),
      )
      : this.dataService.getEvtPlacesInDetectorModeForConfigAndChannel(this.data.agentId, channelId).pipe(
        map(resp => ({
          success: !!resp.success,
          errorMessage: resp.errorMessage,
          places: (resp.data ?? []).map(dto => macroscopEvtPlaceDtoToView(dto)),
          lastTime: undefined,
        } as SearchResult)),
      );

    req$.pipe(
      finalize(() => this.isSearching.set(false)),
    ).subscribe({
      next: resp => {
        if (!resp.success) {
          this.notificationService.error(resp.errorMessage ?? 'Ошибка поиска мест');
          return;
        }
        const newPlaces = resp.places.filter(p => !this.knownIds.has(p.internalId));
        newPlaces.forEach(p => this.knownIds.add(p.internalId));
        this.places.update(list => [...list, ...newPlaces]);
        this.lastTime.set(resp.lastTime);
        this.searched.set(true);
      },
      error: err => {
        const resError = processResponseError(err);
        this.notificationService.error(`Ошибка поиска мест: ${resError.message}`);
      },
    });
  }

  onOk(): void {
    this.dialogRef.close(this.places());
  }

  onCancel(): void {
    this.dialogRef.close(undefined);
  }
}