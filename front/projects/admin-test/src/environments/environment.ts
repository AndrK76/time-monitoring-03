import { EnvironmentInterface } from "./environment-interface";

export const environment: EnvironmentInterface = {
    production: true,
    authApiUrl: 'http://crm.host:8083/api/v1',
    adminApiUrl: 'http://crm.host:8082/api/v1',
    appName: 'admin-test',
    otherAppUrl: 'http://crm.host:8701',
    otherAppName: 'mon-test',
};
