import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TableFilterListValue } from '../../models/table-filter-items';

@Component({
  selector: 'sc-filter-list',
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './filter-list.component.html',
  styleUrl: './filter-list.component.scss'
})
export class FilterListComponent {
  current = input<any>(undefined, { alias: 'current' })
  datasource = input<TableFilterListValue[]>([], { alias: 'datasource' });
  change = output<TableFilterListValue | undefined>();

  onChange(value: any) {
    const ret = this.datasource().find(f => f.id === value);
    this.change.emit(ret);
  }


}

