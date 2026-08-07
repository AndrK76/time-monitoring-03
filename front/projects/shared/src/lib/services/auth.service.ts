import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, tap } from 'rxjs';

import { ChangePasswordRequest, LoginRequest, RegistrationRequest, TokenResponse, UserResponse } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http: HttpClient = inject(HttpClient);
  private authApiUrl = '';

  // ============================================================
  // Состояние
  // ============================================================
  private currentUserSignal = signal<UserResponse | null>(null);
  private tokenSignal = signal<string | null>(null);

  // ============================================================
  // События для синхронизации между компонентами
  // ============================================================

  private authChangeListeners: ((authenticated: boolean) => void)[] = [];

  constructor() {
    this.loadSession();
  }


  // ============================================================
  // Настройка
  // ============================================================
  setApiUrl(url: string): void {
    this.authApiUrl = url;
  }

  // ============================================================
  // Публичные геттеры
  // ============================================================
  get currentUser() {
    return this.currentUserSignal.asReadonly();
  }

  get token() {
    return this.tokenSignal.asReadonly();
  }

  get isAuthenticated(): boolean {
    return !!this.tokenSignal() && !!this.currentUserSignal();
  }

  // ============================================================
  // Подписка на изменения
  // ============================================================

  onAuthChange(callback: (authenticated: boolean) => void): void {
    this.authChangeListeners.push(callback);
  }

  private notifyListeners(authenticated: boolean): void {
    this.authChangeListeners.forEach(cb => cb(authenticated));
  }


  // ============================================================
  // Аутентификация
  // ============================================================

  login(credentials: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.authApiUrl}/auth/login`, credentials, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.setSession(response);
        localStorage.setItem('auth_timestamp', Date.now().toString());
        this.notifyListeners(true);
      })
    );
  }

  register(data: RegistrationRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.authApiUrl}/auth/register`, data, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.setSession(response);
        localStorage.setItem('auth_timestamp', Date.now().toString());
        this.notifyListeners(true);
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
        this.notifyListeners(false);
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

  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.authApiUrl}/auth/change-password`, data, {
      withCredentials: true
    });
  }

  // ============================================================
  // Восстановление сессии через cookie (SSO)
  // ============================================================

  /**
   * Проверяет аутентификацию через cookie (auth_token)
   * Используется при переходе между приложениями (SSO)
   * Возвращает TokenResponse, чтобы сохранить токен в localStorage
   */
  checkAuth(): Observable<TokenResponse | null> {
    return this.http.get<TokenResponse>(`${this.authApiUrl}/auth/check`, {
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response && response.accessToken) {
          // ✅ Сохраняем токен и пользователя в localStorage
          this.setSession(response);
          localStorage.setItem('auth_timestamp', Date.now().toString());
          this.notifyListeners(true);
          console.log('✅ Session restored from cookie, token saved to localStorage');
        }
      }),
      catchError(() => {
        this.clearSession();
        this.notifyListeners(false);
        return of(null);
      })
    );
  }

  /**
   * Получение текущего пользователя (без восстановления сессии)
   * Используется, когда токен уже есть в localStorage
   */
  getCurrentUser(): Observable<UserResponse | null> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return of(null);
    }

    return this.http.get<UserResponse>(`${this.authApiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true
    }).pipe(
      tap(user => {
        this.currentUserSignal.set(user);
        this.tokenSignal.set(token);
        localStorage.setItem('user', JSON.stringify(user));
        this.notifyListeners(true);
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  // ============================================================
  // Вспомогательные методы
  // ============================================================

  getAuthHeader(): string {
    return `Bearer ${this.tokenSignal()}`;
  }


  // ============================================================
  // Приватные методы
  // ============================================================

  private setSession(response: TokenResponse): void {
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('refreshToken', response.refreshToken || '');
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
        console.log('📂 Session loaded from localStorage');
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
