import { UpdateUserRequestDto, UserListItemDto, UserResponseDto } from "@mon3/sa";
import { UserShortInfo, UserWithFullInfo } from "./user-view.models";
import { RoleInfo } from "../roles/role-view.models";
import { OrganizationInfo } from "../organizations/organization-view.models";

export const tempRole = (roleName: string): RoleInfo => {
    return {
        id: `temp-${roleName}`,
        name: `${roleName}`,
        description: `${roleName}`,
        special: false
    } as RoleInfo;
}

export const userRolesWithInfo = (dto: UserListItemDto | UserResponseDto | UserWithFullInfo, allRoles: RoleInfo[]): RoleInfo[] => {
    return userRolesWithInfoByRoles(dto.roles, allRoles);
}

export const userRolesWithInfoByRoles = (src: string[] | undefined, allRoles: RoleInfo[]): RoleInfo[] => {
    const ret = (src || []).map(roleName => {
        const found = allRoles.find(r => r.name === roleName);
        return found || tempRole(roleName);
    });
    return ret;
}

export const userOrganizationsWithInfo = (dto: UserListItemDto | UserResponseDto | UserWithFullInfo, allOrganizations?: OrganizationInfo[]): OrganizationInfo[] => {
    if (!allOrganizations) return [];
    const ret = (dto.organizations || []).map(orgId => {
        const found = allOrganizations.find(r => r.id === orgId);
        return found || new OrganizationInfo(orgId, '', '');
    });
    return ret;
}

export function userListDtoToFullView(dto: UserListItemDto, allRoles: RoleInfo[]
    , allOrganizations?: OrganizationInfo[]): UserWithFullInfo {
    return new UserWithFullInfo(
        dto.id,                            // id
        dto.username,                      // username
        '',                                // email
        '',                                // firstName
        '',                                // lastName
        dto.displayName,                   // displayName
        undefined,                         // avatarUrl
        dto.active,                        // active
        dto.approved,                      // approved
        false,                             // emailVerified
        dto.roles || [],                   // roles
        [],                                // permissions
        false,                             // anonymous
        userRolesWithInfo(dto, allRoles),  // rolesWithInfo
        dto.organizations || [],           // organizations
        userOrganizationsWithInfo(dto, allOrganizations),
        false,                             //superUser

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
        false,                 // anonymous
        [],                    // rolesWithInfo
        [],                    // organizations
        [],                    // organizationsWithInfo
    );
}

export function userResponseDtoToFullView(dto: UserResponseDto, allRoles: RoleInfo[], allOrganizations: OrganizationInfo[]): UserWithFullInfo {
    return new UserWithFullInfo(
        dto.id,                           // id
        dto.username,                     // username
        dto.email,                        // email
        dto.firstName,                    // firstName
        dto.lastName,                     // lastName
        dto.displayName,                  // displayName
        dto.avatarUrl,                    // avatarUrl
        dto.active,                       // active
        dto.approved,                     // approved
        dto.emailVerified,                // emailVerified
        dto.roles || [],                  // roles
        dto.permissions,                  // permissions
        dto.anonymous,                    // anonymous
        userRolesWithInfo(dto, allRoles), // rolesWithInfo
        dto.organizations,                // organizations
        userOrganizationsWithInfo(dto, allOrganizations),
        dto.superUser,                    // superUser

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
        roles: item.roles,
        organizations: item.organizations
    } as UpdateUserRequestDto;
}

