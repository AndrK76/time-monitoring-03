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
    path: 'struct/org',
    loadComponent: () => import('./features/struct-org/struct-org-list/struct-org-list.component').then(m => m.StructOrgListComponent),
    canActivate: [authGuard],
    data: authConstant('struct/org')
  },
  {
    path: 'crm/agent-list',
    loadComponent: () => import('./features/crm-agent/crm-agent-list/crm-agent-list.component').then(m => m.CrmAgentListComponent),
    canActivate: [authGuard],
    data: authConstant('crm/agent-list')
  },
  {
    path: 'crm/agent',
    loadComponent: () => import('./features/crm-agent/crm-agent-editor-container/crm-agent-editor-container.component').then(m => m.CrmAgentEditorContainerComponent),
    canActivate: [authGuard],
    data: authConstant('crm/agent')
  },
  {
    path: 'event/agent-list',
    loadComponent: () => import('./features/event-agent/event-agent-list/event-agent-list.component').then(m => m.EventAgentListComponent),
    canActivate: [authGuard],
    data: authConstant('event/agent-lis')
  }, {
    path: 'camera/agent-list',
    loadComponent: () => import('./features/camera-agent/camera-agent-list/camera-agent-list.component').then(m => m.CameraAgentListComponent),
    canActivate: [authGuard],
    data: authConstant('camera/agent-list')
  },
  {
    path: 'test',
    loadComponent: () => import('./features/test/test.component').then(m => m.TestComponent),
    canActivate: [authGuard],
    data: authConstant('data')
  },


  { path: '**', redirectTo: '/' }

];
