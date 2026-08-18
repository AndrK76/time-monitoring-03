import { APP_INITIALIZER, ApplicationConfig, inject, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { AdminService, AuthService } from '@mon3/sa';
import { environment } from '../environments/environment';

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
    { provide: LOCALE_ID, useValue: 'ru' }
  ]
};

function initializeApp() {
  const authService = inject(AuthService);
  const adminService = inject(AdminService);

  return () => {
    authService.setApiUrl(environment.authApiUrl);
    adminService.setAdminApiUrl(environment.adminApiUrl);
    adminService.setAuthApiUrl(environment.authApiUrl);
  };
}