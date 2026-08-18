// projects/app-admin/src/app/core/header/header.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@mon3/sa';
import { NgIf } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterLink,
    NgIf
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  // Сигналы для реактивного отслеживания
  user = this.authService.currentUser;
  isAuthenticated = signal(false);

  // Сигналы для адаптивности
  showName = signal<boolean>(true);
  limit = signal<number>(20);

  // Сигнал для отображаемого имени (обрезанного)
  displayName = computed(() => {
    const fullName = this.getFullName();
    const maxLength = this.limit();
    if (fullName.length > maxLength) {
      return fullName.substring(0, maxLength - 3) + '...';
    }
    return fullName;
  });

  ngOnInit(): void {
    // Подписываемся на изменения состояния аутентификации
    this.authService.onAuthChange((authenticated) => {
      this.isAuthenticated.set(authenticated);
    });

    // Инициализируем состояние при загрузке
    this.isAuthenticated.set(this.authService.isAuthenticated);

    // Отслеживаем размер экрана
    this.breakpointObserver.observe([
      Breakpoints.XSmall,
      Breakpoints.Small,
      Breakpoints.Medium,
      Breakpoints.Large,
      Breakpoints.XLarge
    ]).subscribe(() => {
      if (this.breakpointObserver.isMatched(Breakpoints.XSmall)) {
        this.showName.set(false);
        return;
      }
      this.showName.set(true);
      if (this.breakpointObserver.isMatched(Breakpoints.Small) ||
        this.breakpointObserver.isMatched(Breakpoints.Medium)) {
        this.limit.set(20);
      } else {
        this.limit.set(30);
      }
    });
  }

  /**
   * Возвращает инициалы пользователя (1-2 буквы из displayName или username)
   */
  getUserInitials(): string {
    const user = this.user();
    if (!user) return '?';

    const name = user.displayName || user.username || '';
    if (!name) return '?';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Возвращает полное имя для всплывающей подсказки
   */
  getFullName(): string {
    const user = this.user();
    if (!user) return 'Пользователь';
    return user.displayName || user.username || 'Пользователь';
  }

  /**
   * Выход из системы
   */
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        // Даже при ошибке пробуем перенаправить на логин
        this.router.navigate(['/']);
      }
    });
  }
}