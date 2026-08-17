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
  anonymous: boolean;
}

export interface UserListItemDto {
  id: string;
  username: string;
  displayName: string;
}

export interface RoleDto {
  name: string;
  description: string;
}

export interface PermissionDto {
  name: string;
  description: string;
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponseDto;
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