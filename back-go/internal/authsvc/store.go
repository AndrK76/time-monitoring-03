package authsvc

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
)

const userColumns = `
	u.id, u.username, u.email, u.password, u.first_name, u.last_name, u.display_name,
	u.avatar_url, u.phone_number, u.is_active, u.is_email_verified, u.is_approved,
	u.last_login_at, u.created_at, u.created_by, u.updated_at, u.updated_by`

// Store is the repository layer over the auth schema.
//
// Every method takes a Querier so it can run inside or outside a transaction,
// and the aggregate loaders join explicitly because the Java services ran with
// open-in-view disabled and had to fetch roles, permissions and organizations
// eagerly.
type Store struct {
	pool *db.Pool
}

func NewStore(pool *db.Pool) *Store { return &Store{pool: pool} }

// scanUser reads a user row selected as userColumns.
func scanUser(row pgx.Row) (*User, error) {
	var u User
	var lastLogin, created, updated pgtype.Timestamp
	var createdBy, updatedBy pgtype.Text
	err := row.Scan(
		&u.ID, &u.Username, &u.Email, &u.Password, &u.FirstName, &u.LastName, &u.DisplayName,
		&u.AvatarURL, &u.PhoneNumber, &u.IsActive, &u.IsEmailVerified, &u.IsApproved,
		&lastLogin, &created, &createdBy, &updated, &updatedBy,
	)
	if err != nil {
		return nil, err
	}
	u.LastLoginAt = nullTime(lastLogin)
	u.CreatedAt = nullTime(created)
	u.CreatedBy = nullString(createdBy)
	u.UpdatedAt = nullTime(updated)
	u.UpdatedBy = nullString(updatedBy)
	return &u, nil
}

// nullTime and nullString convert a nullable column into the wire types. They
// take pgtype values rather than pointers: pgx will happily scan a NULL into a
// pointer-to-pointer, but a bare *string or *time.Time destination is treated
// as a non-nullable target and the scan fails with "cannot scan NULL into ...".
// Going through pgtype makes the nullable case explicit, which is what the
// schema needs, since every one of these columns is genuinely NULL for a row
// the migrations seeded. The implementations are shared with service-admin, so
// a change to nullable handling cannot diverge between the two services.
func nullTime(t pgtype.Timestamp) *common.LocalDateTime { return db.NullTime(t) }

func nullString(s pgtype.Text) *string { return db.NullString(s) }

// newID generates a primary key for a row whose id has no database default.
// The Java entities used UUID.randomUUID(), rendered by Postgres as text.
func newID() string { return rabbit.NewUUID() }

// hashOrDefault returns the BCrypt hash of the supplied password, or of the
// configured default when none was given.
//
// The default-password path exists because accounts seeded by the migrations
// (the initial superadmin) have a NULL password and would otherwise be
// unloginable until an admin set one.
func hashOrDefault(req UpdateUserRequest, defaultPassword string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func stringArg(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func timeArg(t *common.LocalDateTime) any {
	if t == nil {
		return nil
	}
	return t.Time
}

func boolArg(b *bool) any {
	if b == nil {
		return nil
	}
	return *b
}

// FindUserByUsername looks up a user by username.
func (s *Store) FindUserByUsername(ctx context.Context, q db.Querier, username string) (*User, error) {
	row := q.QueryRow(ctx, `SELECT `+userColumns+` FROM users u WHERE u.username = $1`, username)
	user, err := scanUser(row)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// FindUserByID looks up a user by id.
func (s *Store) FindUserByID(ctx context.Context, q db.Querier, id string) (*User, error) {
	row := q.QueryRow(ctx, `SELECT `+userColumns+` FROM users u WHERE u.id = $1`, id)
	return scanUser(row)
}

// UsernameExists reports whether a username is taken.
func (s *Store) UsernameExists(ctx context.Context, q db.Querier, username string) (bool, error) {
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	return exists, err
}

// EmailExists reports whether an email is taken by another account.
func (s *Store) EmailExists(ctx context.Context, q db.Querier, email string) (bool, error) {
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists)
	return err == nil && exists, err
}

// InsertUser writes a user and the LOCAL auth-provider row the Java service
// always created alongside it.
func (s *Store) InsertUser(ctx context.Context, q db.Querier, u *User) error {
	var newID string
	err := q.QueryRow(ctx, `
		INSERT INTO users (id, username, email, password, first_name, last_name, display_name,
			avatar_url, phone_number, is_active, is_email_verified, is_approved,
			created_at, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			COALESCE($13, now()), $14, $14)
		RETURNING id`,
		u.ID, u.Username, stringArg(u.Email), stringArg(u.Password),
		stringArg(u.FirstName), stringArg(u.LastName), stringArg(u.DisplayName),
		stringArg(u.AvatarURL), stringArg(u.PhoneNumber),
		u.IsActive, u.IsEmailVerified, u.IsApproved,
		timeArg(u.CreatedAt), stringArg(u.CreatedBy),
	).Scan(&newID)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}
	u.ID = newID

	// A LOCAL provider row was created for every user, with the username as the
	// provider subject. It backs the password-login path and keeps a row for
	// future external-account linking.
	_, err = q.Exec(ctx, `
		INSERT INTO user_auth_providers (id, user_id, provider_name, provider_user_id, provider_email, linked_at)
		VALUES (gen_random_uuid()::text, $1, 'LOCAL', $2, $3, now())
		ON CONFLICT (provider_name, provider_user_id) DO NOTHING`,
		u.ID, u.Username, stringArg(u.Email))
	if err != nil {
		return fmt.Errorf("insert local auth provider: %w", err)
	}
	return nil
}

// UpdatePasswordHash writes a new BCrypt hash and stamps updated_by.
func (s *Store) UpdatePasswordHash(ctx context.Context, q db.Querier, userID, hash, updatedBy string) error {
	_, err := q.Exec(ctx, `UPDATE users SET password = $2, updated_by = $3 WHERE id = $1`, userID, hash, updatedBy)
	return err
}

// UpdatePersonalFields writes the self-service subset: names and email only.
func (s *Store) UpdatePersonalFields(ctx context.Context, q db.Querier, u *User, updaterID string) error {
	_, err := q.Exec(ctx, `
		UPDATE users SET first_name = $2, last_name = $3, display_name = $4, email = $5, updated_by = $6
		WHERE id = $1`,
		u.ID, stringArg(u.FirstName), stringArg(u.LastName), stringArg(u.DisplayName), stringArg(u.Email), updaterID)
	return err
}

// UpdateAllFields writes the full administrative subset. Approval is one-way:
// it is only ever set to true, never revoked, matching the Java behaviour where
// updateAllFields assigned the flag from the request.
func (s *Store) UpdateAllFields(ctx context.Context, q db.Querier, req UpdateUserRequest, userID, updaterID string) error {
	_, err := q.Exec(ctx, `
		UPDATE users SET
			username      = COALESCE(NULLIF($2, ''), username),
			email         = COALESCE(NULLIF($3, ''), email),
			first_name    = COALESCE(NULLIF($4, ''), first_name),
			last_name     = $5,
			display_name  = COALESCE(NULLIF($6, ''), display_name),
			is_active     = COALESCE($7, is_active),
			is_email_verified = COALESCE($8, is_email_verified),
			-- Approval is one-way: the OR keeps a granted approval even when
			-- the request says false, and a request that omits the field
			-- leaves the stored value alone.
			is_approved   = is_approved OR COALESCE($9, FALSE),
			updated_by    = $10
		WHERE id = $1`,
		userID, req.Username, req.Email, req.FirstName, stringArg(req.LastName), req.DisplayName,
		boolArg(req.Active), boolArg(req.EmailVerified), boolArg(req.UserApproved), updaterID)
	return err
}

// TouchUpdatedAt stamps the audit columns, which the database trigger also does;
// being explicit keeps the value visible in the same statement as the update.
func (s *Store) TouchUpdatedAt(ctx context.Context, q db.Querier, table, id, actor string) error {
	_, err := q.Exec(ctx, fmt.Sprintf(
		`UPDATE %s SET updated_at = now(), updated_by = $2 WHERE id = $1`, quoteIdent(table)), id, actor)
	return err
}

// ListRoles returns all roles ordered by name, the ordering the Java findAll
// produced.
func (s *Store) ListRoles(ctx context.Context, q db.Querier) ([]Role, error) {
	rows, err := q.Query(ctx, `SELECT id, name, description, created_at, created_by, updated_at, updated_by FROM roles ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Role
	for rows.Next() {
		var r Role
		var created, updated pgtype.Timestamp
		var createdBy, updatedBy pgtype.Text
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &created, &createdBy, &updated, &updatedBy); err != nil {
			return nil, err
		}
		r.CreatedAt = nullTime(created)
		r.CreatedBy = nullString(createdBy)
		r.UpdatedAt = nullTime(updated)
		r.UpdatedBy = nullString(updatedBy)
		out = append(out, r)
	}
	return out, rows.Err()
}

// ListPermissions returns all permissions ordered by name.
func (s *Store) ListPermissions(ctx context.Context, q db.Querier) ([]Permission, error) {
	rows, err := q.Query(ctx, `SELECT id, name, description, special FROM permissions ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Permission
	for rows.Next() {
		var p Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Special); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// FindRole looks up a role by id.
func (s *Store) FindRole(ctx context.Context, q db.Querier, id string) (*Role, error) {
	var r Role
	var created, updated pgtype.Timestamp
	var createdBy, updatedBy pgtype.Text
	err := q.QueryRow(ctx, `SELECT id, name, description, created_at, created_by, updated_at, updated_by FROM roles WHERE id = $1`, id).
		Scan(&r.ID, &r.Name, &r.Description, &created, &createdBy, &updated, &updatedBy)
	if err != nil {
		return nil, err
	}
	r.CreatedAt = nullTime(created)
	r.CreatedBy = nullString(createdBy)
	r.UpdatedAt = nullTime(updated)
	r.UpdatedBy = nullString(updatedBy)
	return &r, nil
}

// InsertRole creates a role.
func (s *Store) InsertRole(ctx context.Context, q db.Querier, r *Role) error {
	var id string
	err := q.QueryRow(ctx,
		`INSERT INTO roles (id, name, description, created_at, created_by) VALUES ($1, $2, $3, now(), $4) RETURNING id`,
		r.ID, r.Name, stringArg(r.Description), stringArg(r.CreatedBy)).Scan(&id)
	if err != nil {
		return err
	}
	r.ID = id
	return nil
}

// UpdateRole writes a role's name, description and actor.
func (s *Store) UpdateRole(ctx context.Context, q db.Querier, roleID, name, description, actor string) error {
	tag, err := q.Exec(ctx,
		`UPDATE roles SET name = $2, description = $3, updated_at = now(), updated_by = $4 WHERE id = $1`,
		roleID, name, description, actor)
	if err != nil {
		return err
	}
	return requireAffected(tag.RowsAffected(), "role", roleID)
}

// DeleteRole removes a role. The join tables cascade.
func (s *Store) DeleteRole(ctx context.Context, q db.Querier, roleID string) error {
	tag, err := q.Exec(ctx, `DELETE FROM roles WHERE id = $1`, roleID)
	if err != nil {
		return err
	}
	return requireAffected(tag.RowsAffected(), "role", roleID)
}

// RolesForUser returns the roles granted to a user.
func (s *Store) RolesForUser(ctx context.Context, q db.Querier, userID string) ([]Role, error) {
	rows, err := q.Query(ctx, `
		SELECT r.id, r.name, r.description, r.created_at, r.created_by, r.updated_at, r.updated_by
		FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
		ORDER BY r.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Role
	for rows.Next() {
		var r Role
		var created, updated pgtype.Timestamp
		var createdBy, updatedBy pgtype.Text
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &created, &createdBy, &updated, &updatedBy); err != nil {
			return nil, err
		}
		r.CreatedAt = nullTime(created)
		r.CreatedBy = nullString(createdBy)
		r.UpdatedAt = nullTime(updated)
		r.UpdatedBy = nullString(updatedBy)
		out = append(out, r)
	}
	return out, rows.Err()
}

// PermissionsForRoles resolves permission names for a role set, distinct and
// ordered. The Java implementation used flatMap plus distinct.
func (s *Store) PermissionsForRoles(ctx context.Context, q db.Querier, roleIDs []string) ([]string, error) {
	if len(roleIDs) == 0 {
		return []string{}, nil
	}
	rows, err := q.Query(ctx, `
		SELECT DISTINCT p.name
		FROM permissions p
		JOIN role_permissions rp ON rp.permission_id = p.id
		WHERE rp.role_id = ANY($1)
		ORDER BY p.name`, roleIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

// RoleIsSpecial reports whether a role grants any special permission.
func (s *Store) RoleIsSpecial(ctx context.Context, q db.Querier, roleIDs []string) (bool, error) {
	if len(roleIDs) == 0 {
		return false, nil
	}
	var special bool
	err := q.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM permissions p
			JOIN role_permissions rp ON rp.permission_id = p.id
			WHERE rp.role_id = ANY($1) AND p.special
		)`, roleIDs).Scan(&special)
	return special, err
}

// OrganizationsForUser returns the organization ids a user belongs to.
func (s *Store) OrganizationsForUser(ctx context.Context, q db.Querier, userID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT org_id FROM user_organizations WHERE user_id = $1 ORDER BY org_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// OrganizationsForUsers loads organization ids for a batch of users in one
// round trip, keyed by user id.
func (s *Store) OrganizationsForUsers(ctx context.Context, q db.Querier, userIDs []string) (map[string][]string, error) {
	out := make(map[string][]string, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `SELECT user_id, org_id FROM user_organizations WHERE user_id = ANY($1) ORDER BY user_id, org_id`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var userID, orgID string
		if err := rows.Scan(&userID, &orgID); err != nil {
			return nil, err
		}
		out[userID] = append(out[userID], orgID)
	}
	return out, rows.Err()
}

// UserIDsForOrganization lists the members of an organization.
func (s *Store) UserIDsForOrganization(ctx context.Context, q db.Querier, orgID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT user_id FROM user_organizations WHERE org_id = $1 ORDER BY user_id`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// ExistingUserIDs returns the given ids that exist in app_users, in the input
// order. The Java consumer resolved the event's membership through
// getUsersByIds before granting, so an id that is not a real user is silently
// dropped here too.
func (s *Store) ExistingUserIDs(ctx context.Context, q db.Querier, ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := q.Query(ctx, `SELECT id FROM users WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	present := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		present[id] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := []string{}
	for _, id := range ids {
		if present[id] {
			out = append(out, id)
		}
	}
	return out, nil
}

// ListOrganizations returns every organization, unfiltered, ordered by
// short_name. Filtering by the caller's access is a service-layer concern.
func (s *Store) ListOrganizations(ctx context.Context, q db.Querier) ([]Organization, error) {
	rows, err := q.Query(ctx, `SELECT id, short_name, full_name FROM organizations ORDER BY short_name, full_name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Organization
	for rows.Next() {
		var o Organization
		if err := rows.Scan(&o.ID, &o.ShortName, &o.FullName); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// FindOrganization looks up one organization.
func (s *Store) FindOrganization(ctx context.Context, q db.Querier, id string) (*Organization, error) {
	var o Organization
	err := q.QueryRow(ctx, `SELECT id, short_name, full_name FROM organizations WHERE id = $1`, id).
		Scan(&o.ID, &o.ShortName, &o.FullName)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// UpsertOrganization writes the organization row the admin service publishes.
func (s *Store) UpsertOrganization(ctx context.Context, q db.Querier, o Organization) error {
	_, err := q.Exec(ctx, `
		INSERT INTO organizations (id, short_name, full_name) VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET short_name = EXCLUDED.short_name, full_name = EXCLUDED.full_name`,
		o.ID, o.ShortName, o.FullName)
	return err
}

// DeleteOrganization removes the organization row.
func (s *Store) DeleteOrganization(ctx context.Context, q db.Querier, id string) error {
	_, err := q.Exec(ctx, `DELETE FROM organizations WHERE id = $1`, id)
	return err
}

// ReplaceUserOrganizations sets an organization's membership to exactly the
// given user ids.
func (s *Store) ReplaceUserOrganizations(ctx context.Context, q db.Querier, orgID string, userIDs []string) error {
	if _, err := q.Exec(ctx, `DELETE FROM user_organizations WHERE org_id = $1`, orgID); err != nil {
		return err
	}
	if len(userIDs) == 0 {
		return nil
	}
	for _, userID := range userIDs {
		if _, err := q.Exec(ctx,
			`INSERT INTO user_organizations (user_id, org_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			userID, orgID); err != nil {
			return err
		}
	}
	return nil
}

// AddUserToOrganization grants membership, ignoring an existing grant.
func (s *Store) AddUserToOrganization(ctx context.Context, q db.Querier, userID, orgID string) error {
	_, err := q.Exec(ctx,
		`INSERT INTO user_organizations (user_id, org_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, orgID)
	return err
}

// RemoveUserFromOrganization revokes membership.
func (s *Store) RemoveUserFromOrganization(ctx context.Context, q db.Querier, userID, orgID string) error {
	_, err := q.Exec(ctx, `DELETE FROM user_organizations WHERE user_id = $1 AND org_id = $2`, userID, orgID)
	return err
}

// UpdateUserRoles reconciles a user's role set to exactly the given names.
//
// Unknown role names are ignored rather than rejected, which is what the Java
// diff-then-insert did: it resolved names to ids and simply had no rows to
// insert for the ones it did not find.
func (s *Store) UpdateUserRoles(ctx context.Context, q db.Querier, userID string, roleNames []string, actor string) error {
	current, err := s.roleIDsForUser(ctx, q, userID)
	if err != nil {
		return err
	}
	desired, err := s.roleIDsByName(ctx, q, roleNames)
	if err != nil {
		return err
	}

	toAdd := diff(desired, current)
	toRemove := diff(current, desired)

	for _, roleID := range toAdd {
		if _, err := q.Exec(ctx,
			`INSERT INTO user_roles (user_id, role_id, created_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			userID, roleID, actor); err != nil {
			return err
		}
	}
	for _, roleID := range toRemove {
		if _, err := q.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`, userID, roleID); err != nil {
			return err
		}
	}
	return nil
}

// UpdateRolePermissions reconciles a role's permission set to the given names,
// with the same unknown-name tolerance as UpdateUserRoles.
func (s *Store) UpdateRolePermissions(ctx context.Context, q db.Querier, roleID string, permissionNames []string, actor string) error {
	current, err := s.permissionIDsForRole(ctx, q, roleID)
	if err != nil {
		return err
	}
	desired, err := s.permissionIDsByName(ctx, q, permissionNames)
	if err != nil {
		return err
	}

	for _, permID := range diff(desired, current) {
		if _, err := q.Exec(ctx,
			`INSERT INTO role_permissions (role_id, permission_id, created_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			roleID, permID, actor); err != nil {
			return err
		}
	}
	for _, permID := range diff(current, desired) {
		if _, err := q.Exec(ctx, `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`, roleID, permID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) roleIDsForUser(ctx context.Context, q db.Querier, userID string) ([]string, error) {
	return s.collect(ctx, q, `SELECT role_id FROM user_roles WHERE user_id = $1`, userID)
}

func (s *Store) permissionIDsForRole(ctx context.Context, q db.Querier, roleID string) ([]string, error) {
	return s.collect(ctx, q, `SELECT permission_id FROM role_permissions WHERE role_id = $1`, roleID)
}

func (s *Store) roleIDsByName(ctx context.Context, q db.Querier, names []string) ([]string, error) {
	if len(names) == 0 {
		return nil, nil
	}
	return s.collect(ctx, q, `SELECT id FROM roles WHERE name = ANY($1)`, names)
}

func (s *Store) permissionIDsByName(ctx context.Context, q db.Querier, names []string) ([]string, error) {
	if len(names) == 0 {
		return nil, nil
	}
	return s.collect(ctx, q, `SELECT id FROM permissions WHERE name = ANY($1)`, names)
}

func (s *Store) collect(ctx context.Context, q db.Querier, sql string, arg any) ([]string, error) {
	rows, err := q.Query(ctx, sql, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// diff returns the elements of want that are absent from have, preserving
// order. It is the set difference the Java reconciliation performed.
func diff(want, have []string) []string {
	present := make(map[string]struct{}, len(have))
	for _, h := range have {
		present[h] = struct{}{}
	}
	var out []string
	for _, w := range want {
		if _, ok := present[w]; !ok {
			out = append(out, w)
		}
	}
	return out
}

// ListUsers returns every user, ordered by username.
func (s *Store) ListUsers(ctx context.Context, q db.Querier) ([]User, error) {
	rows, err := q.Query(ctx, `SELECT `+userColumns+` FROM users u ORDER BY u.username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

// LoadUserFull assembles the aggregate the token and the user response need.
func (s *Store) LoadUserFull(ctx context.Context, q db.Querier, userID string) (*UserFull, error) {
	user, err := s.FindUserByID(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	full := &UserFull{User: *user}
	if full.Roles, err = s.RolesForUser(ctx, q, userID); err != nil {
		return nil, err
	}
	roleIDs := make([]string, 0, len(full.Roles))
	for _, r := range full.Roles {
		roleIDs = append(roleIDs, r.ID)
	}
	if full.Permissions, err = s.PermissionsForRoles(ctx, q, roleIDs); err != nil {
		return nil, err
	}
	if full.OrganizationIDs, err = s.OrganizationsForUser(ctx, q, userID); err != nil {
		return nil, err
	}
	return full, nil
}

// LoadUserFullByUsername is the login-path aggregate.
func (s *Store) LoadUserFullByUsername(ctx context.Context, q db.Querier, username string) (*UserFull, error) {
	user, err := s.FindUserByUsername(ctx, q, username)
	if err != nil {
		return nil, err
	}
	full := &UserFull{User: *user}
	if full.Roles, err = s.RolesForUser(ctx, q, user.ID); err != nil {
		return nil, err
	}
	roleIDs := make([]string, 0, len(full.Roles))
	for _, r := range full.Roles {
		roleIDs = append(roleIDs, r.ID)
	}
	if full.Permissions, err = s.PermissionsForRoles(ctx, q, roleIDs); err != nil {
		return nil, err
	}
	if full.OrganizationIDs, err = s.OrganizationsForUser(ctx, q, user.ID); err != nil {
		return nil, err
	}
	return full, nil
}

// requireAffected turns a zero-row update or delete into a not-found error.
//
// The Java code called deleteById and updateById on rows that might not exist,
// which surfaced as EmptyResultDataAccessException and a 500. Reporting 404
// instead is one of the deliberate corrections in this port; see MIGRATION.md.
func requireAffected(affected int64, entity, id string) error {
	if affected == 0 {
		return fmt.Errorf("%s %s not found", entity, id)
	}
	return nil
}

func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}
