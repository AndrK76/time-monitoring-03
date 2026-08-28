import { Data } from "@angular/router";

export const AUTH_CONSTANTS: Record<string, any> = {
    access: ['superuser', 'user_read', 'user_write'],
    'access/users': { mode: 'or', groups: ['superuser', 'user_read', 'user_write'] },
    'access/organizations': ['superuser', 'org_write'],
    'access/roles': ['superuser']
}

export function authConstant(key: string): Data | undefined {
    return AUTH_CONSTANTS[key];
}
