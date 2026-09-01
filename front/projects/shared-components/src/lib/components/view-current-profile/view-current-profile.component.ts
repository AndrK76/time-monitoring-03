import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { handleError, RoleResponseDto, UserManageService, UserResponseDto } from '@mon3/sa';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'sc-view-current-profile',
  standalone: true,
  imports: [CommonModule, MatDividerModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule],
  templateUrl: './view-current-profile.component.html',
  styleUrl: './view-current-profile.component.scss'
})
export class ViewCurrentProfileComponent implements OnInit {
  private dataService = inject(UserManageService);

  roles = signal<RoleResponseDto[]>([]);
  user = signal<UserResponseDto | null>(null);

  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.initializeData();
  }

  initializeData = (): void => {
    this.isLoading.set(false);
    this.error.set(null);

    forkJoin({
      roles: this.dataService.getCurrentUserRoles()
        .pipe(handleError<RoleResponseDto[]>('Ошибка загрузки списка ролей пользователя', [], this.error)),
      user: this.dataService.getCurrentUser()
        .pipe(handleError<UserResponseDto | null>('Ошибка загрузки профиля пользователя', null, this.error)),
    }).subscribe({
      next: (result) => {
        if (this.error()) {
          this.error.set('Не удалось загрузить данные профиля');
        } else {
          const { roles, user } = result as { roles: RoleResponseDto[]; user: UserResponseDto | null };
          this.roles.set(roles);
          this.user.set(user);
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.error.set('Не удалось загрузить данные профиля');
      }
    })
  }

  /**
 * Возвращает инициалы пользователя (две буквы)
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

  getRoleDescription(roleName: string) {
    return (this.roles().find(f => f.name === roleName)?.description) ?? roleName;
  }

}