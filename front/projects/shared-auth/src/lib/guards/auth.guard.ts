import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '@mon3/sa';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  function checkPermissions(data: any): boolean {

    return permissionService.checkPermissions(data);
  }

  // 1. Если уже авторизован — пропускаем
  if (authService.isAuthenticated) {
    return checkPermissions(route.data);
  }

  // 2. Пытаемся восстановить сессию через checkAuth()
  return authService.checkAuth().pipe(
    map((response) => {
      if (response) {
        return checkPermissions(route.data);
      }
      router.navigate(['/']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/']);
      return of(false);
    })
  );
};



