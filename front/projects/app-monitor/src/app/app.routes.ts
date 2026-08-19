import { Routes } from '@angular/router';
import { authGuard } from '@mon3/sa';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/index/index.component').then(m => m.IndexComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('@mon3/sc').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('@mon3/sc').then(m => m.RegisterComponent)
  },
  {
    path: 'logout',
    loadComponent: () => import('@mon3/sc').then(m => m.LogoutComponent)
  },

  {
    path: 'test-table',
    loadComponent: () => import('./features/test-table/test-table.component').then(m => m.TestTableComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/' }

];
