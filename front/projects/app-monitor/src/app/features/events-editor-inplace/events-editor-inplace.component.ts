import { Component, input, output, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Place, EventStatus } from '../../models/sample-data-model';
import { EventRow } from '../event-row';
import { fromLocalInputToUtc, toLocalInputString } from '@mon3/sc';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-events-editor-inplace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './events-editor-inplace.component.html',
  styleUrl: './events-editor-inplace.component.scss'
})
export class EventsEditorInplaceComponent implements OnInit {
  eventData = input.required<EventRow>();
  places = input.required<Place[]>();
  statuses = input.required<EventStatus[]>();

  private originalStart!: string;
  private originalEnd!: string;

  change = output<EventRow>();


  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;

  ngOnInit(): void {
    this.buildForm();
    this.listenToChanges();
  }


  private buildForm(): void {
    const data = this.eventData();
    this.originalStart = data.start;
    this.originalEnd = data.end;
    this.form = this.fb.group({
      id: [{ value: data.id, disabled: true }],
      placeId: [data.placeId, Validators.required],
      statusCode: [data.statusCode, Validators.required],
      start: [toLocalInputString(data.start), Validators.required],
      end: [toLocalInputString(data.end), Validators.required],
      booking_id: [data.booking_id || '']
    });
  }

  updateDerived = (row: EventRow): void => {
    const placesMap = new Map(this.places().map(p => [p.id, p.name]));
    const statusesMap = new Map(this.statuses().map(s => [s.code, s]));

    const placeName = placesMap.get(row.placeId) || row.placeId;
    const status = statusesMap.get(row.statusCode);
    const statusName = status?.name || row.statusCode;
    const statusColor = status?.color;

    row.placeName = placeName;
    row.statusName = statusName;
    row.statusColor = statusColor;

    const startStr = row.start ? row.start.replace('T', ' ').slice(0, 16) : '';
    const endStr = row.end ? row.end.replace('T', ' ').slice(0, 16) : '';
    row.details = `Место: ${placeName} | Статус: ${statusName} | ${startStr} – ${endStr} | ID: ${row.booking_id || '—'}`;
  };

  private listenToChanges(): void {
    this.form.valueChanges
      .pipe(
        debounceTime(300), // задержка перед отправкой
        distinctUntilChanged(),
        filter(() => this.form.valid),
        filter(values => values && (typeof values === 'object')),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(values => {
        const startChanged = values.start !== toLocalInputString(this.originalStart);
        const endChanged = values.end !== toLocalInputString(this.originalEnd);

        const updated: EventRow = {
          id: this.eventData().id,
          placeId: values.placeId,
          statusCode: values.statusCode,
          //start: toUtcDateString(values.start),
          //end: toUtcDateString(values.end),
          start: startChanged ? fromLocalInputToUtc(values.start) : this.originalStart,
          end: endChanged ? fromLocalInputToUtc(values.end) : this.originalEnd,
          booking_id: values.booking_id || undefined,
          placeName: this.eventData().placeName,
          statusName: this.eventData().statusName,
          statusColor: this.eventData().statusColor,
          details: this.eventData().details
        };
        this.updateDerived(updated);
        //console.log(`emit: ${JSON.stringify(updated)}`)
        this.change.emit(updated);
      });
  }

  resetToData(data: EventRow): void {
    this.originalStart = data.start;
    this.originalEnd = data.end;
    this.form.patchValue({
      placeId: data.placeId,
      statusCode: data.statusCode,
      start: toLocalInputString(data.start),
      end: toLocalInputString(data.end),
      booking_id: data.booking_id || ''
    }, { emitEvent: false });
  }

}