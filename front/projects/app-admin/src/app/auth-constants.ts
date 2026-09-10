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
    'struct': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'struct/org': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'structChangeOrg': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'crm/agent-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'structModifyAgents': ['superuser'],
    'crm/agent': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'yclients/config': { mode: 'or', groups: ['superuser', 'any_action_allow'] },

}

export function authConstant(key: string): Data | undefined {
    return AUTH_CONSTANTS[key];
}
