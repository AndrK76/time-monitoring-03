// projects/admin-test/src/app/features/profile/change-password.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '@mon3/shared';


@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  onSubmit(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Новый пароль и подтверждение не совпадают';
      this.isLoading = false;
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Новый пароль должен быть не менее 6 символов';
      this.isLoading = false;
      return;
    }

    this.authService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = '✅ Пароль успешно изменён!';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Ошибка смены пароля. Проверьте текущий пароль.';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}