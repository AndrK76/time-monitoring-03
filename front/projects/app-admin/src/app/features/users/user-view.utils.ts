import { UserListItemDto } from "@mon3/sa";
import { RoleInfo, UserInfo } from "./user-view.models";

export function userListDtoToView(dto: UserListItemDto, allRoles: RoleInfo[]): UserInfo {
    const rolesWithInfo: RoleInfo[] = (dto.roles || []).map(roleName => {
        const found = allRoles.find(r => r.name === roleName);
        return found || new RoleInfo(roleName, '');
    });

    return new UserInfo(
        dto.id,             // id
        dto.username,       // username
        '',                 // email
        '',                 // firstName
        '',                 // lastName
        dto.displayName,    // displayName
        undefined,          // avatarUrl
        dto.active,         // active
        dto.approved,       // approved
        false,              // emailVerified
        dto.roles || [],    // roles
        [],                 // permissions
        false,              // anonymous
        rolesWithInfo       // rolesWithInfo
    );
}

export function createEmptyUser(): UserInfo {
    return new UserInfo(
        'temp-' + Date.now(),  // id
        '',                    // username
        '',                    // email
        '',                    // firstName
        '',                    // lastName
        '',                    // displayName
        undefined,             // avatarUrl
        true,                  // active
        false,                 // approved
        false,                 // emailVerified
        [],                    // roles
        [],                    // permissions
        false,              // anonymous
        []                  // rolesWithInfo
    );
}