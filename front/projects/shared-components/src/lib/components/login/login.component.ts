import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { AuthService, LoginRequestDto } from '@mon3/sa';
import { LoginDialogContentComponent } from '../login-dialog-content/login-dialog-content.component';


@Component({
  selector: 'sc-login',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    LoginDialogContentComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/']);
    }
  }

  onSubmit(credentials: LoginRequestDto): void {
    this.errorMessage = null;
    this.isLoading = true;
    this.authService.login(credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || err.message || 'Ошибка входа. Попробуйте позже.';
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/home']);
  }
}