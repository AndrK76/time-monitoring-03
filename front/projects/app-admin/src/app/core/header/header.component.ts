// projects/app-admin/src/app/core/header/header.component.ts
import { Component, inject, OnInit, signal, computed, OnDestroy, WritableSignal, AfterViewInit } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { AuthService, PermissionService } from '@mon3/sa';
import { NgIf } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatDialog } from '@angular/material/dialog';
import { UserProfileDialogComponent } from '../../dialogs/user-profile-dialog/user-profile-dialog.component';
import { MenuItem, TopMenuItemComponent } from '@mon3/sc';
import { authConstant } from '../../auth-constants';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink, NgIf,
    MatToolbarModule, MatIconModule, MatButtonModule, MatTooltipModule, MatMenuModule,
    TopMenuItemComponent
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy, AfterViewInit {
  private authService = inject(AuthService);
  private permissionService = inject(PermissionService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  // Сигналы для реактивного отслеживания
  user = this.authService.currentUser;
  isAuthenticated = signal(false);
  private authUnsubscribe?: () => void;

  // Сигналы для адаптивности
  isSmallScreen = signal(false);
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

  // Структура меню (можно вынести в сервис позже)
  menuItems: MenuItem[] = [
    { label: 'Главная', route: '/', exact: true, hideOnSmall: true },
    {
      label: 'Доступ', route: '/access',
      children: [
        { label: 'Пользователи', route: '/access/users' },
        { label: 'Организации', route: '/access/organizations' },
        { label: 'Управление ролями', route: '/access/roles' },
      ]
    },
    { label: 'Тест', route: '/test' },
  ]
  usedMenuItems: WritableSignal<MenuItem[]> = signal([]);


  filterMenuItems(items: MenuItem[]): MenuItem[] {
    if (!this.isAuthenticated()) return [];
    const result: MenuItem[] = [];
    const menuItemAllowed = (item: MenuItem): boolean => {
      const _route = item.route?.length === 1 ? ''
        : (item.route?.startsWith('/') ? item.route.substring(1) : item.route);
      const ret = _route ? this.permissionService.checkPermissions(authConstant(_route!)) : true;
      //console.log(`route=${item.route} res=${ret}`);
      return ret;
    };
    for (const item of items) {
      if (menuItemAllowed(item)) {
        const newItem: MenuItem = { ...item };
        if (item.children && item.children.length > 0) {
          const filteredChildren = this.filterMenuItems(item.children);
          if (filteredChildren.length > 0) {
            newItem.children = filteredChildren;
          } else {
            delete newItem.children;
          }
        }
        result.push(newItem);
      }
    }
    return result;
  }

  ngOnInit(): void {
    // Подписываемся на изменения состояния аутентификации
    this.authUnsubscribe = this.authService.onAuthChange((authenticated) => {
      this.isAuthenticated.set(authenticated);
      this.usedMenuItems.set(this.filterMenuItems(this.menuItems));
    });

    // Инициализируем состояние при загрузке
    this.isAuthenticated.set(this.authService.isAuthenticated);

    // Отслеживаем размер экрана
    this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small])
      .subscribe(result => {
        this.isSmallScreen.set(result.matches);
      });
    this.breakpointObserver.observe([
      Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium, Breakpoints.Large, Breakpoints.XLarge
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

  ngAfterViewInit(): void {
    this.usedMenuItems.set(this.filterMenuItems(this.menuItems));
  }


  ngOnDestroy(): void {
    this.authUnsubscribe?.();
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

  //Диалог для отображения
  private dialog = inject(MatDialog);

  openUserProfile(): void {
    this.dialog.open(UserProfileDialogComponent, {
      width: '420px',
      autoFocus: false,
      panelClass: 'user-profile-dialog'
    });
  }
}