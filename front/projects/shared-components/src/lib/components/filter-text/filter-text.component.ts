import { CommonModule } from '@angular/common';
import { Component, effect, input, OnDestroy, output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TableFilterTextValue } from '../../models/table-filter-items';

@Component({
  selector: 'sc-filter-text',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatTooltipModule],
  templateUrl: './filter-text.component.html',
  styleUrl: './filter-text.component.scss'
})
export class FilterTextComponent implements OnDestroy {
  current = input<TableFilterTextValue | undefined>();
  change = output<TableFilterTextValue>();

  textValue = signal('');

  private timeoutId: any = null;
  private lastEmittedValue: TableFilterTextValue | undefined = undefined;

  constructor() {
    effect(() => {
      const val = this.current();
      if (val !== undefined) {
        const newText = `${val.flag ?? ''}${val.text ?? ''}`;
        this.textValue.set(`${val.flag ?? ''}${val.text ?? ''}`);
        if (this.textValue() !== newText) {
          this.textValue.set(newText);
        }
        this.lastEmittedValue = val;
      }
    }, { allowSignalWrites: true });
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const src: string | undefined = input.value;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      let flag: string | undefined = undefined;
      let text: string | undefined = src;
      if (src && src.length > 1 && src.at(0) === '~') {
        flag = src.substring(0, 2); // например "~0", "~1", "~!"
        text = src.substring(2);
      } else {
        flag = undefined;
        text = src || '';
      }
      const newValue: TableFilterTextValue = { flag, text };
      if (this.lastEmittedValue?.flag !== newValue.flag || this.lastEmittedValue?.text !== newValue.text) {
        this.lastEmittedValue = newValue;
        this.change.emit(newValue);
      }
      this.timeoutId = null;
    }, 300);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
  }



}
