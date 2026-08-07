// projects/admin-test/src/app/features/user-management/user-management.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, UserResponse, UpdateUserRequest, AuthService } from '@mon3/shared';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private router = inject(Router);

  users: UserResponse[] = [];
  selectedUser: UserResponse | null = null;
  editingUser: UserResponse | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  isAdmin = false;
  currentUserId = '';

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUser()?.id || '';
    this.checkPermissions();
    this.loadUsers();
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }

  checkPermissions(): void {
    const permissions = this.authService.currentUser()?.permissions || [];
    this.isAdmin = permissions.includes('USER_WRITE');
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Если есть право USER_READ — загружаем всех
    const hasReadPermission = this.authService.currentUser()?.permissions?.includes('USER_READ') || false;

    if (hasReadPermission) {
      // Админ — загружаем всех
      this.adminService.getAllUsers().subscribe({
        next: (users) => {
          this.users = users;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Ошибка загрузки пользователей';
          this.isLoading = false;
        }
      });
    } else {
      // Обычный пользователь — загружаем только себя
      this.adminService.getCurrentUser().subscribe({
        next: (user) => {
          this.users = [user];
          this.isLoading = false;
          // Автоматически выбираем себя
          this.selectUser(user);
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Ошибка загрузки пользователя';
          this.isLoading = false;
        }
      });
    }
  }

  selectUser(user: UserResponse): void {
    this.selectedUser = user;
    this.editingUser = { ...user };
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEdit(): void {
    this.editingUser = null;
    this.selectedUser = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  saveUser(): void {
    if (!this.editingUser) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const updateData: UpdateUserRequest = {
      username: this.editingUser.username,
      email: this.editingUser.email,
      firstName: this.editingUser.firstName,
      lastName: this.editingUser.lastName || '',
      displayName: this.editingUser.displayName
    };

    const isSelf = this.isCurrentUser(this.editingUser.id);

    let request;
    if (isSelf) {
      // Обновляем себя — доступно всем
      request = this.adminService.updateCurrentUser(updateData);
    } else {
      // Обновляем другого — требует USER_WRITE
      request = this.adminService.updateUser(this.editingUser.id, updateData);
    }

    request.subscribe({
      next: (updated) => {
        this.successMessage = '✅ Пользователь успешно обновлён';
        this.isLoading = false;
        this.loadUsers();
        this.selectedUser = updated;
        this.editingUser = { ...updated };
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Ошибка обновления пользователя';
        this.isLoading = false;
      }
    });
  }

  isCurrentUser(userId: string): boolean {
    return userId === this.currentUserId;
  }

  canEdit(userId: string): boolean {
    // Админ может редактировать всех, пользователь — только себя
    return this.isAdmin || this.isCurrentUser(userId);
  }

  // Определяем, можно ли редактировать поле
  canEditField(fieldName: string): boolean {
    // Если админ — может редактировать всё
    if (this.isAdmin) return true;

    // Если обычный пользователь — только свои данные
    if (!this.selectedUser) return false;
    if (!this.isCurrentUser(this.selectedUser.id)) return false;

    // Обычный пользователь может менять только: firstName, lastName, displayName
    const allowedFields = ['firstName', 'lastName', 'displayName'];
    return allowedFields.includes(fieldName);
  }
}