import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
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

  // Событие для синхронизации между вкладками
  private authChangeListeners: ((authenticated: boolean) => void)[] = [];

  constructor() {
    this.loadSession();

    // Слушаем изменения localStorage из других вкладок
    window.addEventListener('storage', (event) => {
      if (event.key === 'auth_timestamp') {
        if (event.newValue) {
          this.checkAuth().subscribe();
        } else {
          this.clearSession();
          this.notifyListeners(false);
        }
      }
    });

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

  // Подписка на изменения авторизации
  onAuthChange(callback: (authenticated: boolean) => void): void {
    this.authChangeListeners.push(callback);
  }

  private notifyListeners(authenticated: boolean): void {
    this.authChangeListeners.forEach(cb => cb(authenticated));
  }

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

  checkAuth(): Observable<UserResponse | null> {
    // Проверяем через API с cookie
    return this.http.get<UserResponse>(`${this.authApiUrl}/auth/check`, {
      withCredentials: true
    }).pipe(
      tap(user => {
        this.currentUserSignal.set(user);
        this.tokenSignal.set('from-cookie');
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('auth_timestamp', Date.now().toString());
        this.notifyListeners(true);
      }),
      catchError(() => {
        this.clearSession();
        this.notifyListeners(false);
        return of(null);
      })
    );
  }

  getAuthHeader(): string {
    return `Bearer ${this.tokenSignal()}`;
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
      } catch (e) {
        this.clearSession();
      }
    } else {
      // Пробуем восстановить через cookie
      if (typeof window !== 'undefined') {
        this.checkAuth().subscribe();
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