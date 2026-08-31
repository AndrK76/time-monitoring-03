import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@mon3/sa';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'sc-logout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.scss'
})
export class LogoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private navigationService = inject(NavigationService);

  isLoading = false;
  errorMessage: string | null = null;
  returnUrl: string = '/';

  ngOnInit(): void {
    this.returnUrl = this.navigationService.getPreviousUrl() || '/'
  }


  confirmLogout(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.authService.logout().subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Logout error:', err);
        this.errorMessage = err.error?.message || err.message || 'Ошибка выхода. Попробуйте позже.';
        // Даже при ошибке перенаправляем на главную
        this.router.navigate(['/']);
      }
    });
  }

  cancel(): void {
    // Возвращаемся на предыдущую страницу или на главную
    this.router.navigateByUrl(this.returnUrl);
  }
}