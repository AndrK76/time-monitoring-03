import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { MacroscopActivityEventTypeView, MacroscopEventTypeView } from '../../macroscop-view.models';
import { macroscopActivityEventTypeFromId } from '../../macroscop-view.utils';

@Component({
  selector: 'app-macroscop-evttype-inplace-editor',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
  ],
  templateUrl: './macroscop-evttype-inplace-editor.component.html',
  styleUrl: './macroscop-evttype-inplace-editor.component.scss'
})
export class MacroscopEvttypeInplaceEditorComponent implements OnInit {
  eventType = input.required<MacroscopEventTypeView>();
  activityTypes = input.required<MacroscopActivityEventTypeView[]>();
  canEdit = input<boolean>(false);

  change = output<MacroscopEventTypeView>();

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  data!: MacroscopEventTypeView;

  ngOnInit(): void {
    this.data = this.eventType();
    this.buildForm();
    this.listenToChanges();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      id: [{ value: this.data.id, disabled: true }],
      name: [{ value: this.data.name ?? '', disabled: false }],
      activityTypeId: [{ value: this.data.activityTypeId ?? '', disabled: false }],
    });
  }

  private listenToChanges(): void {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter(() => this.form.valid),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const activityTypeId = values.activityTypeId || undefined;
        const updated = new MacroscopEventTypeView(
          this.data.id,
          values.name,
          activityTypeId,
          macroscopActivityEventTypeFromId(activityTypeId, this.activityTypes()),
        );
        this.change.emit(updated);
      });
  }

  currentActivityDescription(): string {
    const id = this.form?.get('activityTypeId')?.value;
    if (!id) return '— не выбрано —';
    return this.activityTypes().find(a => a.id === id)?.description ?? id;
  }
}