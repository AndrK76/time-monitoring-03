import { APP_INITIALIZER, ApplicationConfig, inject, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { AdminService, AuthService } from '@mon3/sa';
import { environment } from '../environments/environment';
import { lastValueFrom } from 'rxjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true
    },
    { provide: LOCALE_ID, useValue: 'ru' },
  ]
};

function initializeApp() {
  const authService = inject(AuthService);
  const adminService = inject(AdminService);

  return () => {
    authService.setApiUrl(environment.authApiUrl);
    adminService.setAdminApiUrl(environment.adminApiUrl);
    adminService.setAuthApiUrl(environment.authApiUrl);

    return lastValueFrom(authService.checkAuth())
      .then((response) => {
        // Сессия восстановлена (токен сохранён в сервисе)
        //console.log('Session restored:', response);
        return true; // успешно
      })
      .catch((error) => {
        // Ошибка восстановления (например, нет куки или токен невалидный)
        //console.warn('Session restoration failed, continuing as anonymous:', error);
        return true; // всё равно продолжаем загрузку
      });
  };
}