import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@mon3/shared';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  redirectUrl = '/admin';

  // Добавляем ссылку на другое приложение
  otherAppUrl = environment.otherAppUrl;
  otherAppName = environment.otherAppName;

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.router.navigate([this.redirectUrl]);
      return;
    }

    this.route.queryParams.subscribe(params => {
      this.redirectUrl = params['redirect'] || '/admin';
    });
  }

  onSubmit(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login({
      username: this.username,
      password: this.password
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate([this.redirectUrl]);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Ошибка авторизации. Проверьте логин и пароль.';
      }
    });
  }

  fillCredentials(username: string, password: string): void {
    this.username = username;
    this.password = password;
  }

}
