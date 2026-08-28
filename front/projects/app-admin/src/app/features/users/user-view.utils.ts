import { UserListItemDto } from "@mon3/sa";
import { UserInfo } from "./user-view.models";

export function userDtoToView(dto: UserListItemDto): UserInfo {
    let ret: UserInfo = new UserInfo(
        dto.id,             // id
        dto.username,       // username
        '',                 // email
        '',                 // firstName
        '',                 // lastName
        dto.displayName,    // displayName
        undefined,          // avatarUrl
        true,               // active
        false,              // approved
        false,              // emailVerified
        [],                 // roles
        [],                 // permissions
        false               // anonymous
    );
    return ret;
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
        false                  // anonymous
    );
}