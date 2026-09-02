import { OrganizationItemDto, OrganizationListDto, UserListItemDto } from '@mon3/sa';
import { OrganizationInfo } from './organization-view.models';

export function organizationListDtoToView(dto: OrganizationListDto): OrganizationInfo {
  return new OrganizationInfo(
    dto.id,
    dto.shortName,
    dto.fullName,
    []
  );
}

export function organizationItemDtoToView(dto: OrganizationItemDto, allUsers: UserListItemDto[]): OrganizationInfo {
  const usersWithInfo = (dto.users || []).map(id => {
    const found = allUsers.find(u => u.id === id);
    return found || { id, username: '', displayName: 'Неизвестный' } as UserListItemDto;
  });
  return new OrganizationInfo(
    dto.id,
    dto.shortName,
    dto.fullName,
    dto.users,
    usersWithInfo
  );
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