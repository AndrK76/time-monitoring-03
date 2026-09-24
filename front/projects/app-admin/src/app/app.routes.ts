import { Routes } from '@angular/router';
import { authGuard } from '@mon3/sa';
import { authConstant } from './auth-constants';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/index/index.component').then(m => m.IndexComponent) },
  { path: 'login', loadComponent: () => import('@mon3/sc').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('@mon3/sc').then(m => m.RegisterComponent) },
  { path: 'logout', loadComponent: () => import('@mon3/sc').then(m => m.LogoutComponent), canActivate: [authGuard] },
  {
    path: 'profile', loadComponent: () => import('./features/access/users/user-profile-edit-container/user-profile-edit-container.component')
      .then(m => m.UserProfileEditContainerComponent), canActivate: [authGuard],
  },
  {
    path: 'access/users',
    loadComponent: () => import('./features/access/users/user-list-table/user-list-table.component').then(m => m.UserListTableComponent),
    canActivate: [authGuard],
    data: authConstant('access/users')
  },
  {
    path: 'access/organizations',
    loadComponent: () => import('./features/access/organizations/organization-list-table/organization-list-table.component').then(m => m.OrganizationListTableComponent),
    canActivate: [authGuard],
    data: authConstant('access/organizations')
  },
  {
    path: 'access/roles',
    loadComponent: () => import('./features/access/roles/role-list-table/role-list-table.component').then(m => m.RoleListTableComponent),
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
    loadComponent: () => import('./features/crm/crm-agent/crm-agent-list/crm-agent-list.component').then(m => m.CrmAgentListComponent),
    canActivate: [authGuard],
    data: authConstant('crm/agent-list')
  },
  {
    path: 'crm/agent',
    loadComponent: () => import('./features/crm/crm-agent/crm-agent-config/crm-agent-config.component').then(m => m.CrmAgentConfigComponent),
    canActivate: [authGuard],
    data: authConstant('crm/agent')
  },
  {
    path: 'crm/service-list',
    loadComponent: () => import('./features/crm/crm-service/crm-service-list/crm-service-list.component').then(m => m.CrmServiceListComponent),
    canActivate: [authGuard],
    data: authConstant('crm/service-list')
  },
  {
    path: 'crm/place-list',
    loadComponent: () => import('./features/crm/crm-place/crm-place-list/crm-place-list.component').then(m => m.CrmPlaceListComponent),
    canActivate: [authGuard],
    data: authConstant('crm/place-list')
  },
  {
    path: 'evt/agent-list',
    loadComponent: () => import('./features/evt/evt-agent-list/evt-agent-list.component').then(m => m.EvtAgentListComponent),
    canActivate: [authGuard],
    data: authConstant('evt/agent-list')
  },
  {
    path: 'evt/agent',
    loadComponent: () => import('./features/evt/evt-agent-config/evt-agent-config.component').then(m => m.EvtAgentConfigComponent),
    canActivate: [authGuard],
    data: authConstant('crm/agent')
  },
  {
    path: 'camera/agent-list',
    loadComponent: () => import('./features/camera-agent/camera-agent-list/camera-agent-list.component').then(m => m.CameraAgentListComponent),
    canActivate: [authGuard],
    data: authConstant('camera/agent-list')
  },
  {
    path: 'yclients/config',
    loadComponent: () => import('./features/yclients/yc-config-editor/yc-config-editor.component').then(m => m.YcConfigEditorComponent),
    canActivate: [authGuard],
    data: authConstant('yclients/config')
  },
  {
    path: 'macroscop/evt/config',
    loadComponent: () => import('./features/macroscop/macroscop-evt-editor-container/macroscop-evt-editor-container.component').then(m => m.MacroscopEvtEditorContainerComponent),
    canActivate: [authGuard],
    data: authConstant('macroscop/evt/config')
  },
  {
    path: 'macroscop/config-list',
    loadComponent: () => import('./features/macroscop/macroscop-config-list/macroscop-config-list.component').then(m => m.MacroscopConfigListComponent),
    canActivate: [authGuard],
    data: authConstant('macroscop/config-list')
  },


  { path: '**', redirectTo: '/' }

];
