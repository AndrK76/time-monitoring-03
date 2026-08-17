import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, take } from 'rxjs/operators';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Если уже авторизован — пропускаем
  if (authService.isAuthenticated) {
    return true;
  }

  // 2. Пытаемся восстановить сессию через checkAuth()
  return authService.checkAuth().pipe(
    map((response) => {
      if (response) {
        // ✅ Токен сохранён через setSession(response)
        return true;
      }
      router.navigate(['/login']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};