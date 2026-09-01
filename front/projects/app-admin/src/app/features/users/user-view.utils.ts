import { UpdateUserRequestDto, UserListItemDto, UserResponseDto } from "@mon3/sa";
import { UserInfo } from "./user-view.models";
import { RoleInfo } from "../roles/role-view.models";


export const rolesWithInfo = (dto: UserListItemDto | UserResponseDto | UserInfo, allRoles: RoleInfo[]): RoleInfo[] => {
    const ret = (dto.roles || []).map(roleName => {
        const found = allRoles.find(r => r.name === roleName);
        return found || new RoleInfo('temp-' + roleName, roleName, '');
    });
    return ret;
}

export function userListDtoToView(dto: UserListItemDto, allRoles: RoleInfo[]): UserInfo {
    return new UserInfo(
        dto.id,                       // id
        dto.username,                 // username
        '',                           // email
        '',                           // firstName
        '',                           // lastName
        dto.displayName,              // displayName
        undefined,                    // avatarUrl
        dto.active,                   // active
        dto.approved,                 // approved
        false,                        // emailVerified
        dto.roles || [],              // roles
        [],                           // permissions
        false,                        // anonymous
        rolesWithInfo(dto, allRoles)  // rolesWithInfo
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

export function userResponseDtoToView(dto: UserResponseDto, allRoles: RoleInfo[]): UserInfo {
    return new UserInfo(
        dto.id,                       // id
        dto.username,                 // username
        dto.email,                    // email
        dto.firstName,                // firstName
        dto.lastName,                 // lastName
        dto.displayName,              // displayName
        dto.avatarUrl,                // avatarUrl
        dto.active,                   // active
        dto.approved,                 // approved
        dto.emailVerified,            // emailVerified
        dto.roles || [],              // roles
        dto.permissions,              // permissions
        dto.anonymous,                // anonymous
        rolesWithInfo(dto, allRoles)  // rolesWithInfo
    );
}

export function userViewToRequestDto(item: UserInfo): UpdateUserRequestDto {
    return {
        username: item.username,
        email: item.email,
        firstName: item.firstName,
        lastName: item.lastName,
        displayName: item.displayName,
        active: item.active,
        userApproved: item.approved,
        emailVerified: item.emailVerified,
        roles: item.roles
    } as UpdateUserRequestDto;
}

