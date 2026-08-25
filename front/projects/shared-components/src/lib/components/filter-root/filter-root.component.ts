import { Component, computed, input, output } from '@angular/core';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FilterListComponent } from '../filter-list/filter-list.component';
import { FilterDateComponent } from '../filter-date/filter-date.component';
import { FilterTextComponent } from '../filter-text/filter-text.component';
import { TableFilterDateValue, TableFilterInfo, TableFilterListValue, TableFilterTextValue, TableFilterType } from '../../models/table-filter-items';


@Component({
  selector: 'sc-filter-root',
  standalone: true,
  imports: [MatTableModule, MatTooltipModule, MatSortModule,
    FilterListComponent, FilterDateComponent, FilterTextComponent],
  templateUrl: './filter-root.component.html',
  styleUrl: './filter-root.component.scss'
})
export class FilterRootComponent {

  key = input.required<string>({ alias: 'key' });
  label = input.required<string>({ alias: 'label' });
  showFilter = input.required<boolean>({ alias: 'showFilter' });
  sortable = input<boolean>(false, { alias: 'sort' });
  config = input.required<TableFilterInfo>({ alias: 'config' });

  change = output<TableFilterInfo>();


  public TableFilterType = TableFilterType;

  onChange(val: any) {
    let retVal: TableFilterListValue | TableFilterDateValue | TableFilterTextValue | undefined = undefined;
    if (this.config().type === TableFilterType.LIST) {
      retVal = val as TableFilterListValue;
    } else if (this.config().type === TableFilterType.DATE) {
      retVal = val as TableFilterDateValue;
    } else if (this.config().type === TableFilterType.TEXT) {
      retVal = val as TableFilterTextValue;
    }
    const ret: TableFilterInfo = { ...this.config(), value: retVal, config: undefined };
    this.change.emit(ret);
  }

  initialVal = computed(() => {
    const val = this.config().value;
    if (this.config().type === TableFilterType.LIST && this.config().value) {
      return (this.config().value! as TableFilterListValue).id;
    } else if (this.config().type === TableFilterType.DATE) {
      return val as TableFilterDateValue | undefined;
    } else if (this.config().type === TableFilterType.TEXT) {
      return (val as TableFilterTextValue)?.text || undefined;
    } {
      return undefined;
    }
  })



}
