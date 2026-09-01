import { Routes } from '@angular/router';
import { authGuard } from '@mon3/sa';
import { authConstant } from './auth-constants';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/index/index.component').then(m => m.IndexComponent) },
  { path: 'login', loadComponent: () => import('@mon3/sc').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('@mon3/sc').then(m => m.RegisterComponent) },
  { path: 'logout', loadComponent: () => import('@mon3/sc').then(m => m.LogoutComponent), canActivate: [authGuard] },
  {
    path: 'profile', loadComponent: () => import('./features/users/user-profile-edit-container/user-profile-edit-container.component')
      .then(m => m.UserProfileEditContainerComponent), canActivate: [authGuard],
  },
  {
    path: 'access/users',
    loadComponent: () => import('./features/users/user-list-table/user-list-table.component').then(m => m.UserListTableComponent),
    canActivate: [authGuard],
    data: authConstant('access/users')
  },
  {
    path: 'access/organizations',
    loadComponent: () => import('./features/organizations/organization-list-table/organization-list-table.component').then(m => m.OrganizationListTableComponent),
    canActivate: [authGuard],
    data: authConstant('access/organizations')
  },
  {
    path: 'access/roles',
    loadComponent: () => import('./features/roles/role-list-table/role-list-table.component').then(m => m.RoleListTableComponent),
    canActivate: [authGuard],
    data: authConstant('access/roles')
  },
  {
    path: 'test',
    loadComponent: () => import('./features/test/test.component').then(m => m.TestComponent),
    canActivate: [authGuard],
    data: authConstant('data')
  },


  { path: '**', redirectTo: '/' }

];
