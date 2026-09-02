export interface OrganizationListDto {
  id: string;
  shortName: string;
  fullName: string;
}

export interface OrganizationItemDto {
  id: string;
  shortName: string;
  fullName: string;
  users: string[];
}