import { CommonModule } from '@angular/common';
import { Component, signal, output, input, effect, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TableFilterDateValue } from '../../models/table-filter-items';

@Component({
  selector: 'sc-filter-date',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './filter-date.component.html',
  styleUrl: './filter-date.component.scss'
})
export class FilterDateComponent implements OnDestroy {

  current = input<TableFilterDateValue | undefined>();
  change = output<TableFilterDateValue>();

  operator = signal('>');
  dateValue = signal('');

  private timeoutId: any = null;
  private lastEmittedValue: TableFilterDateValue | undefined = undefined;
  constructor() {
    effect(() => {
      const val = this.current();
      if (val) {
        const newOperator = val.greatest ? '>' : '<';
        const newDate = val.date || '';
        if (this.operator() !== newOperator) {
          this.operator.set(newOperator);
        }
        if (this.dateValue() !== newDate) {
          this.dateValue.set(newDate);
        }
        this.lastEmittedValue = val;
      }
    }, { allowSignalWrites: true });
  }


  toggleOperator() {
    this.operator.set(this.operator() === '>' ? '<' : '>');
    const currentDate = this.dateValue();
    if (currentDate) {
      const newValue: TableFilterDateValue = { greatest: this.operator() === '>', date: currentDate };
      if (this.lastEmittedValue?.greatest !== newValue.greatest || this.lastEmittedValue?.date !== newValue.date) {
        this.lastEmittedValue = newValue;
        this.change.emit(newValue);
      }
    }
  }


  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let raw = input.value.replace(/\D/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = '';
    if (raw.length > 2) {
      formatted += raw.slice(0, 2) + '.';
      if (raw.length > 4) {
        formatted += raw.slice(2, 4) + '.';
        formatted += raw.slice(4);
      } else {
        formatted += raw.slice(2);
      }
    } else {
      formatted = raw;
    }

    input.value = formatted;
    this.dateValue.set(formatted);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      const newValue: TableFilterDateValue = { greatest: this.operator() === '>', date: formatted };
      if (this.lastEmittedValue?.greatest !== newValue.greatest || this.lastEmittedValue?.date !== newValue.date) {
        this.lastEmittedValue = newValue;
        this.change.emit(newValue);
      }
      this.timeoutId = null;
    }, 300);
  }

  onKeyDown(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (allowedKeys.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

}