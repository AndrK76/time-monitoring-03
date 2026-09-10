// shared-components/src/lib/components/login-dialog/login-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { LoginDialogContentComponent } from '../login-dialog-content/login-dialog-content.component';
import { LoginDialogData, LoginDialogResult } from './login-dialog.model';
import { LoginRequestDto } from '@mon3/sa';

@Component({
  selector: 'sc-login-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, LoginDialogContentComponent],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.scss'
})
export class LoginDialogComponent {
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<LoginDialogComponent, LoginDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: LoginDialogData
  ) { }

  onSubmit(credentials: LoginRequestDto): void {
    this.dialogRef.close({ action: 'submitted', data: credentials });
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancelled' });
  }

  setError(message: string | null): void {
    this.errorMessage = message;
  }

  setLoading(value: boolean): void {
    this.isLoading = value;
  }
}