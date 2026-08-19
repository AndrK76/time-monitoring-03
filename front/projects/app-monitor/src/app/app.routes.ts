import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/index/index.component').then(m => m.IndexComponent)
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
  { path: '**', redirectTo: '/' }

];
