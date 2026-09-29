package authsvc

import (
	"context"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
	"github.com/nightweb/time-monitoring-03/back-go/internal/validate"
)

// ToUserResponse renders a user aggregate as the API response.
//
// superUser is passed in rather than derived, because the Java mapper suppressed
// the field: only the management endpoints computed it, and login, register,
// /me, /check and /anonymous always reported false. That is preserved so a token
// minted at login does not disclose superuser status before an admin call
// confirms it.
func ToUserResponse(full *UserFull, superUser bool) *UserResponse {
	roles := full.RoleNames()
	if roles == nil {
		roles = []string{}
	}
	permissions := full.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	orgs := full.OrganizationIDs
	if orgs == nil {
		orgs = []string{}
	}
	return &UserResponse{
		ID:            full.ID,
		Username:      full.Username,
		Email:         full.Email,
		FirstName:     full.FirstName,
		LastName:      full.LastName,
		DisplayName:   full.DisplayName,
		AvatarURL:     full.AvatarURL,
		Active:        full.IsActive,
		Approved:      full.IsApproved,
		EmailVerified: full.IsEmailVerified,
		Roles:         roles,
		Permissions:   permissions,
		Organizations: orgs,
		Anonymous:     full.IsAnonymous(),
		SuperUser:     superUser,
	}
}

// ToListItem renders a user for the management list, which omits email and the
// permission set to keep the payload small.
func ToListItem(u *User, roles []string, orgIDs []string) *UserListItem {
	if roles == nil {
		roles = []string{}
	}
	if orgIDs == nil {
		orgIDs = []string{}
	}
	return &UserListItem{
		ID:            u.ID,
		Username:      u.Username,
		DisplayName:   u.DisplayName,
		Active:        u.IsActive,
		Approved:      u.IsApproved,
		Roles:         roles,
		Organizations: orgIDs,
	}
}

// requireAuth returns the request's auth or a 401.
func requireAuth(r *http.Request) (*security.Auth, error) {
	a := security.FromContext(r.Context())
	if a == nil {
		return nil, httpx.Unauthorized(httpx.MessageAuthRequired)
	}
	return a, nil
}

// CurrentUser serves GET /auth/me.
//
// Unlike login and register, this endpoint does report superUser, which is what
// the front-end's permission service depends on to decide whether to render
// admin navigation.
func (s *Service) CurrentUser(ctx context.Context, a *security.Auth) (*UserResponse, error) {
	full, err := s.loadUser(ctx, a.UserID)
	if err != nil {
		return nil, err
	}
	super := security.Default.IsSuperUser(a)
	return ToUserResponse(full, super), nil
}

// CheckToken serves GET /auth/check, a cheap token-validity probe.
//
// It returns 200 with a minimal body rather than the full user, so a client can
// verify a stored token on start-up without a second round trip's worth of data.
func (s *Service) CheckToken(ctx context.Context, a *security.Auth) error {
	if a == nil || a.UserID == "" {
		return httpx.Unauthorized(httpx.MessageAuthRequired)
	}
	if _, err := s.store.FindUserByID(ctx, s.pool, a.UserID); err != nil {
		if db.IsNoRows(err) {
			return httpx.Unauthorized(httpx.MessageNotFound)
		}
		return err
	}
	return nil
}

// Anonymous serves GET /auth/anonymous, returning the anonymous placeholder.
//
// Unauthenticated callers get the placeholder; an authenticated caller is
// rejected, because a logged-in user asking "who am I anonymously" has a bug on
// their side and silently returning a placeholder would hide it.
func (s *Service) Anonymous(a *security.Auth) (*UserResponse, error) {
	if a != nil {
		return nil, httpx.Conflict("Already authenticated")
	}
	anon := &UserFull{
		User:            *Anonymous(),
		Roles:           []Role{},
		Permissions:     []string{},
		OrganizationIDs: []string{},
	}
	return ToUserResponse(anon, false), nil
}

func (s *Service) loadUser(ctx context.Context, userID string) (*UserFull, error) {
	var full *UserFull
	err := s.pool.InReadTx(ctx, func(q db.Querier) error {
		var err error
		full, err = s.store.LoadUserFull(ctx, q, userID)
		return err
	})
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("User not available: " + userID)
		}
		return nil, err
	}
	return full, nil
}

// UpdateSelf serves PUT /users/me, which writes only personal fields.
//
// Roles, active and approved in the request body are ignored, not rejected, so
// the same DTO can be reused by the full-update endpoint and a client sending
// the whole user object to /me does not get a 400.
func (s *Service) UpdateSelf(ctx context.Context, a *security.Auth, req UpdateUserRequest) (*UserResponse, error) {
	if err := validateUserRequest(req); err != nil {
		return nil, err
	}
	full, err := s.loadUser(ctx, a.UserID)
	if err != nil {
		return nil, err
	}

	err = s.pool.InTx(ctx, func(q db.Querier) error {
		return s.applyPersonalFields(ctx, q, full, req, a.UserID)
	})
	if err != nil {
		return nil, err
	}

	reloaded, err := s.loadUser(ctx, a.UserID)
	if err != nil {
		return nil, err
	}
	s.publishUserInfoUpdated(ctx, reloaded, false, a.UserID)
	return ToUserResponse(reloaded, security.Default.IsSuperUser(a)), nil
}

func (s *Service) applyPersonalFields(ctx context.Context, q db.Querier, full *UserFull, req UpdateUserRequest, actor string) error {
	if strings.TrimSpace(req.FirstName) != "" {
		full.FirstName = &req.FirstName
	}
	if strings.TrimSpace(req.DisplayName) != "" {
		full.DisplayName = &req.DisplayName
	}
	if strings.TrimSpace(req.Email) != "" {
		full.Email = &req.Email
	}
	if req.LastName != nil {
		full.LastName = req.LastName
	}
	return s.store.UpdatePersonalFields(ctx, q, &full.User, actor)
}

func validateUserRequest(req UpdateUserRequest) error {
	v := validate.New()
	v.NotBlank("username", req.Username, strings.TrimSpace(req.Username) != "", "")
	v.NotBlank("email", req.Email, strings.TrimSpace(req.Email) != "", "")
	v.Email("email", req.Email)
	v.NotBlank("firstName", req.FirstName, strings.TrimSpace(req.FirstName) != "", "")
	v.NotBlank("displayName", req.DisplayName, strings.TrimSpace(req.DisplayName) != "", "")
	return v.Err()
}

// ChangePassword serves POST /users/me/change-password.
func (s *Service) ChangePassword(ctx context.Context, a *security.Auth, req ChangePasswordRequest) error {
	v := validate.New()
	v.NotBlank("currentPassword", req.CurrentPassword, strings.TrimSpace(req.CurrentPassword) != "", "")
	v.NotBlank("newPassword", req.NewPassword, strings.TrimSpace(req.NewPassword) != "", "")
	v.NotBlank("confirmPassword", req.ConfirmPassword, strings.TrimSpace(req.ConfirmPassword) != "", "")
	v.Size("newPassword", req.NewPassword, 6, 0)
	if err := v.Err(); err != nil {
		return err
	}
	if req.NewPassword != req.ConfirmPassword {
		return httpx.BadRequest("New password and confirmation do not match")
	}

	var hash string
	err := s.pool.InReadTx(ctx, func(q db.Querier) error {
		u, err := s.store.FindUserByID(ctx, q, a.UserID)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.NotFound("User not available: " + a.UserID)
			}
			return err
		}
		if !s.passwordMatches(u.PasswordHash(), req.CurrentPassword) {
			return httpx.BadRequest("Current password is incorrect")
		}
		hash = u.PasswordHash()
		return nil
	})
	if err != nil {
		return err
	}

	// The existing hash is captured above so the update can be skipped when the
	// new password hashes to the same value, avoiding a needless event.
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if string(newHash) == hash {
		return nil
	}

	return s.pool.InTx(ctx, func(q db.Querier) error {
		return s.store.UpdatePasswordHash(ctx, q, a.UserID, string(newHash), a.UserID)
	})
}

// ResetPassword serves PUT /users/{id}/reset-password, an admin action.
//
// Accounts seeded without a password get the configured DEFAULT_PASSWORD when
// no new value is supplied, which is how the initial superadmin account was
// given a working login.
func (s *Service) ResetPassword(ctx context.Context, a *security.Auth, userID string, req ResetPasswordRequest) error {
	v := validate.New()
	if strings.TrimSpace(req.NewPassword) == "" {
		v.NotBlank("newPassword", req.NewPassword, false, "")
	} else {
		v.Size("newPassword", req.NewPassword, 6, 0)
	}
	if err := v.Err(); err != nil {
		return err
	}

	target, err := s.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	if err := s.canUpdateUser(ctx, a, target); err != nil {
		return err
	}

	password := req.NewPassword
	if strings.TrimSpace(password) == "" {
		password = s.defaultPassword
	}
	if strings.TrimSpace(password) == "" {
		return httpx.BadRequest("DEFAULT_PASSWORD is not configured, a new password is required")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	err = s.pool.InTx(ctx, func(q db.Querier) error {
		return s.store.UpdatePasswordHash(ctx, q, userID, string(hash), a.UserID)
	})
	if err != nil {
		return err
	}

	reloaded, err := s.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	s.publishUserInfoUpdated(ctx, reloaded, false, a.UserID)
	return nil
}

// canUpdateUser enforces the user-management authorisation rule.
//
// Two conditions, both from the Java service: the caller must share an
// organization with the target, and a non-superuser may not edit a superuser.
// Without the second, an org admin could demote the system administrator.
func (s *Service) canUpdateUser(ctx context.Context, actor *security.Auth, target *UserFull) error {
	var allOrgs []Organization
	err := s.pool.InReadTx(ctx, func(q db.Querier) error {
		var err error
		allOrgs, err = s.store.ListOrganizations(ctx, q)
		return err
	})
	if err != nil {
		return err
	}
	targetOrgs := target.OrganizationIDs
	if !security.Default.InSomeOrganization(actor, orgIDsOf(allOrgs, actor)) ||
		!security.Default.InSomeOrganization(actor, targetOrgs) {
		return httpx.Forbidden("User not available: " + target.ID)
	}
	if !security.Default.IsSuperUser(actor) && containsSuperuserRole(target) {
		return httpx.Forbidden("User not available: " + target.ID)
	}
	return nil
}

// orgIDsOf returns the organization ids visible to the caller: every
// organization for a blanket-access caller, otherwise only the ones in the
// token.
func orgIDsOf(all []Organization, a *security.Auth) []string {
	if security.Default.IsAllowedAllOrganizations(a) {
		out := make([]string, 0, len(all))
		for _, o := range all {
			out = append(out, o.ID)
		}
		return out
	}
	return a.AllowedOrganizations
}

// containsSuperuserRole reports whether the target holds a role granting
// SUPERUSER.
func containsSuperuserRole(full *UserFull) bool {
	for _, r := range full.Roles {
		if r.Name == "ROLE_SUPERUSER" || r.Name == "SUPERUSER" {
			return true
		}
	}
	return slicesContains(full.Permissions, security.PermissionSuperUser)
}

func slicesContains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

// orgEvent publishes an organization change to service-admin and the
// monitoring service, which mirrors the auth schema.
func (s *Service) orgEvent(ctx context.Context, event *common.OrganizationInfoChangedEvent) {
	s.publish(ctx, rabbitRouteAdmin, common.CmdOrganizationInfoChanged, event)
}

const rabbitRouteAdmin = "mon3.admin"
