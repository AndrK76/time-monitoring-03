package authsvc

// Request and response DTOs, field-for-field with the Java classes so the
// Angular front-end needs no change.

// LoginRequest is LoginRequestDto.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegistrationRequest is RegistrationRequestDto.
type RegistrationRequest struct {
	Username    string `json:"username"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	DisplayName string `json:"displayName"`
}

// ChangePasswordRequest is ChangePasswordRequestDto.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
	ConfirmPassword string `json:"confirmPassword"`
}

// UpdateUserRequest is UpdateUserRequestDto. Roles, active, emailVerified and
// userApproved are tri-state: nil means "leave unchanged", which is what makes
// PUT /users/me (personal fields only) and PUT /users/{id} (full update)
// distinguishable.
type UpdateUserRequest struct {
	Username      string   `json:"username"`
	Email         string   `json:"email"`
	FirstName     string   `json:"firstName"`
	LastName      *string  `json:"lastName"`
	DisplayName   string   `json:"displayName"`
	Active        *bool    `json:"active"`
	EmailVerified *bool    `json:"emailVerified"`
	UserApproved  *bool    `json:"userApproved"`
	Roles         []string `json:"roles"`
}

// ResetPasswordRequest is ResetPasswordRequestDto.
type ResetPasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

// UpdateRoleRequest is UpdateRoleRequestDto.
type UpdateRoleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// TokenResponse is TokenResponseDto. ExpiresIn is milliseconds, matching the
// Java value of security.jwt.expiration rather than seconds.
type TokenResponse struct {
	AccessToken  string        `json:"accessToken"`
	RefreshToken string        `json:"refreshToken"`
	TokenType    string        `json:"tokenType"`
	ExpiresIn    int64         `json:"expiresIn"`
	User         *UserResponse `json:"user"`
}

// UserResponse is UserResponseDto.
//
// SuperUser is populated by the management layer, which is where the Java
// mapper suppressed it: login, register, /me, /check and /anonymous always
// reported it as false. That behaviour is preserved, so a token minted at login
// does not leak superuser status to the UI before the management call confirms
// it.
type UserResponse struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	Email         *string  `json:"email"`
	FirstName     *string  `json:"firstName"`
	LastName      *string  `json:"lastName"`
	DisplayName   *string  `json:"displayName"`
	AvatarURL     *string  `json:"avatarUrl"`
	Active        bool     `json:"active"`
	Approved      bool     `json:"approved"`
	EmailVerified bool     `json:"emailVerified"`
	Roles         []string `json:"roles"`
	Permissions   []string `json:"permissions"`
	Organizations []string `json:"organizations"`
	Anonymous     bool     `json:"anonymous"`
	SuperUser     bool     `json:"superUser"`
}

// UserListItem is UserListItemDto.
type UserListItem struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	DisplayName   *string  `json:"displayName"`
	Active        bool     `json:"active"`
	Approved      bool     `json:"approved"`
	Roles         []string `json:"roles"`
	Organizations []string `json:"organizations"`
}

// RoleResponse is RoleResponseDto. Special is derived: the role grants at least
// one permission flagged special.
type RoleResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Special     bool    `json:"special"`
}

// RoleWithPermissionResponse is RoleWithPermissionDto.
type RoleWithPermissionResponse struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Permissions []string `json:"permissions"`
	Special     bool     `json:"special"`
}

// PermissionResponse is PermissionResponseDto.
//
// The Java DTO has no special field even though the column exists, and the
// front-end's TypeScript model expects one. It is omitted here to keep the wire
// contract identical rather than adding a field the original never sent.
type PermissionResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// OrganizationListItem is OrganizationListDto, shared with service-admin.
type OrganizationListItem struct {
	ID        string `json:"id"`
	ShortName string `json:"shortName"`
	FullName  string `json:"fullName"`
}

// UpdatePasswordResult is the body of POST /api/v1/admin/update-password.
type UpdatePasswordResult struct {
	Message  string `json:"message"`
	Username string `json:"username"`
}
