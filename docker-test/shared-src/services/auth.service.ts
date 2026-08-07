// front/shared/services/auth.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoginRequest, TokenResponse, UserResponse } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private authApiUrl = '';

  private currentUserSignal = signal<UserResponse | null>(null);
  private tokenSignal = signal<string | null>(null);

  // Состояние готовности
  private authReadySubject = new BehaviorSubject<boolean>(false);
  authReady$ = this.authReadySubject.asObservable();

  constructor() {
    this.loadSession();
    // При загрузке пытаемся восстановить сессию
    const token = localStorage.getItem('accessToken');
    if (token) {
      this.checkAuth().subscribe({
        next: (user) => {
          if (user) {
            console.log('✅ Session restored on init:', user.username);
          }
          this.authReadySubject.next(true);
        },
        error: () => {
          this.authReadySubject.next(true);
        }
      });
    } else {
      this.authReadySubject.next(true);
    }
  }

  setApiUrl(url: string): void {
    this.authApiUrl = url;
  }

  get currentUser() {
    return this.currentUserSignal.asReadonly();
  }

  get token() {
    return this.tokenSignal.asReadonly();
  }

  get isAuthenticated(): boolean {
    return !!this.tokenSignal() && !!this.currentUserSignal();
  }

  login(credentials: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.authApiUrl}/auth/login`, credentials, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.setSession(response);
        localStorage.setItem('auth_timestamp', Date.now().toString());
        this.authReadySubject.next(true);
      })
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.authApiUrl}/auth/logout`, {}, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.clearSession();
        localStorage.removeItem('auth_timestamp');
        this.authReadySubject.next(true);
      })
    );
  }

  refreshToken(): Observable<TokenResponse> {
    const refreshToken = localStorage.getItem('refreshToken') || '';
    return this.http.post<TokenResponse>(
      `${this.authApiUrl}/auth/refresh`,
      {},
      { params: { refreshToken }, withCredentials: true }
    ).pipe(
      tap(response => {
        this.setSession(response);
      })
    );
  }

  checkAuth(): Observable<UserResponse | null> {
    // Если уже есть пользователь — возвращаем его
    if (this.currentUserSignal()) {
      return of(this.currentUserSignal());
    }

    // Если есть токен в localStorage — проверяем через /me
    const token = localStorage.getItem('accessToken');
    if (token) {
      return this.http.get<UserResponse>(`${this.authApiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      }).pipe(
        tap(user => {
          this.setUser(user);
          console.log('✅ User restored from token:', user.username);
        }),
        catchError(() => {
          this.clearSession();
          return of(null);
        })
      );
    }

    // Если нет токена — пробуем восстановить из cookie через /check
    return this.http.get<UserResponse>(`${this.authApiUrl}/auth/check`, {
      withCredentials: true
    }).pipe(
      tap(user => {
        this.setUser(user);
        console.log('✅ User restored from cookie:', user.username);
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  getAuthHeader(): string {
    return `Bearer ${this.tokenSignal()}`;
  }

  // ============================================================
  // Приватные методы
  // ============================================================

  private setUser(user: UserResponse): void {
    this.currentUserSignal.set(user);
    this.tokenSignal.set('from-cookie');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('auth_timestamp', Date.now().toString());
  }

  private setSession(response: TokenResponse): void {
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('auth_timestamp', Date.now().toString());

    this.tokenSignal.set(response.accessToken);
    this.currentUserSignal.set(response.user);
  }

  private loadSession(): void {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.tokenSignal.set(token);
        this.currentUserSignal.set(user);
        console.log('📂 Session loaded from localStorage:', user.username);
      } catch (e) {
        this.clearSession();
      }
    }
  }

  private clearSession(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('auth_timestamp');
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
  }
}