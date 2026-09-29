package security

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// Auth is the per-request security context, the Go equivalent of
// JwtAuthenticationToken. It is the only authentication type the access rules
// recognise, which reproduces the fail-closed behaviour of the Java
// SecurityAccessUtils: a request that is not authenticated by a verified JWT
// has no context at all and every permission check denies.
type Auth struct {
	UserID               string
	Username             string
	Token                string
	Roles                []string
	Permissions          []string
	AllowedOrganizations []string
}

type contextKey struct{}

// WithAuth attaches a context to a request.
func WithAuth(ctx context.Context, a *Auth) context.Context {
	return context.WithValue(ctx, contextKey{}, a)
}

// FromContext returns the request's auth, or nil when unauthenticated.
func FromContext(ctx context.Context) *Auth {
	a, _ := ctx.Value(contextKey{}).(*Auth)
	return a
}

// HasPermission reports whether the token carries a permission.
func (a *Auth) HasPermission(permission string) bool {
	if a == nil {
		return false
	}
	return slices.Contains(a.Permissions, permission)
}

// HasAnyPermission reports whether any of the permissions is present.
func (a *Auth) HasAnyPermission(permissions ...string) bool {
	if a == nil {
		return false
	}
	for _, p := range permissions {
		if slices.Contains(a.Permissions, p) {
			return true
		}
	}
	return false
}

// HasRole reports whether the token carries a role.
func (a *Auth) HasRole(role string) bool {
	if a == nil {
		return false
	}
	return slices.Contains(a.Roles, role)
}

// IsAllowedOrganization mirrors JwtAuthenticationToken#isAllowedOrganization:
// SUPERUSER and ANY_ORG_ALLOW see everything, anyone else sees only the
// organizations listed in the token.
func (a *Auth) IsAllowedOrganization(orgID string) bool {
	if a == nil {
		return false
	}
	if a.HasPermission(PermissionSuperUser) || a.HasPermission(PermissionAnyOrgAllow) {
		return true
	}
	return slices.Contains(a.AllowedOrganizations, orgID)
}

// Authorities is the roles-then-permissions flattening the Java token exposed,
// used when building a command's security context for the message bus.
func (a *Auth) Authorities() []string {
	if a == nil {
		return []string{}
	}
	out := make([]string, 0, len(a.Roles)+len(a.Permissions))
	out = append(out, a.Roles...)
	out = append(out, a.Permissions...)
	return out
}

// ToUserContext renders the context for a CommandMessage, mirroring
// SecurityContextMapper#toUserContext: the list-like values become
// comma-joined strings.
func (a *Auth) ToUserContext() *common.UserContext {
	if a == nil {
		return common.AnonymousUserContext()
	}
	return &common.UserContext{
		UserID:               a.UserID,
		Username:             a.Username,
		Roles:                strings.Join(a.Roles, ","),
		Permissions:          strings.Join(a.Permissions, ","),
		AllowedOrganizations: strings.Join(a.AllowedOrganizations, ","),
		Authenticated:        true,
	}
}

// ToSecurityContext renders the wire security context, mirroring
// SecurityContextMapper#toDto. The principal and credentials are the token's
// user id and the raw JWT, stringified, exactly as Java's toString() did.
func (a *Auth) ToSecurityContext() *common.SecurityContext {
	if a == nil {
		return &common.SecurityContext{Authenticated: false}
	}
	principal := a.UserID
	credentials := a.Token
	name := a.Username
	return &common.SecurityContext{
		Principal:     &principal,
		Credentials:   &credentials,
		Authorities:   a.Authorities(),
		Authenticated: true,
		Name:          &name,
	}
}

// Access wraps the org-scoped permission rules from SecurityAccessUtils.
type Access struct{}

// Default is the shared accessor.
var Default = Access{}

func (Access) HasPermission(a *Auth, permission string) bool { return a.HasPermission(permission) }

func (Access) HasAnyPermission(a *Auth, permissions ...string) bool {
	return a.HasAnyPermission(permissions...)
}

// IsSuperUser reports whether the token holds SUPERUSER.
func (Access) IsSuperUser(a *Auth) bool { return a.HasPermission(PermissionSuperUser) }

// IsAllowedAllActions reports ANY_ACTION_ALLOW or SUPERUSER.
func (Access) IsAllowedAllActions(a *Auth) bool {
	return a.HasPermission(PermissionAnyActionAllow) || a.HasPermission(PermissionSuperUser)
}

// IsAllowedAllOrganizations reports ANY_ORG_ALLOW or SUPERUSER.
func (Access) IsAllowedAllOrganizations(a *Auth) bool {
	return a.HasPermission(PermissionAnyOrgAllow) || a.HasPermission(PermissionSuperUser)
}

// IsAllowedOrganization delegates to the token.
func (Access) IsAllowedOrganization(a *Auth, orgID string) bool {
	return a.IsAllowedOrganization(orgID)
}

// GetAllowedOrganizations returns the token's organization list, empty when
// unauthenticated.
func (Access) GetAllowedOrganizations(a *Auth) []string {
	if a == nil {
		return []string{}
	}
	return a.AllowedOrganizations
}

// InSomeOrganization mirrors SecurityAccessUtils#inSomeOrganization: a caller
// with blanket org access passes, otherwise the caller's organizations must
// intersect the candidate list. An empty caller list matches nothing, so a user
// with no organizations sees no one.
func (Access) InSomeOrganization(a *Auth, orgIDs []string) bool {
	if Default.IsAllowedAllOrganizations(a) {
		return true
	}
	allowed := Default.GetAllowedOrganizations(a)
	if len(allowed) == 0 {
		return false
	}
	for _, candidate := range orgIDs {
		if slices.Contains(allowed, candidate) {
			return true
		}
	}
	return false
}

// ExtractToken mirrors the service-auth CookieServiceFull chain: the
// Authorization header first, then the auth_token cookie. The admin and
// monitoring services used CookieServiceBase, which read only the header.
func ExtractToken(r *http.Request, readCookie bool) string {
	if header := r.Header.Get("Authorization"); header != "" {
		// The prefix match is case-sensitive, as in the Java code.
		if after, ok := strings.CutPrefix(header, "Bearer "); ok {
			return after
		}
	}
	if !readCookie {
		return ""
	}
	if cookie, err := r.Cookie(CookieName); err == nil {
		return cookie.Value
	}
	return ""
}
