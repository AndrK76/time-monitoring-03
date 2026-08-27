import { Component, effect, inject, input, output, signal, ViewChild, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EventsEditorInplaceComponent } from '../events-editor-inplace/events-editor-inplace.component';
import { EventRow } from '../event-row';
import { Place, EventStatus } from '../../models/sample-data-model';
import { DialogService, hasChanges, isNewItem, isNotApplyItem, removeNotApplyItemFlag } from '@mon3/sc';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-events-editor-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    EventsEditorInplaceComponent,
    MatDialogModule
  ],
  templateUrl: './events-editor-container.component.html',
  styleUrl: './events-editor-container.component.scss'
})
export class EventsEditorContainerComponent {
  private dialogService = inject(DialogService);

  eventData = input.required<EventRow>();
  places = input.required<Place[]>();
  statuses = input.required<EventStatus[]>();

  change = output<EventRow>();
  exit = output<EventRow>();


  toEditItem: WritableSignal<EventRow | undefined> = signal(undefined);
  resultItem!: EventRow;
  dataChanged = signal(false);
  inited = false;

  @ViewChild(EventsEditorInplaceComponent) editorInplace!: EventsEditorInplaceComponent;

  constructor() {
    effect(() => {
      ///console.log('effect');
      this.toEditItem.set({ ...this.eventData() });
      this.resultItem = { ...this.eventData() };
      this.inited = true;
      this.dataChanged.set(isNewItem(this.eventData()));
    }, { allowSignalWrites: true });
  }

  onChange(item: EventRow) {
    //console.log(item);
    this.dataChanged.set(hasChanges<EventRow>(item, this.eventData(), ['placeName', 'statusName', 'statusColor', 'details'])
      || isNewItem(this.eventData()));
    if (this.dataChanged()) {
      this.resultItem = { ...item };
    }

  }

  applyChanges() {
    //console.error(this.resultItem);
    if (isNewItem(this.eventData())) this.editorInplace.updateDerived(this.resultItem);
    if (isNotApplyItem(this.resultItem)) this.resultItem = removeNotApplyItemFlag(this.resultItem);

    this.change.emit(this.resultItem);
    this.exit.emit(this.resultItem);
  }

  rejectChanges() {
    this.resultItem = { ...this.eventData() };
    this.toEditItem.update((v) => {
      return { ...this.eventData() };
    });
    this.dataChanged.set(false);
    if (this.editorInplace) {
      this.editorInplace.resetToData(this.eventData());
    }
    this.exit.emit(this.resultItem);

  }

  callBack() {
    if (this.dataChanged()) {
      this.dialogService.confirmWithCancel('Данные изменены. Применить изменения?').subscribe(result => {
        if (result === 'yes') {
          this.applyChanges();
        } else if (result === 'no') {
          this.rejectChanges();
        }
      });
    } else {
      this.exit.emit(this.resultItem);
    }
  }


}