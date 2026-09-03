export interface LoginRequestDto {
  username: string;
  password: string;
}

export interface RegistrationRequestDto {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  displayName: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponseDto;
}

//User
export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  active: boolean;
  approved: boolean;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  organizations: string[];
  anonymous: boolean;
}

export interface UserListItemDto {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  approved: boolean;
  roles: string[];
}

export interface UpdateUserRequestDto {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  active?: boolean;
  userApproved?: boolean;
  emailVerified?: boolean;
  roles?: string[];
}

//Role
export interface RoleResponseDto {
  id: string;
  name: string;
  description: string;
}

export interface RoleWithPermissionDto {
  id: string;
  name: string;
  description: string;
  permissions: string[]
}

export interface UpdateRoleRequestDto {
  name: string;
  description: string;
  permissions?: string[];
}

//Permission
export interface PermissionResponseDto {
  id: string;
  name: string;
  description: string;
}




export interface TestResponse {
  message: string;
  username: string;
  userId: string;
  roles: string;
  permissions: string;
  timestamp: string;
  success: boolean;
}