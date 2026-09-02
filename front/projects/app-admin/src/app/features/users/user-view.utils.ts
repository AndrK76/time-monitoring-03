import { UpdateUserRequestDto, UserListItemDto, UserResponseDto } from "@mon3/sa";
import { UserShortInfo, UserWithFullInfo } from "./user-view.models";
import { RoleInfo } from "../roles/role-view.models";


export const rolesWithInfo = (dto: UserListItemDto | UserResponseDto | UserWithFullInfo, allRoles: RoleInfo[]): RoleInfo[] => {
    const ret = (dto.roles || []).map(roleName => {
        const found = allRoles.find(r => r.name === roleName);
        return found || new RoleInfo('temp-' + roleName, roleName, '');
    });
    return ret;
}

export function userListDtoToFullView(dto: UserListItemDto, allRoles: RoleInfo[]): UserWithFullInfo {
    return new UserWithFullInfo(
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

export function userListDtoToShortView(dto: UserListItemDto): UserShortInfo {
    return new UserShortInfo(
        dto.id,           //id
        dto.username,     //username
        dto.displayName,  //displayName
        dto.active,       //active
        dto.approved,     //approved
        dto.roles         //roles
    )
}


export function createEmptyUser(): UserWithFullInfo {
    return new UserWithFullInfo(
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

export function userResponseDtoToFullView(dto: UserResponseDto, allRoles: RoleInfo[]): UserWithFullInfo {
    return new UserWithFullInfo(
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

export function userViewToRequestDto(item: UserWithFullInfo): UpdateUserRequestDto {
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

