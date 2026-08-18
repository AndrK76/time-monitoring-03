import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, LoginRequestDto } from '@mon3/sa';

@Component({
  selector: 'sc-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  credentials: LoginRequestDto = { username: '', password: '' };
  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    //console.log(`Authentificated: {}`, this.authService.isAuthenticated);
    // Если пользователь уже авторизован, перенаправляем на главную
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/']);
    }
  }

  onSubmit() {
    this.errorMessage = null; // очищаем предыдущую ошибку
    this.isLoading = true;
    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Login failed', err);
        // Извлекаем сообщение из ответа сервера
        this.errorMessage = err.error?.message || err.message || 'Ошибка входа. Попробуйте позже.';
      }
    });
  }
}