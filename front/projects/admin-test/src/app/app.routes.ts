import { Routes } from '@angular/router';
import { authGuard } from '@mon3/shared';

import { LoginComponent } from './features/login/login.component';
import { AdminComponent } from './features/admin/admin.component';
import { RegisterComponent } from './features/register/register.component';
import { ChangePasswordComponent } from './features/change-password/change-password.component';
import { UserManagementComponent } from './features/user-management/user-management.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    {
        path: 'profile/change-password',
        component: ChangePasswordComponent,
        canActivate: [authGuard]
    },
    { path: 'admin', component: AdminComponent, canActivate: [authGuard] },
    { path: 'admin/users', component: UserManagementComponent, canActivate: [authGuard] },
    { path: '', redirectTo: '/admin', pathMatch: 'full' },
    { path: '**', redirectTo: '/admin' }
];
