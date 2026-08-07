// projects/admin-test/src/app/features/auth/register.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@mon3/shared';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  //imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  email = '';
  displayName = '';
  firstName = '';
  lastName = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  isLoading = false;

  onSubmit(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Пароли не совпадают';
      this.isLoading = false;
      return;
    }

    this.authService.register({
      username: this.username,
      email: this.email,
      displayName: this.displayName,
      firstName: this.firstName,
      lastName: this.lastName,
      password: this.password
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Ошибка регистрации. Попробуйте позже.';
      }
    });
  }
}