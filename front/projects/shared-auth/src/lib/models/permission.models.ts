export interface RequiredPermission {
    mode?: 'or' | 'and';
    groups?: string | string[] | RequiredPermission[]
}