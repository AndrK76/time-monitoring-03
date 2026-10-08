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
import { DialogService, isNewItem, isNotFullLoadedItem, MacroscopChannelListDto } from '@mon3/sc';
import { MacroscopImgPlaceView } from '../../macroscop-view.models';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-macroscop-img-place-inplace-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatIconModule, MatButtonModule, MatSelectModule,
  ],
  templateUrl: './macroscop-img-place-inplace-editor.component.html',
  styleUrl: './macroscop-img-place-inplace-editor.component.scss'
})
export class MacroscopImgPlaceInplaceEditorComponent implements OnInit {
  placeData = input.required<MacroscopImgPlaceView>();
  loadItemFn = input<(item: MacroscopImgPlaceView) => Observable<MacroscopImgPlaceView | undefined>>();
  freeChannels = input<MacroscopChannelListDto[]>([]);
  get isNew(): boolean { return isNewItem(this.data); }

  change = output<MacroscopImgPlaceView>();
  loaded = output<MacroscopImgPlaceView>();
  restoreDeleted = output<MacroscopImgPlaceView>();
  screenshotRequested = output<{ mode: 'current' | 'archive'; place: MacroscopImgPlaceView }>();

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);

  form!: FormGroup;
  data!: MacroscopImgPlaceView;

  canDelete = (): boolean => isNewItem(this.data);

  get present(): boolean { return this.form?.get('present')?.value ?? false; }
  get deleted(): boolean { return this.form?.get('deleted')?.value ?? false; }
  get showChannelSelect(): boolean { return this.isNew && !this.form?.get('macroscopId')?.value; }

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
      internalName: [{ value: this.data.internalName ?? '', disabled: false }],
      macroscopId: [{ value: this.data.macroscopId ?? '', disabled: false }],
      channelId: [{ value: this.data.channelId ?? '', disabled: false }],
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
      internalName: this.data.internalName ?? '',
      macroscopId: this.data.macroscopId ?? '',
      channelId: this.data.channelId ?? '',
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
      const updated: MacroscopImgPlaceView = {
        ...this.data,
        name: values.name,
        internalName: values.internalName,
        macroscopId: values.macroscopId,
        channelId: values.channelId,
        present: values.present,
        used: values.used,
      };
      this.change.emit(updated);
    }

    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => emitChange());
    this.form.get('macroscopId')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((macroscopId: string) => {
        if (!macroscopId) return;
        const ch = this.freeChannels().find(c => c.macroscopId === macroscopId);
        if (!ch) return;
        this.form.patchValue({ internalName: ch.name ?? '' }, { emitEvent: false });
        this.form.patchValue({ name: ch.name ?? '' }, { emitEvent: false });
        this.form.patchValue({ present: ch.exists ?? false }, { emitEvent: false });
        this.form.patchValue({ channelId: ch.id }, { emitEvent: false });
        emitChange();
      });
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