import { Data } from "@angular/router";

export const AUTH_CONSTANTS: Record<string, any> = {
    'access': ['superuser', 'any_action_allow'],
    'access/users': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'access/organizations': ['superuser'],
    'access/roles': ['superuser'],

    'struct': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'struct/org': { mode: 'or', groups: ['superuser', 'any_action_allow'] },

    'crm/agent-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'crm/agent': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'crm/service-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'crm/place-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },

    'evt/agent': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'evt/agent-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },

    'img/agent': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'img/agent-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'img/place-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },

    'yclients/crm/config': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'yclients/config-list': ['superuser'],

    'macroscop/evt/config': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'macroscop/evt/type-list': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'macroscop/img/config': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'macroscop/config-list': ['superuser'],

    'isSuperUser': { mode: 'or', groups: ['superuser'] },
    'fullUserUpdate': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'partUserUpdate': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'anyOrgAllow': { mode: 'or', groups: ['superuser', 'any_org_allow'] },
    'structChangeOrg': { mode: 'or', groups: ['superuser', 'any_action_allow'] },
    'structModifyAgents': ['superuser'],
    'imgPlaceAllActions': { mode: 'or', groups: ['superuser'] },
    'evtTypesAllCations': { mode: 'or', groups: ['superuser'] },

}

export function authConstant(key: string): Data | undefined {
    return AUTH_CONSTANTS[key];
}
