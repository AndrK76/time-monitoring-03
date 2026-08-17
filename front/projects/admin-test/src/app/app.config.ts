import { APP_INITIALIZER, ApplicationConfig, inject, LOCALE_ID } from '@angular/core';

import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AdminService, authInterceptorFn, AuthService } from '@mon3/shared-test';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { environment } from '../environments/environment';

// Функция инициализации
function initializeApp() {
  const authService = inject(AuthService);
  const adminService = inject(AdminService);

  return () => {
    authService.setApiUrl(environment.authApiUrl);
    adminService.setAdminApiUrl(environment.adminApiUrl);
    adminService.setAuthApiUrl(environment.authApiUrl);
  };
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptorFn]) // Подключаем функциональный интерцептор
    ),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true
    },
    { provide: LOCALE_ID, useValue: 'ru' }
  ],
};
