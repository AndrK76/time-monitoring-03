import { Data } from "@angular/router";

export const AUTH_CONSTANTS: Record<string, any> = {
    'access': ['superuser', 'any_action_allow'],
    'access/users': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'access/organizations': ['superuser'],
    'access/roles': ['superuser'],
    'fullUserUpdate': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'partUserUpdate': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'anyOrgAllow': { mode: 'or', groups: ['superuser', 'any_org_allow'] },
    'isSuperUser': { mode: 'or', groups: ['superuser'] },

}

export function authConstant(key: string): Data | undefined {
    return AUTH_CONSTANTS[key];
}
