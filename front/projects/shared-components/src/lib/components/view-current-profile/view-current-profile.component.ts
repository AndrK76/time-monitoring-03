import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UsermanageService, UserResponseDto } from '@mon3/sa';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'sc-view-current-profile',
  standalone: true,
  imports: [CommonModule, MatDividerModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule],
  templateUrl: './view-current-profile.component.html',
  styleUrl: './view-current-profile.component.scss'
})
export class ViewCurrentProfileComponent implements OnInit {
  private adminService = inject(UsermanageService);

  user = signal<UserResponseDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.adminService.getCurrentUser()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.user.set(data),
        error: (err) => {
          console.error('Failed to load profile:', err);
          this.error.set('Не удалось загрузить данные профиля');
        }
      });
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

}