import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';


let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);


export const authInterceptorFn
  : HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {

    const authService = inject(AuthService);
    const router = inject(Router);

    // Пропускаем запросы на аутентификацию
    if (req.url.includes('/auth/login') ||
      req.url.includes('/auth/register') ||
      req.url.includes('/auth/check') ||
      req.url.includes('/auth/refresh')) {
      return next(req);
    }

    const token = authService.token();

    let authReq = req;
    if (token) {
      //console.log('isToken')
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        },
        //withCredentials: true
      });
    }


    return next(authReq).pipe(
      catchError((error) => {
        //console.log(JSON.stringify(error));
        if (error.status === 401) {
          return handle401Error(req, next, authService, router);
        }
        return throwError(() => error);
      })
    );
  };

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);
        const clonedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${response.accessToken}`
          },
          withCredentials: true
        });
        return next(clonedReq);
      }),
      catchError((err) => {
        console.log('AuthInterceptor.handle401Error: '+ JSON.stringify(err));
        isRefreshing = false;
        authService.logout().subscribe();
        router.navigate(['/']);
        return throwError(() => err);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => {
        const clonedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          },
          withCredentials: true
        });
        return next(clonedReq);
      })
    );
  }
}
