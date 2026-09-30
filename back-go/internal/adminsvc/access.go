package adminsvc

import (
	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// anonymousUserID is the id AuthInfoUtils.extractUserId(nil) produced, taken
// from User.anonymous().
const anonymousUserID = common.AnonymousUserID

// Access mirrors ru.igorit.monitoring.security.util.SecurityAccessUtils.
//
// The Java service addressed this component from @PreAuthorize expressions
// ("@securityAccessUtils.isSuperUser()"), so the checks ran before the method
// body and a denial was a 403 from the method-security interceptor. In Go the
// handler calls these methods at the top of each action and returns the same
// 403, which is the same observable behaviour.
type Access struct {
	auth *security.Auth
}

// NewAccess captures the request's security context.
func NewAccess(auth *security.Auth) *Access { return &Access{auth: auth} }

// Permission names carried in the JWT. They are the same constants the Java
// service exposed as public static final fields.
const (
	PermissionSuperUser    = "SUPERUSER"
	PermissionAnyOrgAllow  = "ANY_ORG_ALLOW"
	PermissionAnyActionAll = "ANY_ACTION_ALLOW"
)

// HasPermission reports whether the caller carries a permission.
func (a *Access) HasPermission(permission string) bool { return a.auth.HasPermission(permission) }

// HasAnyPermission reports whether the caller carries any of the permissions.
func (a *Access) HasAnyPermission(permissions ...string) bool {
	return a.auth.HasAnyPermission(permissions...)
}

// AllowedOrganizations returns the organizations the caller may see.
func (a *Access) AllowedOrganizations() []string {
	if a.auth == nil {
		return []string{}
	}
	return a.auth.AllowedOrganizations
}

// IsAllowedOrganization reports whether the caller may act on one organization.
func (a *Access) IsAllowedOrganization(orgID string) bool {
	return a.auth.IsAllowedOrganization(orgID)
}

// IsSuperUser reports SUPERUSER. It gates every mutating agent operation, since
// an agent binding changes which organization sees which video stream and must
// not be delegated.
func (a *Access) IsSuperUser() bool {
	return a.auth.HasAnyPermission(PermissionSuperUser)
}

// IsAllowedAllOrganizations reports whether the caller may act on every
// organization.
func (a *Access) IsAllowedAllOrganizations() bool {
	return a.auth.HasAnyPermission(PermissionAnyOrgAllow, PermissionSuperUser)
}

// IsAllowedAllActions reports whether the caller may act everywhere. It is
// narrower than IsAllowedAllOrganizations: it covers the whole tenant rather
// than every organization, and it gates every read of a configuration, which
// exposes server credentials.
func (a *Access) IsAllowedAllActions() bool {
	return a.auth.HasAnyPermission(PermissionAnyActionAll, PermissionSuperUser)
}

// InSomeOrganization reports whether the caller may act on any of the named
// organizations, which is the check the YClients multi-select endpoints use.
func (a *Access) InSomeOrganization(organizations []string) bool {
	if a.IsAllowedAllOrganizations() {
		return true
	}
	allowed := a.AllowedOrganizations()
	if len(allowed) == 0 {
		return false
	}
	for _, org := range organizations {
		for _, cand := range allowed {
			if org == cand {
				return true
			}
		}
	}
	return false
}

// UserID is the caller's id, used for the created_by and updated_by audit
// columns. An unauthenticated caller contributes the anonymous user id, which is
// what AuthInfoUtils.extractUserId(null) returned.
func (a *Access) UserID() string {
	if a.auth == nil || a.auth.UserID == "" {
		return anonymousUserID
	}
	return a.auth.UserID
}
