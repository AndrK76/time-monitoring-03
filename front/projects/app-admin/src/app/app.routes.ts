import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./features/placeholder/placeholder.component').then(m => m.PlaceholderComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('@mon3/sc').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('@mon3/sc').then(m => m.RegisterComponent)
  }
];