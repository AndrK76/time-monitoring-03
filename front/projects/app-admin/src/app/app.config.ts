import { APP_INITIALIZER, ApplicationConfig, inject, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { UserManageService, AuthService, authInterceptorFn } from '@mon3/sa';
import { environment } from '../environments/environment';
import { lastValueFrom } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeRu from '@angular/common/locales/ru';

registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    //provideHttpClient(),
    provideHttpClient(withInterceptors([authInterceptorFn])),
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
  const userManageService = inject(UserManageService);

  return () => {
    authService.setApiUrl(environment.authApiUrl);
    userManageService.setAdminApiUrl(environment.adminApiUrl);
    userManageService.setAuthApiUrl(environment.authApiUrl);

    return lastValueFrom(authService.checkAuth())
      .then((response) => {
        return true; // успешно
      })
      .catch((error) => {
        return true; // всё равно продолжаем загрузку
      });
  };
}