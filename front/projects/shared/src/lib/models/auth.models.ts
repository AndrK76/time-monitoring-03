export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  displayName: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateUserRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  active?: boolean;
  emailVerified?: boolean;
  roles?: string[];
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  active: boolean;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  anonymous: boolean;
}

export interface UserListItem {
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

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponse;
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