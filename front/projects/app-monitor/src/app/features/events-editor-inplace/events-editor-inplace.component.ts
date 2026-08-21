import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Place, EventStatus } from '../../models/sample-data-model';
import { EventRow } from '../event-row';

@Component({
  selector: 'app-events-editor-inplace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
export class EventsEditorInplaceComponent {
  eventData = input.required<EventRow>();
  places = input.required<Place[]>();
  statuses = input.required<EventStatus[]>();

  change = output<EventRow>();

  get startLocal(): string {
    return this.toLocalDatetimeString(this.eventData().start);
  }
  set startLocal(value: string) {
    const utc = this.toUtcDateString(value);
    this.updateField('start', utc);
  }

  get endLocal(): string {
    return this.toLocalDatetimeString(this.eventData().end);
  }
  set endLocal(value: string) {
    const utc = this.toUtcDateString(value);
    this.updateField('end', utc);
  }

  private updateField<K extends keyof EventRow>(field: K, value: EventRow[K]): void {
    const current = this.eventData();
    if (!current) return;
    const updated = { ...current, [field]: value };
    this.change.emit(updated);
  }

  onFieldChange(field: keyof EventRow, value: any): void {
    this.updateField(field, value);
  }


  // Преобразование UTC -> локальная строка для datetime-local
  private toLocalDatetimeString(utcDateStr: string): string {
    if (!utcDateStr) return '';
    const date = parseISO(utcDateStr);
    const zoned = toZonedTime(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
    return format(zoned, "yyyy-MM-dd'T'HH:mm");
  }

  // Преобразование локальной строки -> UTC
  private toUtcDateString(localDatetimeStr: string): string {
    if (!localDatetimeStr) return '';
    const [datePart, timePart] = localDatetimeStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    // Создаём локальную дату
    const localDate = new Date(year, month - 1, day, hours, minutes);
    // Возвращаем UTC ISO (с Z)
    return localDate.toISOString();
  }

}