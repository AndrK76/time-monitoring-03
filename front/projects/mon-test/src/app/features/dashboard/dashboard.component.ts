import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService, AuthService, TestResponse } from '@mon3/shared';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private router = inject(Router);

  user = this.authService.currentUser();
  response: TestResponse | null = null;

  // Добавляем ссылку на другое приложение
  otherAppUrl = environment.otherAppUrl;
  otherAppName = environment.otherAppName;

  ngOnInit(): void {
    // Восстанавливаем сессию из cookie
    this.authService.checkAuth().subscribe({
      next: (response) => {
        if (response) {
          // response содержит user + accessToken
          this.user = response.user;
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  getPermissionsDisplay(permissions: string[] | undefined): string {
    if (!permissions || permissions.length === 0) {
      return '❌ Нет прав';
    }
    return permissions.join(', ');
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  callPublic(): void {
    this.adminService.getPublic().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callAuthenticated(): void {
    this.adminService.getAuthenticated().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callApproveDeviation(): void {
    this.adminService.approveDeviation().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callSystemAdmin(): void {
    this.adminService.systemAdminOnly().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callOrgAdmin(): void {
    this.adminService.orgAdminOnly().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callDispatcher(): void {
    this.adminService.dispatcherOnly().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callDispatcherApprove(): void {
    this.adminService.dispatcherWithApprove().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }
  callMyPermissions(): void {
    this.adminService.getMyPermissions().subscribe({
      next: (res) => this.response = res,
      error: (err) => this.handleError(err)
    });
  }

  private handleError(err: any): void {
    this.response = {
      message: err.error?.message || err.message || 'Ошибка запроса',
      username: '',
      userId: '',
      roles: '',
      permissions: '',
      timestamp: new Date().toISOString(),
      success: false
    };
  }

}
