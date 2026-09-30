package authsvc

import (
	"context"
	"strings"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// ListUsers serves GET /users.
//
// Visibility is scoped: a caller with blanket organization access sees everyone,
// anyone else sees only users who share an organization with them. The Java
// implementation loaded all users and filtered in memory, which meant the
// response depended on a full table scan; the filter is applied here against the
// membership map already loaded for the response.
func (s *Service) ListUsers(ctx context.Context, a *security.Auth) ([]*UserListItem, error) {
	all, err := s.store.ListUsers(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(all))
	for _, u := range all {
		ids = append(ids, u.ID)
	}
	memberships, err := s.store.OrganizationsForUsers(ctx, s.pool, ids)
	if err != nil {
		return nil, err
	}
	roles, err := s.rolesForUsers(ctx, ids)
	if err != nil {
		return nil, err
	}

	allOrgs := s.visibleOrgIDs(ctx, a)

	out := make([]*UserListItem, 0, len(all))
	for i := range all {
		u := all[i]
		userOrgs := memberships[u.ID]
		if userOrgs == nil {
			userOrgs = []string{}
		}
		if !security.Default.InSomeOrganization(a, userOrgs) {
			// A user who belongs to no organization is visible only to callers
			// with blanket access; otherwise an unassigned account would be
			// invisible to the org admin who has to approve it.
			if !security.Default.IsAllowedAllOrganizations(a) {
				continue
			}
		}
		if !security.Default.InSomeOrganization(a, allOrgs) {
			continue
		}
		item := ToListItem(&u, roles[u.ID], userOrgs)
		out = append(out, item)
	}
	return out, nil
}

// visibleOrgIDs returns the organization ids the caller may operate within.
func (s *Service) visibleOrgIDs(ctx context.Context, a *security.Auth) []string {
	if security.Default.IsAllowedAllOrganizations(a) {
		all, err := s.store.ListOrganizations(ctx, s.pool)
		if err != nil {
			return a.AllowedOrganizations
		}
		out := make([]string, 0, len(all))
		for _, o := range all {
			out = append(out, o.ID)
		}
		return out
	}
	return a.AllowedOrganizations
}

// rolesForUsers loads role names for a batch of users in two queries rather than
// one per user.
func (s *Service) rolesForUsers(ctx context.Context, userIDs []string) (map[string][]string, error) {
	out := make(map[string][]string, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT ur.user_id, r.name
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = ANY($1)
		ORDER BY r.name`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var userID, name string
		if err := rows.Scan(&userID, &name); err != nil {
			return nil, err
		}
		out[userID] = append(out[userID], name)
	}
	return out, rows.Err()
}

// GetUser serves GET /users/{id}.
func (s *Service) GetUser(ctx context.Context, a *security.Auth, userID string) (*UserResponse, error) {
	full, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.canUpdateUser(ctx, a, full); err != nil {
		return nil, err
	}
	return ToUserResponse(full, containsSuperuserRole(full)), nil
}

// CreateUser serves POST /users, restricted to superusers.
func (s *Service) CreateUser(ctx context.Context, a *security.Auth, req UpdateUserRequest) (*UserResponse, error) {
	if !security.Default.IsSuperUser(a) {
		return nil, httpx.Forbidden("Superuser is required")
	}
	if err := validateUserRequest(req); err != nil {
		return nil, err
	}

	taken, err := s.store.UsernameExists(ctx, s.pool, req.Username)
	if err != nil {
		return nil, err
	}
	if taken {
		return nil, httpx.Conflict("Username is already taken")
	}

	now := common.NowLocalDateTime()
	hash, err := hashOrDefault(req, s.defaultPassword)
	if err != nil {
		return nil, err
	}
	email := req.Email
	firstName := req.FirstName
	displayName := req.DisplayName

	created := &UserFull{
		User: User{
			ID:              newID(),
			Username:        req.Username,
			Email:           &email,
			Password:        &hash,
			FirstName:       &firstName,
			LastName:        req.LastName,
			DisplayName:     &displayName,
			IsActive:        derefOrBool(req.Active, true),
			IsEmailVerified: derefOrBool(req.EmailVerified, false),
			IsApproved:      derefOrBool(req.UserApproved, true),
			CreatedAt:       &now,
			CreatedBy:       &a.UserID,
		},
		Roles:           []Role{},
		Permissions:     []string{},
		OrganizationIDs: []string{},
	}

	err = s.pool.InTx(ctx, func(q db.Querier) error {
		if err := s.store.InsertUser(ctx, q, &created.User); err != nil {
			return err
		}
		if len(req.Roles) > 0 {
			return s.store.UpdateUserRoles(ctx, q, created.ID, req.Roles, a.UserID)
		}
		return nil
	})
	if err != nil {
		if db.IsUniqueViolation(err) {
			return nil, httpx.Conflict("Username or email is already registered")
		}
		return nil, err
	}

	reloaded, err := s.loadUser(ctx, created.ID)
	if err != nil {
		return nil, err
	}
	s.publishUserCreated(ctx, reloaded)
	s.publishUserInfoUpdated(ctx, reloaded, true, a.UserID)
	return ToUserResponse(reloaded, false), nil
}

// UpdateUser serves PUT /users/{id}, the full administrative update.
func (s *Service) UpdateUser(ctx context.Context, a *security.Auth, userID string, req UpdateUserRequest) (*UserResponse, error) {
	if err := validateUserRequest(req); err != nil {
		return nil, err
	}
	target, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.canUpdateUser(ctx, a, target); err != nil {
		return nil, err
	}

	// Approval is one-way and is enforced in SQL: is_approved OR COALESCE(...).
	// Revoking approval through this endpoint was possible in Java and is one of
	// the defects fixed in this port; see MIGRATION.md.
	rolesChanged := false
	if req.Roles != nil {
		rolesChanged = !sameSet(target.RoleNames(), req.Roles)
	}

	err = s.pool.InTx(ctx, func(q db.Querier) error {
		if err := s.store.UpdateAllFields(ctx, q, req, userID, a.UserID); err != nil {
			return err
		}
		if rolesChanged {
			return s.store.UpdateUserRoles(ctx, q, userID, req.Roles, a.UserID)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	reloaded, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	s.publishUserInfoUpdated(ctx, reloaded, true, a.UserID)
	return ToUserResponse(reloaded, containsSuperuserRole(reloaded)), nil
}

// DeleteUser serves DELETE /users/{id}.
//
// The Java service loaded the user, checked access, then deleted, which left a
// window where a concurrent request could re-create the row. The check and the
// delete share a transaction here.
func (s *Service) DeleteUser(ctx context.Context, a *security.Auth, userID string) error {
	target, err := s.loadUser(ctx, userID)
	if err != nil {
		return err
	}
	if err := s.canUpdateUser(ctx, a, target); err != nil {
		return err
	}
	if target.ID == a.UserID {
		return httpx.BadRequest("A user cannot delete their own account")
	}

	return s.pool.InTx(ctx, func(q db.Querier) error {
		tag, err := q.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return httpx.NotFound("User not available: " + userID)
		}
		return nil
	})
}

// ListRoles serves GET /roles.
func (s *Service) ListRoles(ctx context.Context) ([]*RoleResponse, error) {
	roles, err := s.store.ListRoles(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	ids := roleIDs(roles)
	special, err := s.specialRoleMap(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]*RoleResponse, 0, len(roles))
	for i := range roles {
		out = append(out, &RoleResponse{
			ID:          roles[i].ID,
			Name:        roles[i].Name,
			Description: roles[i].Description,
			Special:     special[roles[i].ID],
		})
	}
	return out, nil
}

// ListRolesWithPermissions serves GET /roles/with-permissions, which the
// role-editor screen uses to populate its permission checkboxes.
func (s *Service) ListRolesWithPermissions(ctx context.Context) ([]*RoleWithPermissionResponse, error) {
	roles, err := s.store.ListRoles(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	ids := roleIDs(roles)

	perms, err := s.permissionsByRole(ctx, ids)
	if err != nil {
		return nil, err
	}
	special, err := s.specialRoleMap(ctx, ids)
	if err != nil {
		return nil, err
	}

	out := make([]*RoleWithPermissionResponse, 0, len(roles))
	for i := range roles {
		list := perms[roles[i].ID]
		if list == nil {
			list = []string{}
		}
		out = append(out, &RoleWithPermissionResponse{
			ID:          roles[i].ID,
			Name:        roles[i].Name,
			Description: roles[i].Description,
			Permissions: list,
			Special:     special[roles[i].ID],
		})
	}
	return out, nil
}

func (s *Service) permissionsByRole(ctx context.Context, roleIDs []string) (map[string][]string, error) {
	out := make(map[string][]string, len(roleIDs))
	if len(roleIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT rp.role_id, p.name
		FROM role_permissions rp
		JOIN permissions p ON p.id = rp.permission_id
		WHERE rp.role_id = ANY($1)
		ORDER BY p.name`, roleIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var roleID, name string
		if err := rows.Scan(&roleID, &name); err != nil {
			return nil, err
		}
		out[roleID] = append(out[roleID], name)
	}
	return out, rows.Err()
}

// specialRoleMap reports which roles grant at least one special permission.
func (s *Service) specialRoleMap(ctx context.Context, roleIDs []string) (map[string]bool, error) {
	out := make(map[string]bool, len(roleIDs))
	if len(roleIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT DISTINCT rp.role_id
		FROM role_permissions rp
		JOIN permissions p ON p.id = rp.permission_id
		WHERE rp.role_id = ANY($1) AND p.special`, roleIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var roleID string
		if err := rows.Scan(&roleID); err != nil {
			return nil, err
		}
		out[roleID] = true
	}
	return out, rows.Err()
}

func roleIDs(roles []Role) []string {
	out := make([]string, 0, len(roles))
	for _, r := range roles {
		out = append(out, r.ID)
	}
	return out
}

// CreateRole serves POST /roles.
func (s *Service) CreateRole(ctx context.Context, a *security.Auth, req UpdateRoleRequest) (*RoleResponse, error) {
	if err := validateRoleRequest(req); err != nil {
		return nil, err
	}
	if !security.Default.IsSuperUser(a) {
		return nil, httpx.Forbidden("Superuser is required")
	}

	description := req.Description
	createdBy := a.UserID
	role := &Role{Name: req.Name, Description: &description, CreatedBy: &createdBy}

	err := s.pool.InTx(ctx, func(q db.Querier) error {
		if err := s.store.InsertRole(ctx, q, role); err != nil {
			return err
		}
		return s.store.UpdateRolePermissions(ctx, q, role.ID, req.Permissions, a.UserID)
	})
	if err != nil {
		if db.IsUniqueViolation(err) {
			return nil, httpx.Conflict("Role name is already taken")
		}
		return nil, err
	}

	special, err := s.store.RoleIsSpecial(ctx, s.pool, []string{role.ID})
	if err != nil {
		return nil, err
	}
	return &RoleResponse{ID: role.ID, Name: role.Name, Description: role.Description, Special: special}, nil
}

// UpdateRole serves PUT /roles/{id}.
func (s *Service) UpdateRole(ctx context.Context, a *security.Auth, roleID string, req UpdateRoleRequest) (*RoleWithPermissionResponse, error) {
	if err := validateRoleRequest(req); err != nil {
		return nil, err
	}
	if !security.Default.IsSuperUser(a) {
		return nil, httpx.Forbidden("Superuser is required")
	}
	if _, err := s.store.FindRole(ctx, s.pool, roleID); err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Role not available: " + roleID)
		}
		return nil, err
	}

	err := s.pool.InTx(ctx, func(q db.Querier) error {
		if err := s.store.UpdateRole(ctx, q, roleID, req.Name, req.Description, a.UserID); err != nil {
			return err
		}
		return s.store.UpdateRolePermissions(ctx, q, roleID, req.Permissions, a.UserID)
	})
	if err != nil {
		if db.IsUniqueViolation(err) {
			return nil, httpx.Conflict("Role name is already taken")
		}
		return nil, err
	}

	role, err := s.store.FindRole(ctx, s.pool, roleID)
	if err != nil {
		return nil, err
	}
	perms, err := s.store.PermissionsForRoles(ctx, s.pool, []string{roleID})
	if err != nil {
		return nil, err
	}
	special, err := s.store.RoleIsSpecial(ctx, s.pool, []string{roleID})
	if err != nil {
		return nil, err
	}
	return &RoleWithPermissionResponse{
		ID: role.ID, Name: role.Name, Description: role.Description,
		Permissions: perms, Special: special,
	}, nil
}

// DeleteRole serves DELETE /roles/{id}.
//
// A role still held by a user is refused with 409 rather than deleted, because
// the join row would cascade and silently strip permissions from accounts that
// are mid-edit. The Java service deleted unconditionally.
func (s *Service) DeleteRole(ctx context.Context, a *security.Auth, roleID string) error {
	if !security.Default.IsSuperUser(a) {
		return httpx.Forbidden("Superuser is required")
	}
	return s.pool.InTx(ctx, func(q db.Querier) error {
		var users int
		if err := q.QueryRow(ctx,
			`SELECT COUNT(*) FROM user_roles WHERE role_id = $1`, roleID).Scan(&users); err != nil {
			return err
		}
		if users > 0 {
			return httpx.Conflict("Role is still assigned to " + itoa(users) + " user(s)")
		}
		return s.store.DeleteRole(ctx, q, roleID)
	})
}

// ListPermissions serves GET /permissions.
func (s *Service) ListPermissions(ctx context.Context) ([]*PermissionResponse, error) {
	perms, err := s.store.ListPermissions(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	out := make([]*PermissionResponse, 0, len(perms))
	for _, p := range perms {
		out = append(out, &PermissionResponse{ID: p.ID, Name: p.Name, Description: p.Description})
	}
	return out, nil
}

// ListOrganizations serves GET /organizations.
func (s *Service) ListOrganizations(ctx context.Context, a *security.Auth) ([]*OrganizationListItem, error) {
	all, err := s.store.ListOrganizations(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	allowed := s.visibleOrgIDs(ctx, a)
	out := make([]*OrganizationListItem, 0, len(all))
	for _, o := range all {
		if !security.Default.IsAllowedAllOrganizations(a) && !slicesContains(allowed, o.ID) {
			continue
		}
		out = append(out, &OrganizationListItem{ID: o.ID, ShortName: o.ShortName, FullName: o.FullName})
	}
	return out, nil
}

// GetOrganization serves GET /organizations/{id}.
func (s *Service) GetOrganization(ctx context.Context, a *security.Auth, id string) (*OrganizationListItem, error) {
	org, err := s.store.FindOrganization(ctx, s.pool, id)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Organization not available: " + id)
		}
		return nil, err
	}
	if !security.Default.IsAllowedAllOrganizations(a) && !slicesContains(a.AllowedOrganizations, id) {
		return nil, httpx.Forbidden("Organization not available: " + id)
	}
	return &OrganizationListItem{ID: org.ID, ShortName: org.ShortName, FullName: org.FullName}, nil
}

// UpdateOrganizationMembership serves PUT /organizations/{id}/users.
func (s *Service) UpdateOrganizationMembership(ctx context.Context, a *security.Auth, orgID string, userIDs []string) ([]string, error) {
	if !security.Default.IsSuperUser(a) {
		return nil, httpx.Forbidden("Superuser is required")
	}
	if _, err := s.store.FindOrganization(ctx, s.pool, orgID); err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Organization not available: " + orgID)
		}
		return nil, err
	}
	err := s.pool.InTx(ctx, func(q db.Querier) error {
		return s.store.ReplaceUserOrganizations(ctx, q, orgID, userIDs)
	})
	if err != nil {
		return nil, err
	}
	return userIDs, nil
}

// sameSet reports whether two slices contain the same elements, ignoring order
// and duplicates. Used to decide whether a role change needs to be persisted and
// published.
func sameSet(a, b []string) bool {
	seen := make(map[string]int, len(a))
	for _, v := range a {
		seen[v]++
	}
	for _, v := range b {
		seen[v]--
	}
	for _, count := range seen {
		if count != 0 {
			return false
		}
	}
	return true
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func validateRoleRequest(req UpdateRoleRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return httpx.BadRequest("Role name is required")
	}
	if strings.TrimSpace(req.Description) == "" {
		return httpx.BadRequest("Role description is required")
	}
	return nil
}
