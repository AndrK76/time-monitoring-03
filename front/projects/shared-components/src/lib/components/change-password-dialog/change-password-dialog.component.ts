import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ChangePasswordDialogData, ChangePasswordDialogResult } from './change-password-dialog.model';

@Component({
  selector: 'sc-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './change-password-dialog.component.html',
  styleUrl: './change-password-dialog.component.scss'
})
export class ChangePasswordDialogComponent implements OnInit {
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<ChangePasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ChangePasswordDialogData,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      currentPassword: [''],
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Если нужно показывать старый пароль — добавляем валидатор обязательности
    if (this.data.showOldPassword) {
      this.form.get('currentPassword')?.setValidators([Validators.required]);
    } else {
      this.form.get('currentPassword')?.clearValidators();
    }
    this.form.get('currentPassword')?.updateValueAndValidity();
  }

  passwordMatchValidator(group: FormGroup) {
    const newPass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return newPass === confirm ? null : { mismatch: true };
  }

  onSet(): void {
    if (this.form.invalid) return;
    const { currentPassword, newPassword, confirmPassword } = this.form.value;
    const result: ChangePasswordDialogResult = {
      action: 'set',
      data: { currentPassword, newPassword, confirmPassword }
    };
    this.dialogRef.close(result);
  }

  onReset(): void {
    this.dialogRef.close({ action: 'reset' } as ChangePasswordDialogResult);
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' } as ChangePasswordDialogResult);
  }
}