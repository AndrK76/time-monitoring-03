// front/shared/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';

export const authGuard = (): Observable<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Если уже авторизован — пропускаем
  if (authService.isAuthenticated) {
    return of(true);
  }

  // 2. Пытаемся восстановить сессию через checkAuth()
  return authService.checkAuth().pipe(
    take(1),
    map((user) => {
      if (user) {
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