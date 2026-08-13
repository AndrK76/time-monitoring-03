// projects/admin-test/src/app/features/user-management/user-management.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AdminService,
  UserResponse,
  UserListItem,
  UpdateUserRequest,
  AuthService,
  RoleDto,
  PermissionDto
} from '@mon3/shared';

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

  // ============================================================
  // Данные
  // ============================================================

  users: UserListItem[] = [];
  selectedUser: UserListItem | null = null;
  fullUser: UserResponse | null = null;
  editingUser: UserResponse | null = null;

  // Справочники
  rolesMap: Map<string, string> = new Map();
  permissionsMap: Map<string, string> = new Map();
  allRoles: RoleDto[] = [];

  // Состояние
  isLoading = false;
  isUserLoading = false;
  errorMessage = '';
  successMessage = '';
  isAdmin = false;
  currentUserId = '';

  // ============================================================
  // Модальное окно смены пароля
  // ============================================================

  showPasswordModal = false;
  passwordModalUserId = '';
  passwordModalUsername = '';
  newPassword = '';
  confirmPassword = '';
  passwordError = '';
  passwordSuccess = '';
  isPasswordLoading = false;

  // ============================================================
  // Жизненный цикл
  // ============================================================

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUser()?.id || '';
    this.checkPermissions();
    this.loadData();
  }

  // ============================================================
  // Методы
  // ============================================================

  goBack(): void {
    this.router.navigate(['/admin']);
  }

  checkPermissions(): void {
    const permissions = this.authService.currentUser()?.permissions || [];
    this.isAdmin = permissions.includes('USER_READ') || permissions.includes('USER_WRITE');
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const hasReadPermission = this.authService.currentUser()?.permissions?.includes('USER_READ') || false;

    if (hasReadPermission) {
      this.loadDictionaries();
      this.adminService.getUsersList().subscribe({
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
      this.adminService.getCurrentUser().subscribe({
        next: (user) => {
          this.fullUser = user;
          this.editingUser = { ...user };

          const userListItem: UserListItem = {
            id: user.id,
            username: user.username,
            displayName: user.displayName || user.username
          };
          this.users = [userListItem];
          this.selectedUser = userListItem;

          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Ошибка загрузки пользователя';
          this.isLoading = false;
        }
      });
    }
  }

  loadDictionaries(): void {
    if (!this.isAdmin) return;

    this.adminService.getAllRoles().subscribe({
      next: (roles: RoleDto[]) => {
        this.allRoles = roles;
        roles.forEach(r => this.rolesMap.set(r.name, r.description));
      },
      error: (err) => {
        console.error('Failed to load roles:', err);
      }
    });

    this.adminService.getAllPermissions().subscribe({
      next: (permissions: PermissionDto[]) => {
        permissions.forEach(p => this.permissionsMap.set(p.name, p.description));
      },
      error: (err) => {
        console.error('Failed to load permissions:', err);
      }
    });
  }

  selectUser(user: UserListItem): void {
    if (this.selectedUser?.id === user.id && this.fullUser) {
      return;
    }

    this.selectedUser = user;
    this.isUserLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const isSelf = this.isCurrentUser(user.id);
    const hasReadPermission = this.authService.currentUser()?.permissions?.includes('USER_READ') || false;

    if (!isSelf && !hasReadPermission) {
      this.errorMessage = 'У вас нет прав для просмотра этого пользователя';
      this.isUserLoading = false;
      this.selectedUser = null;
      return;
    }

    if (isSelf) {
      this.adminService.getCurrentUser().subscribe({
        next: (full) => {
          this.fullUser = full;
          this.editingUser = { ...full };
          this.isUserLoading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Ошибка загрузки данных пользователя';
          this.isUserLoading = false;
        }
      });
      return;
    }

    this.adminService.getUserById(user.id).subscribe({
      next: (full) => {
        this.fullUser = full;
        this.editingUser = { ...full };
        this.isUserLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Ошибка загрузки данных пользователя';
        this.isUserLoading = false;
      }
    });
  }

  cancelEdit(): void {
    this.editingUser = null;
    this.selectedUser = null;
    this.fullUser = null;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.isAdmin && this.users.length === 1) {
      this.adminService.getCurrentUser().subscribe({
        next: (user) => {
          this.fullUser = user;
          this.editingUser = { ...user };
          this.selectedUser = {
            id: user.id,
            username: user.username,
            displayName: user.displayName || user.username
          };
        },
        error: (err) => {
          console.error('Failed to reload user after cancel:', err);
        }
      });
    }
  }

  saveUser(): void {
    if (!this.editingUser) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const isSelf = this.isCurrentUser(this.editingUser.id);

    if (!isSelf && !this.isAdmin) {
      this.errorMessage = 'У вас нет прав для редактирования других пользователей';
      this.isLoading = false;
      return;
    }

    const updateData: UpdateUserRequest = {
      username: this.editingUser.username,
      email: this.editingUser.email,
      firstName: this.editingUser.firstName,
      lastName: this.editingUser.lastName || '',
      displayName: this.editingUser.displayName
    };

    if (this.isAdmin) {
      updateData.active = this.editingUser.active;
      updateData.emailVerified = this.editingUser.emailVerified;
      updateData.roles = this.editingUser.roles;
    }

    let request;
    if (isSelf) {
      request = this.adminService.updateCurrentUser(updateData);
    } else {
      request = this.adminService.updateUser(this.editingUser.id, updateData);
    }

    request.subscribe({
      next: (updated) => {
        this.successMessage = '✅ Пользователь успешно обновлён';
        this.isLoading = false;
        this.fullUser = updated;
        this.editingUser = { ...updated };
        this.loadData();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Ошибка обновления пользователя';
        this.isLoading = false;
      }
    });
  }

  // ============================================================
  // Управление паролями (только для админов)
  // ============================================================

  openPasswordModal(user: UserListItem): void {
    if (!this.isAdmin) return;
    this.passwordModalUserId = user.id;
    this.passwordModalUsername = user.displayName || user.username;
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordError = '';
    this.passwordSuccess = '';
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.passwordModalUserId = '';
    this.passwordModalUsername = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordError = '';
    this.passwordSuccess = '';
    this.isPasswordLoading = false;
  }

  resetPassword(): void {
    if (!this.passwordModalUserId) return;

    this.isPasswordLoading = true;
    this.passwordError = '';
    this.passwordSuccess = '';

    this.adminService.resetPassword(this.passwordModalUserId).subscribe({
      next: () => {
        this.passwordSuccess = '✅ Пароль успешно сброшен до значения по умолчанию';
        this.isPasswordLoading = false;
        setTimeout(() => this.closePasswordModal(), 2000);
      },
      error: (err) => {
        this.passwordError = err.error?.message || 'Ошибка сброса пароля';
        this.isPasswordLoading = false;
      }
    });
  }

  setNewPassword(): void {
    if (!this.passwordModalUserId) return;

    if (this.newPassword.length < 6) {
      this.passwordError = 'Пароль должен быть не менее 6 символов';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Пароли не совпадают';
      return;
    }

    this.isPasswordLoading = true;
    this.passwordError = '';
    this.passwordSuccess = '';

    this.adminService.setPassword(this.passwordModalUserId, this.newPassword).subscribe({
      next: () => {
        this.passwordSuccess = '✅ Пароль успешно установлен';
        this.isPasswordLoading = false;
        setTimeout(() => this.closePasswordModal(), 2000);
      },
      error: (err) => {
        this.passwordError = err.error?.message || 'Ошибка установки пароля';
        this.isPasswordLoading = false;
      }
    });
  }

  // ============================================================
  // Вспомогательные методы
  // ============================================================

  isCurrentUser(userId: string): boolean {
    return userId === this.currentUserId;
  }

  canEdit(userId: string): boolean {
    return this.isAdmin || this.isCurrentUser(userId);
  }

  canEditField(fieldName: string): boolean {
    if (this.isAdmin) return true;
    if (!this.fullUser) return false;
    if (!this.isCurrentUser(this.fullUser.id)) return false;

    const allowedFields = ['firstName', 'lastName', 'displayName'];
    return allowedFields.includes(fieldName);
  }

  isRoleSelected(roleName: string): boolean {
    return this.editingUser?.roles?.includes(roleName) || false;
  }

  toggleRole(roleName: string): void {
    if (!this.editingUser) return;
    if (!this.editingUser.roles) {
      this.editingUser.roles = [];
    }

    const index = this.editingUser.roles.indexOf(roleName);
    if (index > -1) {
      this.editingUser.roles.splice(index, 1);
    } else {
      this.editingUser.roles.push(roleName);
    }
  }

  getRoleDescription(roleName: string): string {
    return this.rolesMap.get(roleName) || roleName;
  }

  getPermissionDescription(permissionName: string): string {
    return this.permissionsMap.get(permissionName) || permissionName;
  }
}