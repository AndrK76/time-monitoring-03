import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ShowImageDialogData {
  url: string;
  title: string;
}

@Component({
  selector: 'sc-show-image-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './show-image-dialog.component.html',
  styleUrl: './show-image-dialog.component.scss'
})
export class ShowImageDialogComponent {
  data = inject<ShowImageDialogData>(MAT_DIALOG_DATA);
}
