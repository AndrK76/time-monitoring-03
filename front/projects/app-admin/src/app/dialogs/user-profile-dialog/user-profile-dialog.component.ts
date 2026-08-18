import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ViewCurrentProfileComponent } from '@mon3/sc';

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    ViewCurrentProfileComponent
  ],
  templateUrl: './user-profile-dialog.component.html',
  styleUrl: './user-profile-dialog.component.scss'
})
export class UserProfileDialogComponent {
  constructor(public dialogRef: MatDialogRef<UserProfileDialogComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}