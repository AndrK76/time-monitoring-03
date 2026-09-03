import { OrganizationItemDto, OrganizationListDto, UserListItemDto } from '@mon3/sa';
import { OrganizationInfo } from './organization-view.models';
import { UserShortInfo } from '../users/user-view.models';


export function organizationUsersWithInfo(dto: OrganizationItemDto | OrganizationInfo, allUsers: UserShortInfo[]) {
  return (dto.users || []).map(id => {
    const found = allUsers.find(u => u.id === id);
    return found || { id, username: '', displayName: 'Неизвестный' } as UserShortInfo;
  });
}

export function organizationUsersWithInfoFromUserIds(users: string[] | undefined, allUsers: UserShortInfo[]) {
  return (users || []).map(id => {
    const found = allUsers.find(u => u.id === id);
    return found || { id, username: '', displayName: 'Неизвестный' } as UserShortInfo;
  });
}

export function organizationListDtoToView(dto: OrganizationListDto): OrganizationInfo {
  return new OrganizationInfo(
    dto.id,
    dto.shortName,
    dto.fullName,
    []
  );
}

export function organizationItemDtoToView(dto: OrganizationItemDto, allUsers: UserShortInfo[]): OrganizationInfo {
  return {
    id: dto.id,
    shortName: dto.shortName,
    fullName: dto.fullName,
    users: dto.users,
    usersWithInfo: organizationUsersWithInfo(dto, allUsers),
  } as OrganizationInfo;
}

export function organizationViewToItemDto(view: OrganizationInfo): OrganizationItemDto {
  return {
    id: view.id,
    shortName: view.shortName,
    fullName: view.fullName,
    users: view.usersWithInfo.map(u => u.id)
  };
}

export function createEmptyOrganization(): OrganizationInfo {
  return new OrganizationInfo(
    'temp-' + Date.now(),
    '',
    '',
    []
  );
}

export function organizationViewToListItem(view: OrganizationInfo): OrganizationListDto {
  return {
    id: view.id,
    shortName: view.shortName,
    fullName: view.fullName
  };
}