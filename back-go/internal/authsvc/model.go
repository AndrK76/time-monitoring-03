// Package authsvc is service-auth: users, roles, permissions, organizations,
// JWT issuance, and the Telegram magic-link token store.
//
// It owns the `auth` schema and publishes user events onto the bus for
// service-admin to consume.
package authsvc

import (
	"time"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// User mirrors the auth.users row. Column names are snake_case, and the Java
// entity used isActive/isApproved, which the API renders as active/approved.
type User struct {
	ID              string
	Username        string
	Email           *string
	Password        *string
	FirstName       *string
	LastName        *string
	DisplayName     *string
	AvatarURL       *string
	PhoneNumber     *string
	IsActive        bool
	IsEmailVerified bool
	IsApproved      bool
	LastLoginAt     *common.LocalDateTime
	CreatedAt       *common.LocalDateTime
	CreatedBy       *string
	UpdatedAt       *common.LocalDateTime
	UpdatedBy       *string
}

// Anonymous is the placeholder user returned by /auth/anonymous when no one is
// authenticated.
func Anonymous() *User {
	return &User{
		ID:        common.AnonymousUserID,
		Username:  common.AnonymousUser,
		IsActive:  true,
		CreatedAt: nil,
	}
}

// Role mirrors auth.roles.
type Role struct {
	ID          string
	Name        string
	Description *string
	CreatedAt   *common.LocalDateTime
	CreatedBy   *string
	UpdatedAt   *common.LocalDateTime
	UpdatedBy   *string
}

// Permission mirrors auth.permissions.
type Permission struct {
	ID          string
	Name        string
	Description *string
	// Special marks a permission that also grants blanket access, such as
	// SUPERUSER or ANY_ORG_ALLOW. A role is "special" when it holds at least
	// one, which is how RoleResponseDto.special is derived.
	Special bool
}

// RoleWithPermissions is a role plus its permission names.
type RoleWithPermissions struct {
	Role
	Permissions []string
}

// Organization mirrors auth.organizations. The table has no id default, so the
// id is supplied by whoever publishes the event.
type Organization struct {
	ID        string
	ShortName string
	FullName  string
}

// UserFull is a user with its aggregate loaded: roles, the permissions those
// roles grant, and organization ids.
//
// The Java service used a single JPQL query with LEFT JOIN FETCH for all three,
// because open-in-view was disabled and a lazy load outside a transaction would
// have thrown. The same eager aggregate is assembled here.
type UserFull struct {
	User
	Roles           []Role
	Permissions     []string
	OrganizationIDs []string
}

// PasswordHash returns the stored BCrypt hash, or an empty string.
func (u *User) PasswordHash() string {
	if u.Password == nil {
		return ""
	}
	return *u.Password
}

// IsAnonymous reports the anonymous placeholder. The Java User.isAnonymous
// compared id against null while User.anonymous() set it to the zero-uuid, so
// the flag was never true; the identity is recognised explicitly instead.
func (u *User) IsAnonymous() bool {
	return u != nil && u.ID == common.AnonymousUserID
}

// RoleNames returns the role names in order.
func (u *UserFull) RoleNames() []string {
	out := make([]string, 0, len(u.Roles))
	for _, r := range u.Roles {
		out = append(out, r.Name)
	}
	return out
}

// TelegramToken mirrors auth.telegram_tokens, the magic-link store.
type TelegramToken struct {
	ID             string
	Token          string
	UserID         string
	TelegramUserID *string
	ExpiresAt      time.Time
	IsUsed         bool
	UsedAt         *common.LocalDateTime
	CreatedAt      time.Time
	TargetURL      *string
}
