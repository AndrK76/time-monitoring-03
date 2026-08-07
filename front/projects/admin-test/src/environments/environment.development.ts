import { EnvironmentInterface } from "./environment-interface";

export const environment: EnvironmentInterface = {
    production: false,
    //authApiUrl: 'http://andrk-ninkear.host:8083/api/v1',
    //adminApiUrl: 'http://andrk-ninkear.host:8082/api/v1',
    authApiUrl: 'http://crm.host:8083/api/v1',
    adminApiUrl: 'http://crm.host:8082/api/v1',
    appName: 'admin-test',
    otherAppUrl: 'http://crm.host:4301',
    otherAppName: 'mon-test',
};
