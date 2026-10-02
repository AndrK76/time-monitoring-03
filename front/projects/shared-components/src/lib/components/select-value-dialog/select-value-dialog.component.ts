import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

export interface SelectValueDialogDataItem {
  id: string;
  name: string;
}

export class SelectValueDialogData {
  constructor(
    public readonly title: string = 'Выбор значения',
    public readonly data: SelectValueDialogDataItem[] = [],
    public readonly selectedId: string | undefined = undefined,
    public readonly selectLabel: string = 'Выбрать',
    public readonly cancelLabel: string = 'Отмена',
  ) { }
}

export type SelectValueDialogResult = string | undefined;

@Component({
  selector: 'sc-select-value-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule,
  ],
  templateUrl: './select-value-dialog.component.html',
  styleUrl: './select-value-dialog.component.scss'
})
export class SelectValueDialogComponent {
  selectedId: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<SelectValueDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SelectValueDialogData,
  ) {
    // по умолчанию — переданный selectedId, если он не задан — первый элемент
    this.selectedId = data.selectedId ?? data.data[0]?.id;
  }

  onSelect(): void {
    this.dialogRef.close(this.selectedId);
  }

  onCancel(): void {
    this.dialogRef.close(undefined);
  }
}