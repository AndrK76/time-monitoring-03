import { Component, DestroyRef, inject, input, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, Observable } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { DialogService, isNewItem, isNotFullLoadedItem } from '@mon3/sc';
import { MacroscopEvtPlaceView } from '../../macroscop-view.models';
import { MacroscopZoneInfoPipe } from '../../../../pipes/macroscop-zone-info.pipe';

@Component({
  selector: 'app-macroscop-evt-place-inplace-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatIconModule, MatButtonModule,
    MacroscopZoneInfoPipe,
  ],
  templateUrl: './macroscop-evt-place-inplace-editor.component.html',
  styleUrl: './macroscop-evt-place-inplace-editor.component.scss'
})
export class MacroscopEvtPlaceInplaceEditorComponent implements OnInit {
  placeData = input.required<MacroscopEvtPlaceView>();
  loadItemFn = input<(item: MacroscopEvtPlaceView) => Observable<MacroscopEvtPlaceView | undefined>>();
  get isNew(): boolean { return isNewItem(this.data); }

  change = output<MacroscopEvtPlaceView>();
  loaded = output<MacroscopEvtPlaceView>();
  restoreDeleted = output<MacroscopEvtPlaceView>();
  screenshotRequested = output<{ mode: 'current' | 'archive'; place: MacroscopEvtPlaceView }>();

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);

  form!: FormGroup;
  data!: MacroscopEvtPlaceView;



  get present(): boolean { return this.form?.get('present')?.value ?? false; }
  get deleted(): boolean { return this.form?.get('deleted')?.value ?? false; }

  ngOnInit(): void {
    this.data = this.placeData();
    this.buildForm();
    this.listenToChanges();
    this.loadDetails();
  }

  private buildForm(): void {
    const isDeleted = this.data.deleted === true;
    this.form = this.fb.group({
      name: [{ value: this.data.name ?? '', disabled: false }],
      channelId: [{ value: this.data.channelId ?? '', disabled: false }],
      channelName: [{ value: this.data.channelName ?? '', disabled: false }],
      internalId: [{ value: this.data.internalId ?? '', disabled: false }],
      internalName: [{ value: this.data.internalName ?? '', disabled: false }],
      placeId: [{ value: this.data.id ?? '', disabled: true }],
      used: [{ value: this.data.used ?? false, disabled: isDeleted }],
      present: [{ value: this.data.present ?? false, disabled: true }],
      deleted: [{ value: this.data.deleted ?? false, disabled: true }],
    });
  }

  private patchForm(): void {
    const isDeleted = this.data.deleted === true;
    this.form.patchValue({
      name: this.data.name ?? '',
      channelId: this.data.channelId ?? '',
      channelName: this.data.channelName ?? '',
      internalId: this.data.internalId ?? '',
      internalName: this.data.internalName ?? '',
      placeId: this.data.id ?? '',
      used: this.data.used ?? false,
      present: this.data.present ?? false,
      deleted: this.data.deleted ?? false,
    }, { emitEvent: false });

    const usedCtrl = this.form.get('used');
    if (isDeleted) usedCtrl?.disable({ emitEvent: false });
    else usedCtrl?.enable({ emitEvent: false });
  }

  private loadDetails(): void {
    if (isNotFullLoadedItem(this.data) && !isNewItem(this.data) && this.loadItemFn()) {
      this.loadItemFn()!(this.data)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            if (data) {
              this.data = data;
              this.patchForm();
              this.loaded.emit(this.data);
            }
          },
          error: () => { /* ошибка обрабатывается в родителе */ },
        });
    }
  }

  private listenToChanges(): void {
    const emitChange = (): void => {
      const values = this.form.getRawValue();
      const updated: MacroscopEvtPlaceView = {
        ...this.data,
        name: values.name,
        used: values.used,
      };
      this.change.emit(updated);
    };

    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => emitChange());
  }

  callRestore(): void {
    this.dialogService.confirm('Восстановить удалённую запись?').subscribe(confirmed => {
      if (confirmed) {
        this.restoreDeleted.emit(this.placeData());
      }
    });
  }

  callGetCurrentScreenshot(): void {
    this.screenshotRequested.emit({ mode: 'current', place: this.placeData() });
  }

  callGetArchiveScreenshot(): void {
    this.screenshotRequested.emit({ mode: 'archive', place: this.placeData() });
  }
}