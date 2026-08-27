import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export class ConfirmDialogCancelData {
  constructor(
    public readonly message: string,
    public readonly title: string = 'Подтвердить',
    public readonly yes: string = 'Да',
    public readonly no: string = 'Нет',
    public readonly cancel: string = 'Отмена'
  ) {
    if (!title) title = 'Подтвердить';
    if (!yes) yes = 'Да';
    if (!no) no = 'Нет';
    if (!cancel) no = 'Отмена';
  }
}

export type ConfirmDialogCancelResult = 'yes' | 'no' | 'cancel';

@Component({
  selector: 'sc-confirm-dialog-cancel',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog-cancel.component.html',
  styleUrl: './confirm-dialog-cancel.component.scss'
})
export class ConfirmDialogCancelComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogCancelComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogCancelData
  ) { }

  onYes(): void {
    this.dialogRef.close('yes');
  }

  onNo(): void {
    this.dialogRef.close('no');
  }

  onCancel(): void {
    this.dialogRef.close('cancel');
  }
}
