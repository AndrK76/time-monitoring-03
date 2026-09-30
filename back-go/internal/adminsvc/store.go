package adminsvc

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
)

// Store is the SQL repository for the admin schema.
//
// Every method takes a db.Querier so the caller decides the transaction
// boundary, mirroring the @Transactional annotations of the Java services. The
// Hibernate repositories exposed a dozen narrow finders each; here the same
// ground is covered with a handful of generic queries, parameterised by table
// name, because the crm/evt/img families are near-identical shapes.
type Store struct {
	pool *db.Pool
}

// NewStore builds a repository over the pool.
func NewStore(pool *db.Pool) *Store { return &Store{pool: pool} }

// Pool exposes the underlying pool for the health probe and the bootstrap.
func (s *Store) Pool() *db.Pool { return s.pool }

// agentFamily names the three tables that make up one agent family. The Java
// code had three near-copies of CrmManageService, EvtManageService and
// ImgManageService differing only in the entity types; the differences reduce
// to exactly this set of table names plus the presence of the CRM organization
// link.
type agentFamily struct {
	Agents  string
	Configs string
	// ConfigSubtype is the joined-inheritance child table of Configs, or "" for
	// a family whose configuration has no subclass. All three have one:
	// YClientsAgentConfig, MacroscopEvtAgentConfig and MacroscopImgAgentConfig
	// each extend the abstract base of their family and add their own
	// columns, so Hibernate wrote both rows and a configuration is not
	// readable until both exist.
	ConfigSubtype string
	// ConfigType is the single agent_type value of this family that has a
	// configuration at all. The Java services switched on the agent type and
	// refused anything else, so a Zigbee event agent - a type the picker offers
	// and create accepts - can never be configured.
	ConfigType string
	// ConfigTypeLabel is the word the refusal message uses for this family.
	// The camera service said "Event", copied from its neighbour; see
	// MIGRATION.md.
	ConfigTypeLabel string
	Places          string
	HasCRMOrg       bool
}

var (
	familyCRM = agentFamily{
		Agents: "crm_agents", Configs: "crm_agent_configs", ConfigSubtype: "yc_agent_configs",
		ConfigType: "YClients", ConfigTypeLabel: "CRM",
		Places: "crm_places", HasCRMOrg: true,
	}
	familyEvt = agentFamily{
		Agents: "evt_agents", Configs: "evt_agent_configs", ConfigSubtype: "macroscop_evt_agent_configs",
		ConfigType: "Macroscop", ConfigTypeLabel: "Event",
		Places: "evt_places",
	}
	familyImg = agentFamily{
		Agents: "img_agents", Configs: "img_agent_configs", ConfigSubtype: "macroscop_img_agent_configs",
		ConfigType: "Macroscop", ConfigTypeLabel: "Event",
		Places: "img_places",
	}
)

// newID generates a primary key for a table whose id column has no database
// default, which is every table here: the Java services annotated the entities
// with @GeneratedValue(strategy = UUID) and Hibernate generated the value in
// memory, so the database never saw a default.
func newID() string { return rabbit.NewUUID() }

// ============================================================
// Organizations
// ============================================================

const orgColumns = `id, short_name, full_name, crm_agent_set, events_agents_set, camera_agents_set,
	created_at, created_by, updated_at, updated_by`

func scanOrg(row pgx.Row) (*Organization, error) {
	var o Organization
	var created, updated pgtype.Timestamp
	var createdBy, updatedBy pgtype.Text
	err := row.Scan(&o.ID, &o.ShortName, &o.FullName, &o.CRMAgentSet, &o.EventAgentsSet, &o.CameraAgentsSet,
		&created, &createdBy, &updated, &updatedBy)
	if err != nil {
		return nil, err
	}
	o.CreatedAt = db.NullTime(created)
	o.CreatedBy = db.NullString(createdBy)
	o.UpdatedAt = db.NullTime(updated)
	o.UpdatedBy = db.NullString(updatedBy)
	return &o, nil
}

// FindOrg loads one organization by id.
func (s *Store) FindOrg(ctx context.Context, q db.Querier, id string) (*Organization, error) {
	return scanOrg(q.QueryRow(ctx, `SELECT `+orgColumns+` FROM organizations WHERE id = $1`, id))
}

// ListOrgs loads every organization, ordered by short name case-insensitively.
// The caller applies its own per-user filter and sort, but reading them in
// order lets a stable secondary key be appended without re-sorting.
func (s *Store) ListOrgs(ctx context.Context, q db.Querier) ([]Organization, error) {
	rows, err := q.Query(ctx, `SELECT `+orgColumns+` FROM organizations ORDER BY lower(short_name), id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Organization
	for rows.Next() {
		var o Organization
		var created, updated pgtype.Timestamp
		var createdBy, updatedBy pgtype.Text
		if err := rows.Scan(&o.ID, &o.ShortName, &o.FullName, &o.CRMAgentSet, &o.EventAgentsSet, &o.CameraAgentsSet,
			&created, &createdBy, &updated, &updatedBy); err != nil {
			return nil, err
		}
		o.CreatedAt = db.NullTime(created)
		o.CreatedBy = db.NullString(createdBy)
		o.UpdatedAt = db.NullTime(updated)
		o.UpdatedBy = db.NullString(updatedBy)
		out = append(out, o)
	}
	return out, rows.Err()
}

// InsertOrg writes a new organization. The audit columns are supplied here
// rather than by a database default because the Java entities used
// @CreationTimestamp and @UpdateTimestamp, which the Hibernate listeners filled
// in the application.
func (s *Store) InsertOrg(ctx context.Context, q db.Querier, o *Organization) error {
	now := common.NowLocalDateTime()
	if o.ID == "" {
		o.ID = newID()
	}
	o.CreatedAt = &now
	o.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO organizations (id, short_name, full_name, crm_agent_set, events_agents_set, camera_agents_set,
			created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $8)`,
		o.ID, o.ShortName, o.FullName, o.CRMAgentSet, o.EventAgentsSet, o.CameraAgentsSet,
		now.Time, db.StringValue(o.CreatedBy))
	return err
}

// UpdateOrg persists the names, bumping the audit columns. The three agent flags
// are deliberately not written: Java's org update only ever changed the names,
// and the flags are owned by the agent binding flows.
func (s *Store) UpdateOrg(ctx context.Context, q db.Querier, o *Organization) error {
	now := common.NowLocalDateTime()
	o.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		UPDATE organizations SET short_name = $2, full_name = $3, updated_at = $4, updated_by = $5
		WHERE id = $1`,
		o.ID, o.ShortName, o.FullName, now.Time, db.StringValue(o.UpdatedBy))
	return err
}

// SaveOrgFlags persists only the three agent flags plus the audit columns. This
// is the path the agent binding flows use: CrmAgent#setOrganization and friends
// mutated the flags on a managed entity and the service then saved it, which is
// what actually made the flag change durable.
func (s *Store) SaveOrgFlags(ctx context.Context, q db.Querier, o *Organization) error {
	now := common.NowLocalDateTime()
	o.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		UPDATE organizations
		SET crm_agent_set = $2, events_agents_set = $3, camera_agents_set = $4, updated_at = $5, updated_by = $6
		WHERE id = $1`,
		o.ID, o.CRMAgentSet, o.EventAgentsSet, o.CameraAgentsSet, now.Time, db.StringValue(o.UpdatedBy))
	return err
}

// DeleteOrg removes an organization. Agent rows referencing it are nulled by the
// ON DELETE SET NULL foreign keys, so no explicit cleanup is needed.
func (s *Store) DeleteOrg(ctx context.Context, q db.Querier, id string) (bool, error) {
	tag, err := q.Exec(ctx, `DELETE FROM organizations WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

// OrgUserIDs returns the member user ids, in a deterministic order. The Java
// service iterated a Set, whose order was the hash order, and published that
// straight into the event; ordering by id makes the payload reproducible.
func (s *Store) OrgUserIDs(ctx context.Context, q db.Querier, orgID string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT user_id FROM user_organizations WHERE organization_id = $1 ORDER BY user_id`, orgID)
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

// ReplaceOrgUsers sets the membership to exactly the given user ids and returns
// the resulting list. Java assigned a whole new Set to the managed collection
// and let the dirty checking flush the difference; a delete-then-insert is the
// same effect.
//
// The join table is cleared first because org.members had no way to express
// "add one" or "remove one": the service either replaced the whole set or left
// it alone.
func (s *Store) ReplaceOrgUsers(ctx context.Context, q db.Querier, orgID string, userIDs []string, actor *string) error {
	if _, err := q.Exec(ctx, `DELETE FROM user_organizations WHERE organization_id = $1`, orgID); err != nil {
		return err
	}
	now := common.NowLocalDateTime()
	for _, uid := range userIDs {
		if _, err := q.Exec(ctx, `
			INSERT INTO user_organizations (id, organization_id, user_id, created_at, created_by)
			VALUES ($1, $2, $3, $4, $5)`,
			newID(), orgID, uid, now.Time, db.StringValue(actor)); err != nil {
			return err
		}
	}
	return nil
}

// ============================================================
// Users
// ============================================================

const userColumns = `id, username, display_name, is_valid, roles`

func scanUser(row pgx.Row) (*AppUser, error) {
	var u AppUser
	var displayName, roles pgtype.Text
	var valid pgtype.Bool
	err := row.Scan(&u.ID, &u.Username, &displayName, &valid, &roles)
	if err != nil {
		return nil, err
	}
	u.DisplayName = db.NullString(displayName)
	u.Valid = valid.Valid && valid.Bool
	u.Roles = db.NullString(roles)
	return &u, nil
}

// ListUsers loads every mirrored user, ordered by username.
func (s *Store) ListUsers(ctx context.Context, q db.Querier) ([]AppUser, error) {
	rows, err := q.Query(ctx, `SELECT `+userColumns+` FROM app_users ORDER BY lower(username), id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AppUser
	for rows.Next() {
		var u AppUser
		var displayName, roles pgtype.Text
		var valid pgtype.Bool
		if err := rows.Scan(&u.ID, &u.Username, &displayName, &valid, &roles); err != nil {
			return nil, err
		}
		u.DisplayName = db.NullString(displayName)
		u.Valid = valid.Valid && valid.Bool
		u.Roles = db.NullString(roles)
		out = append(out, u)
	}
	return out, rows.Err()
}

// UserOrgs maps each of the given user ids to the organizations they belong to.
func (s *Store) UserOrgs(ctx context.Context, q db.Querier, userIDs []string) (map[string][]string, error) {
	out := map[string][]string{}
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT user_id, organization_id FROM user_organizations
		WHERE user_id IN (`+db.BuildPlaceholders(1, len(userIDs))+`)
		ORDER BY user_id, organization_id`, toAny(userIDs)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var uid, oid string
		if err := rows.Scan(&uid, &oid); err != nil {
			return nil, err
		}
		out[uid] = append(out[uid], oid)
	}
	return out, rows.Err()
}

// FindUser loads one mirrored user.
//
// A missing row is reported as a nil user and a nil error rather than as
// pgx.ErrNoRows, because every caller asks "does the mirror know this user yet"
// and treats the answer the same way.
func (s *Store) FindUser(ctx context.Context, q db.Querier, id string) (*AppUser, error) {
	row := q.QueryRow(ctx, `SELECT `+userColumns+` FROM app_users WHERE id = $1`, id)
	u, err := scanUser(row)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	return u, nil
}

// UpsertUser writes the mirror row for a service-auth user event.
//
// The Java service called save() on a detached entity when the id was unknown,
// which is an insert, and mutated the managed entity otherwise. The upsert here
// is the same outcome, and additionally refreshes the columns the update path
// could leave stale: EventCommandMapper#fromChangeEvent always populated every
// field, so a partial update still overwrote the rest.
func (s *Store) UpsertUser(ctx context.Context, q db.Querier, u *AppUser) error {
	_, err := q.Exec(ctx, `
		INSERT INTO app_users (id, username, display_name, is_valid, roles)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE
		SET username = EXCLUDED.username,
		    display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
		    is_valid = EXCLUDED.is_valid,
		    roles = COALESCE(EXCLUDED.roles, app_users.roles)`,
		u.ID, u.Username, db.StringValue(u.DisplayName), u.Valid, db.StringValue(u.Roles))
	return err
}

// ============================================================
// Agents
// ============================================================

// agentColumns builds the projection for one family, appending the CRM
// organization link only for the family that has the column.
func (f agentFamily) agentColumns() string {
	if f.HasCRMOrg {
		return `id, type_discriminator, organization_id, agent_type, name, description, is_configured,
			crm_organization_id, created_at, created_by, updated_at, updated_by`
	}
	return `id, type_discriminator, organization_id, agent_type, name, description, is_configured,
		created_at, created_by, updated_at, updated_by`
}

func (f agentFamily) scanAgent(row pgx.Row) (*Agent, error) {
	var a Agent
	var organizationID, description, crmOrgID, createdBy, updatedBy pgtype.Text
	var created, updated pgtype.Timestamp
	var dest = []any{&a.ID, &a.Discriminator, &organizationID, &a.AgentType, &a.Name, &description, &a.Configured}
	if f.HasCRMOrg {
		dest = append(dest, &crmOrgID)
	}
	dest = append(dest, &created, &createdBy, &updated, &updatedBy)
	if err := row.Scan(dest...); err != nil {
		return nil, err
	}
	a.OrganizationID = db.NullString(organizationID)
	a.Description = db.NullString(description)
	a.CRMOrganizationID = db.NullString(crmOrgID)
	a.CreatedAt = db.NullTime(created)
	a.CreatedBy = db.NullString(createdBy)
	a.UpdatedAt = db.NullTime(updated)
	a.UpdatedBy = db.NullString(updatedBy)
	return &a, nil
}

func (f agentFamily) scanAgentRows(rows pgx.Rows) ([]Agent, error) {
	defer rows.Close()
	out := []Agent{}
	for rows.Next() {
		a, err := f.scanAgent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

// ListAgents loads every agent of the family.
func (s *Store) ListAgents(ctx context.Context, q db.Querier, f agentFamily) ([]Agent, error) {
	rows, err := q.Query(ctx, `SELECT `+f.agentColumns()+` FROM `+f.Agents)
	if err != nil {
		return nil, err
	}
	return f.scanAgentRows(rows)
}

// ListAgentsByOrg loads the agents bound to one organization.
func (s *Store) ListAgentsByOrg(ctx context.Context, q db.Querier, f agentFamily, orgID string) ([]Agent, error) {
	rows, err := q.Query(ctx, `SELECT `+f.agentColumns()+` FROM `+f.Agents+` WHERE organization_id = $1`, orgID)
	if err != nil {
		return nil, err
	}
	return f.scanAgentRows(rows)
}

// FindAgent loads one agent by id.
func (s *Store) FindAgent(ctx context.Context, q db.Querier, f agentFamily, id string) (*Agent, error) {
	return f.scanAgent(q.QueryRow(ctx, `SELECT `+f.agentColumns()+` FROM `+f.Agents+` WHERE id = $1`, id))
}

// InsertAgent writes a new agent row. The discriminator names the concrete
// subclass; the column is NOT NULL and the joined-subtype tables depend on it.
func (s *Store) InsertAgent(ctx context.Context, q db.Querier, f agentFamily, a *Agent) error {
	now := common.NowLocalDateTime()
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = &now
	a.UpdatedAt = &now
	if f.HasCRMOrg {
		_, err := q.Exec(ctx, `
			INSERT INTO `+f.Agents+` (id, type_discriminator, organization_id, agent_type, name, description,
				is_configured, crm_organization_id, created_at, created_by, updated_at, updated_by)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10)`,
			a.ID, a.Discriminator, db.StringValue(a.OrganizationID), a.AgentType, a.Name, db.StringValue(a.Description),
			a.Configured, db.StringValue(a.CRMOrganizationID), now.Time, db.StringValue(a.CreatedBy))
		return err
	}
	_, err := q.Exec(ctx, `
		INSERT INTO `+f.Agents+` (id, type_discriminator, organization_id, agent_type, name, description,
			is_configured, created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9)`,
		a.ID, a.Discriminator, db.StringValue(a.OrganizationID), a.AgentType, a.Name, db.StringValue(a.Description),
		a.Configured, now.Time, db.StringValue(a.CreatedBy))
	return err
}

// UpdateAgent persists an agent row. The organization link is written
// unconditionally: clearing it is how unbind is expressed.
func (s *Store) UpdateAgent(ctx context.Context, q db.Querier, f agentFamily, a *Agent) error {
	now := common.NowLocalDateTime()
	a.UpdatedAt = &now
	if f.HasCRMOrg {
		_, err := q.Exec(ctx, `
			UPDATE `+f.Agents+` SET organization_id = $2, agent_type = $3, name = $4, description = $5,
				is_configured = $6, crm_organization_id = $7, updated_at = $8, updated_by = $9
			WHERE id = $1`,
			a.ID, db.StringValue(a.OrganizationID), a.AgentType, a.Name, db.StringValue(a.Description),
			a.Configured, db.StringValue(a.CRMOrganizationID), now.Time, db.StringValue(a.UpdatedBy))
		return err
	}
	_, err := q.Exec(ctx, `
		UPDATE `+f.Agents+` SET organization_id = $2, agent_type = $3, name = $4, description = $5,
			is_configured = $6, updated_at = $7, updated_by = $8
		WHERE id = $1`,
		a.ID, db.StringValue(a.OrganizationID), a.AgentType, a.Name, db.StringValue(a.Description),
		a.Configured, now.Time, db.StringValue(a.UpdatedBy))
	return err
}

// DeleteAgent removes an agent row and reports whether it existed. The Java
// service called deleteById unconditionally, which raised for a missing id and
// surfaced as a 500; reporting the miss lets the caller answer 404.
func (s *Store) DeleteAgent(ctx context.Context, q db.Querier, f agentFamily, id string) (bool, error) {
	tag, err := q.Exec(ctx, `DELETE FROM `+f.Agents+` WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

// ClearOrgAgents unbinds every agent of the family from one organization. The
// agents themselves are kept: organization_id is the only thing that changes.
// Java did the same through the loaded collection, but as an explicit
// statement this also covers agents the caller had not loaded.
func (s *Store) ClearOrgAgents(ctx context.Context, q db.Querier, f agentFamily, orgID string) error {
	now := common.NowLocalDateTime()
	_, err := q.Exec(ctx, `UPDATE `+f.Agents+` SET organization_id = NULL, updated_at = $2 WHERE organization_id = $1`, orgID, now.Time)
	return err
}

// ============================================================
// Agent configs (the subtype row that marks an agent configured)
// ============================================================

const agentConfigColumns = `id, created_at, created_by, updated_at, updated_by`

// FindAgentConfig loads the subtype config row of an agent.
func (s *Store) FindAgentConfig(ctx context.Context, q db.Querier, f agentFamily, id string) (*AgentConfig, error) {
	var c AgentConfig
	var created, updated pgtype.Timestamp
	var createdBy, updatedBy pgtype.Text
	err := q.QueryRow(ctx, `SELECT `+agentConfigColumns+` FROM `+f.Configs+` WHERE id = $1`, id).
		Scan(&c.ID, &created, &createdBy, &updated, &updatedBy)
	if err != nil {
		return nil, err
	}
	c.CreatedAt = db.NullTime(created)
	c.CreatedBy = db.NullString(createdBy)
	c.UpdatedAt = db.NullTime(updated)
	c.UpdatedBy = db.NullString(updatedBy)
	return &c, nil
}

// TouchAgentConfig stamps updated_by/updated_at on an existing config row.
func (s *Store) TouchAgentConfig(ctx context.Context, q db.Querier, f agentFamily, id string, actor *string) error {
	now := common.NowLocalDateTime()
	_, err := q.Exec(ctx, `UPDATE `+f.Configs+` SET updated_at = $2, updated_by = $3 WHERE id = $1`, id, now.Time, db.StringValue(actor))
	return err
}

// ============================================================
// CRM organizations, services, places
// ============================================================

const crmOrgColumns = `id, type_discriminator, yc_id, yc_name, yc_tz, created_at, created_by, updated_at, updated_by`

func scanCRMOrg(row pgx.Row) (*CRMOrganization, error) {
	var o CRMOrganization
	var ycID pgtype.Int8
	var ycName, ycTZ, createdBy, updatedBy pgtype.Text
	var created, updated pgtype.Timestamp
	err := row.Scan(&o.ID, &o.Discriminator, &ycID, &ycName, &ycTZ, &created, &createdBy, &updated, &updatedBy)
	if err != nil {
		return nil, err
	}
	o.YcID = db.NullInt64(ycID)
	o.YcName = db.NullString(ycName)
	o.YcTZ = db.NullString(ycTZ)
	o.CreatedAt = db.NullTime(created)
	o.CreatedBy = db.NullString(createdBy)
	o.UpdatedAt = db.NullTime(updated)
	o.UpdatedBy = db.NullString(updatedBy)
	return &o, nil
}

// FindCRMOrg loads a CRM organization by id.
func (s *Store) FindCRMOrg(ctx context.Context, q db.Querier, id string) (*CRMOrganization, error) {
	return scanCRMOrg(q.QueryRow(ctx, `SELECT `+crmOrgColumns+` FROM crm_organizations WHERE id = $1`, id))
}

// FindCRMOrgByYcID resolves the local row for an external YClients company id.
func (s *Store) FindCRMOrgByYcID(ctx context.Context, q db.Querier, ycID int64) (*CRMOrganization, error) {
	return scanCRMOrg(q.QueryRow(ctx, `SELECT `+crmOrgColumns+` FROM crm_organizations WHERE yc_id = $1`, ycID))
}

// InsertCRMOrg writes a CRM organization row.
func (s *Store) InsertCRMOrg(ctx context.Context, q db.Querier, o *CRMOrganization) error {
	now := common.NowLocalDateTime()
	if o.ID == "" {
		o.ID = newID()
	}
	o.CreatedAt = &now
	o.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO crm_organizations (id, type_discriminator, yc_id, yc_name, yc_tz,
			created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7)`,
		o.ID, o.Discriminator, db.Int64Value(o.YcID), db.StringValue(o.YcName), db.StringValue(o.YcTZ),
		now.Time, db.StringValue(o.CreatedBy))
	return err
}

// UpdateCRMOrg persists the mutable fields of a CRM organization.
func (s *Store) UpdateCRMOrg(ctx context.Context, q db.Querier, o *CRMOrganization) error {
	now := common.NowLocalDateTime()
	o.UpdatedAt = &now
	// yc_id is the external company id and is set once, on the first
	// organization write; it is written unconditionally here because a null in
	// the entity means "not chosen yet" rather than "clear it".
	_, err := q.Exec(ctx, `
		UPDATE crm_organizations
		SET yc_id = COALESCE($2, yc_id), yc_name = $3, yc_tz = $4, updated_at = $5, updated_by = $6
		WHERE id = $1`,
		o.ID, db.Int64Value(o.YcID), db.StringValue(o.YcName), db.StringValue(o.YcTZ),
		now.Time, db.StringValue(o.UpdatedBy))
	return err
}

// DeleteCRMOrg removes a CRM organization row.
func (s *Store) DeleteCRMOrg(ctx context.Context, q db.Querier, id string) (bool, error) {
	tag, err := q.Exec(ctx, `DELETE FROM crm_organizations WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

const crmServiceColumns = `id, type_discriminator, name, agent_id, yc_id, yc_name, service_category_id,
	created_at, created_by, updated_at, updated_by`

// ListCRMServicesForAgent loads the services registered for one CRM agent.
func (s *Store) ListCRMServicesForAgent(ctx context.Context, q db.Querier, agentID string) ([]CRMService, error) {
	rows, err := q.Query(ctx, `SELECT `+crmServiceColumns+` FROM crm_services WHERE agent_id = $1 ORDER BY yc_id`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CRMService{}
	for rows.Next() {
		v, err := scanCRMService(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

func scanCRMService(row pgx.Row) (*CRMService, error) {
	var v CRMService
	var agentID, ycName, createdBy, updatedBy pgtype.Text
	var catID pgtype.Int8
	var created, updated pgtype.Timestamp
	if err := row.Scan(&v.ID, &v.Discriminator, &v.Name, &agentID, &v.YcID, &ycName, &catID,
		&created, &createdBy, &updated, &updatedBy); err != nil {
		return nil, err
	}
	v.AgentID = db.NullString(agentID)
	v.YcName = db.NullString(ycName)
	v.ServiceCategoryID = db.NullInt64(catID)
	v.CreatedAt = db.NullTime(created)
	v.CreatedBy = db.NullString(createdBy)
	v.UpdatedAt = db.NullTime(updated)
	v.UpdatedBy = db.NullString(updatedBy)
	return &v, nil
}

// FindCRMService loads one service row by id.
func (s *Store) FindCRMService(ctx context.Context, q db.Querier, id string) (*CRMService, error) {
	return scanCRMService(q.QueryRow(ctx, `SELECT `+crmServiceColumns+` FROM crm_services WHERE id = $1`, id))
}

// InsertCRMService writes a service row.
func (s *Store) InsertCRMService(ctx context.Context, q db.Querier, v *CRMService) error {
	now := common.NowLocalDateTime()
	if v.ID == "" {
		v.ID = newID()
	}
	v.CreatedAt = &now
	v.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO crm_services (id, type_discriminator, name, agent_id, yc_id, yc_name, service_category_id,
			created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9)`,
		v.ID, v.Discriminator, v.Name, db.StringValue(v.AgentID), v.YcID, db.StringValue(v.YcName),
		db.Int64Value(v.ServiceCategoryID), now.Time, db.StringValue(v.CreatedBy))
	return err
}

// DeleteCRMService removes a service row and reports whether it existed.
func (s *Store) DeleteCRMService(ctx context.Context, q db.Querier, id string) (bool, error) {
	tag, err := q.Exec(ctx, `DELETE FROM crm_services WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

const crmPlaceColumns = `id, type_discriminator, name, organization_id, yc_id, yc_name, available,
	created_at, created_by, updated_at, updated_by`

func scanCRMPlace(row pgx.Row) (*CRMPlace, error) {
	var p CRMPlace
	var orgID, ycName, createdBy, updatedBy pgtype.Text
	var created, updated pgtype.Timestamp
	if err := row.Scan(&p.ID, &p.Discriminator, &p.Name, &orgID, &p.YcID, &ycName, &p.Available,
		&created, &createdBy, &updated, &updatedBy); err != nil {
		return nil, err
	}
	p.OrganizationID = db.NullString(orgID)
	p.YcName = db.NullString(ycName)
	p.CreatedAt = db.NullTime(created)
	p.CreatedBy = db.NullString(createdBy)
	p.UpdatedAt = db.NullTime(updated)
	p.UpdatedBy = db.NullString(updatedBy)
	return &p, nil
}

// ListCRMPlacesForOrg loads the places attached to a CRM organization.
func (s *Store) ListCRMPlacesForOrg(ctx context.Context, q db.Querier, orgID string) ([]CRMPlace, error) {
	rows, err := q.Query(ctx, `SELECT `+crmPlaceColumns+` FROM crm_places WHERE organization_id = $1 ORDER BY yc_id`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CRMPlace{}
	for rows.Next() {
		v, err := scanCRMPlace(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

// FindCRMPlace loads one place row by id.
func (s *Store) FindCRMPlace(ctx context.Context, q db.Querier, id string) (*CRMPlace, error) {
	return scanCRMPlace(q.QueryRow(ctx, `SELECT `+crmPlaceColumns+` FROM crm_places WHERE id = $1`, id))
}

// InsertCRMPlace writes a place row.
func (s *Store) InsertCRMPlace(ctx context.Context, q db.Querier, p *CRMPlace) error {
	now := common.NowLocalDateTime()
	if p.ID == "" {
		p.ID = newID()
	}
	p.CreatedAt = &now
	p.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO crm_places (id, type_discriminator, name, organization_id, yc_id, yc_name, available,
			created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9)`,
		p.ID, p.Discriminator, p.Name, db.StringValue(p.OrganizationID), p.YcID, db.StringValue(p.YcName),
		p.Available, now.Time, db.StringValue(p.CreatedBy))
	return err
}

// DeleteCRMPlace removes a place row and reports whether it existed.
func (s *Store) DeleteCRMPlace(ctx context.Context, q db.Querier, id string) (bool, error) {
	tag, err := q.Exec(ctx, `DELETE FROM crm_places WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

const ycCategoryColumns = `yc_id, yc_name, agent_id, organization_id, created_at, created_by, updated_at, updated_by`

// ListYCCategoriesForAgent loads the service categories registered for a CRM agent.
func (s *Store) ListYCCategoriesForAgent(ctx context.Context, q db.Querier, agentID string) ([]YCServiceCategory, error) {
	rows, err := q.Query(ctx, `SELECT `+ycCategoryColumns+` FROM yc_service_categories WHERE agent_id = $1 ORDER BY yc_id`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []YCServiceCategory{}
	for rows.Next() {
		v, err := scanYCCategory(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

func scanYCCategory(row pgx.Row) (*YCServiceCategory, error) {
	var c YCServiceCategory
	var ycName, agentID, orgID, createdBy, updatedBy pgtype.Text
	var created, updated pgtype.Timestamp
	if err := row.Scan(&c.YcID, &ycName, &agentID, &orgID, &created, &createdBy, &updated, &updatedBy); err != nil {
		return nil, err
	}
	c.YcName = db.NullString(ycName)
	c.AgentID = db.NullString(agentID)
	c.OrganizationID = db.NullString(orgID)
	c.CreatedAt = db.NullTime(created)
	c.CreatedBy = db.NullString(createdBy)
	c.UpdatedAt = db.NullTime(updated)
	c.UpdatedBy = db.NullString(updatedBy)
	return &c, nil
}

// FindYCCategory loads one category by its external id.
func (s *Store) FindYCCategory(ctx context.Context, q db.Querier, ycID int64) (*YCServiceCategory, error) {
	return scanYCCategory(q.QueryRow(ctx, `SELECT `+ycCategoryColumns+` FROM yc_service_categories WHERE yc_id = $1`, ycID))
}

// UpsertYCCategory writes a category row, refreshing the mutable columns.
func (s *Store) UpsertYCCategory(ctx context.Context, q db.Querier, c *YCServiceCategory) error {
	now := common.NowLocalDateTime()
	c.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO yc_service_categories (yc_id, yc_name, agent_id, organization_id, created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $5, $6)
		ON CONFLICT (yc_id) DO UPDATE
		SET yc_name = EXCLUDED.yc_name, agent_id = EXCLUDED.agent_id, organization_id = EXCLUDED.organization_id,
		    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
		c.YcID, db.StringValue(c.YcName), db.StringValue(c.AgentID), db.StringValue(c.OrganizationID),
		now.Time, db.StringValue(c.CreatedBy))
	return err
}

// DeleteYCCategory removes a category row and reports whether it existed.
func (s *Store) DeleteYCCategory(ctx context.Context, q db.Querier, ycID int64) (bool, error) {
	tag, err := q.Exec(ctx, `DELETE FROM yc_service_categories WHERE yc_id = $1`, ycID)
	return tag.RowsAffected() > 0, err
}

// ============================================================
// YClients agent config
// ============================================================

// YCAgentConfig mirrors yc_agent_configs. Tokens are stored XOR-masked, as they
// were in the Java entity through its @PostLoad/@PrePersist credential hooks.
type YCAgentConfig struct {
	ID           string
	PartnerToken *string
	UserToken    *string
	CreatedAt    *common.LocalDateTime
	CreatedBy    *string
	UpdatedAt    *common.LocalDateTime
	UpdatedBy    *string
}

// FindYCConfig loads the YClients credential row of an agent.
//
// The tokens live in the joined subtype table and the audit columns in the
// parent, which is how the Java entities were mapped: YClientsAgentConfig
// extends CrmAgentConfig and adds only the credential pair. The read therefore
// joins, or a row created before the subtype existed would come back with no
// audit and look unconfigured.
func (s *Store) FindYCConfig(ctx context.Context, q db.Querier, id string) (*YCAgentConfig, error) {
	var c YCAgentConfig
	var partner, user, createdBy, updatedBy pgtype.Text
	var created, updated pgtype.Timestamp
	err := q.QueryRow(ctx, `
		SELECT y.id, y.partner_token, y.user_token,
		       a.created_at, a.created_by, a.updated_at, a.updated_by
		FROM yc_agent_configs y
		JOIN crm_agent_configs a ON a.id = y.id
		WHERE y.id = $1`, id).
		Scan(&c.ID, &partner, &user, &created, &createdBy, &updated, &updatedBy)
	if err != nil {
		return nil, err
	}
	c.PartnerToken = db.NullString(partner)
	c.UserToken = db.NullString(user)
	c.CreatedAt = db.NullTime(created)
	c.CreatedBy = db.NullString(createdBy)
	c.UpdatedAt = db.NullTime(updated)
	c.UpdatedBy = db.NullString(updatedBy)
	return &c, nil
}

// UpsertYCConfig writes the YClients credential row and the audit it inherits.
//
// The parent row is created if it is missing, because the foreign key from
// yc_agent_configs would otherwise reject the token row and a configuration set
// before its agent would fail rather than heal.
func (s *Store) UpsertYCConfig(ctx context.Context, q db.Querier, c *YCAgentConfig) error {
	now := common.NowLocalDateTime()
	if _, err := q.Exec(ctx, `
		INSERT INTO crm_agent_configs (id, created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
		c.ID, now.Time, db.StringValue(c.UpdatedBy)); err != nil {
		return err
	}
	_, err := q.Exec(ctx, `
		INSERT INTO yc_agent_configs (id, partner_token, user_token)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET partner_token = EXCLUDED.partner_token, user_token = EXCLUDED.user_token`,
		c.ID, db.StringValue(c.PartnerToken), db.StringValue(c.UserToken))
	return err
}

// ============================================================
// Macroscop
// ============================================================

const macroscopConfigColumns = `id, name, address, login, password, server_id, server_version,
	info_response_time, server_tz, server_use_tz, created_at, created_by, updated_at, updated_by`

func scanMacroscopConfig(row pgx.Row) (*MacroscopConfig, error) {
	var c MacroscopConfig
	var address, login, password, serverID, serverVersion, serverTZ, createdBy, updatedBy pgtype.Text
	var infoResponse pgtype.Timestamptz
	var useTZ pgtype.Bool
	var created, updated pgtype.Timestamp
	err := row.Scan(&c.ID, &c.Name, &address, &login, &password, &serverID, &serverVersion,
		&infoResponse, &serverTZ, &useTZ, &created, &createdBy, &updated, &updatedBy)
	if err != nil {
		return nil, err
	}
	c.ServerAddress = db.NullString(address)
	c.Login = db.NullString(login)
	c.Password = db.NullString(password)
	c.ServerID = db.NullString(serverID)
	c.ServerVersion = db.NullString(serverVersion)
	c.InfoResponseTime = db.NullOffsetTime(infoResponse)
	c.ServerTZ = db.NullString(serverTZ)
	c.ServerUseTZ = db.NullBool(useTZ)
	c.CreatedAt = db.NullTime(created)
	c.CreatedBy = db.NullString(createdBy)
	c.UpdatedAt = db.NullTime(updated)
	c.UpdatedBy = db.NullString(updatedBy)
	return &c, nil
}

// FindMacroscopConfig loads a Macroscop server configuration by id.
func (s *Store) FindMacroscopConfig(ctx context.Context, q db.Querier, id string) (*MacroscopConfig, error) {
	return scanMacroscopConfig(q.QueryRow(ctx, `SELECT `+macroscopConfigColumns+` FROM macroscop_agent_configs WHERE id = $1`, id))
}

// UpdateMacroscopConfig writes the mutable columns of a Macroscop configuration.
//
// serverAddress is written unconditionally and the credentials only when present,
// mirroring MacroscopManageService._updateStoredConfig: a request that omitted the
// server address was expected to blank it, while omitted credentials meant "keep
// what is stored". serverInfo is merged field by field for the same reason.
func (s *Store) UpdateMacroscopConfig(ctx context.Context, q db.Querier, c *MacroscopConfig) error {
	now := common.NowLocalDateTime()
	c.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		UPDATE macroscop_agent_configs
		SET name = $2, address = $3, login = $4, password = $5, updated_at = $6, updated_by = $7
		WHERE id = $1`,
		c.ID, c.Name, db.StringValue(c.ServerAddress), db.StringValue(c.Login), db.StringValue(c.Password),
		now.Time, db.StringValue(c.UpdatedBy))
	return err
}

// MergeMacroscopServerInfo writes the server-info embeddable, leaving untouched
// the fields the response did not carry.
func (s *Store) MergeMacroscopServerInfo(ctx context.Context, q db.Querier, c *MacroscopConfig) error {
	now := common.NowLocalDateTime()
	c.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		UPDATE macroscop_agent_configs
		SET server_id = $2, server_version = $3, info_response_time = $4, server_tz = $5, server_use_tz = $6,
		    updated_at = $7, updated_by = $8
		WHERE id = $1`,
		c.ID, db.StringValue(c.ServerID), db.StringValue(c.ServerVersion), db.OffsetTimeValue(c.InfoResponseTime),
		db.StringValue(c.ServerTZ), db.BoolValue(c.ServerUseTZ), now.Time, db.StringValue(c.UpdatedBy))
	return err
}

// InsertMacroscopConfig writes a new Macroscop configuration.
func (s *Store) InsertMacroscopConfig(ctx context.Context, q db.Querier, c *MacroscopConfig) error {
	now := common.NowLocalDateTime()
	if c.ID == "" {
		c.ID = newID()
	}
	c.CreatedAt = &now
	c.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO macroscop_agent_configs
			(id, name, address, login, password, server_id, server_version, info_response_time,
			 server_tz, server_use_tz, created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $11, $12)`,
		c.ID, c.Name, db.StringValue(c.ServerAddress), db.StringValue(c.Login), db.StringValue(c.Password),
		db.StringValue(c.ServerID), db.StringValue(c.ServerVersion), db.OffsetTimeValue(c.InfoResponseTime),
		db.StringValue(c.ServerTZ), db.BoolValue(c.ServerUseTZ), now.Time, db.StringValue(c.CreatedBy))
	return err
}

// DeleteMacroscopConfig removes a Macroscop configuration and its channel rows.
// Java called deleteById on the repository and let the cascade in the mapping do
// the rest; the channels reference the config by id, so they are removed here
// explicitly to keep the delete order valid.
func (s *Store) DeleteMacroscopConfig(ctx context.Context, q db.Querier, id string) (bool, error) {
	if _, err := q.Exec(ctx, `DELETE FROM macroscop_agent_channels WHERE config_id = $1`, id); err != nil {
		return false, err
	}
	tag, err := q.Exec(ctx, `DELETE FROM macroscop_agent_configs WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

// macroscopLinkTable names the bridge table that attaches a Macroscop server
// configuration to an agent of one family. The row id is the agent id, and
// config_id is the Macroscop configuration.
func macroscopLinkTable(f agentFamily) string {
	switch f.Agents {
	case familyEvt.Agents:
		return "macroscop_evt_agent_configs"
	case familyImg.Agents:
		return "macroscop_img_agent_configs"
	}
	return ""
}

// FindMacroscopLink returns the Macroscop configuration id bound to an agent.
func (s *Store) FindMacroscopLink(ctx context.Context, q db.Querier, f agentFamily, agentID string) (string, error) {
	var cfgID pgtype.Text
	err := q.QueryRow(ctx, `SELECT config_id FROM `+macroscopLinkTable(f)+` WHERE id = $1`, agentID).Scan(&cfgID)
	if err != nil {
		return "", err
	}
	return deref(db.NullString(cfgID)), nil
}

// SetMacroscopLink binds a Macroscop configuration to an agent.
func (s *Store) SetMacroscopLink(ctx context.Context, q db.Querier, f agentFamily, agentID, configID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO `+macroscopLinkTable(f)+` (id, config_id) VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE SET config_id = EXCLUDED.config_id`, agentID, configID)
	return err
}

// ClearMacroscopLink detaches whatever configuration an agent had.
func (s *Store) ClearMacroscopLink(ctx context.Context, q db.Querier, f agentFamily, agentID string) error {
	_, err := q.Exec(ctx, `UPDATE `+macroscopLinkTable(f)+` SET config_id = NULL WHERE id = $1`, agentID)
	return err
}

// DeleteMacroscopLink removes the bridge row entirely, which is what unbind did
// in Java: the link entity was removed rather than nulled.
func (s *Store) DeleteMacroscopLink(ctx context.Context, q db.Querier, f agentFamily, agentID string) error {
	_, err := q.Exec(ctx, `DELETE FROM `+macroscopLinkTable(f)+` WHERE id = $1`, agentID)
	return err
}

// ListMacroscopLinks returns agent id to configuration id for one family.
func (s *Store) ListMacroscopLinks(ctx context.Context, q db.Querier, f agentFamily) (map[string]string, error) {
	rows, err := q.Query(ctx, `SELECT id, config_id FROM `+macroscopLinkTable(f)+` WHERE config_id IS NOT NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var id string
		var cfg pgtype.Text
		if err := rows.Scan(&id, &cfg); err != nil {
			return nil, err
		}
		out[id] = deref(db.NullString(cfg))
	}
	return out, rows.Err()
}

const macroscopChannelColumns = `id, config_id, channel_id, channel_name, device, enabled, exists_on_server,
	archive_on, archive_allow, realtime_allow, sound_allow, archive_mode, channel_tz, use_channel,
	created_at, created_by, updated_at, updated_by`

// ListMacroscopChannels loads a configuration's channels with their streams.
func (s *Store) ListMacroscopChannels(ctx context.Context, q db.Querier, configID string) ([]MacroscopChannel, error) {
	rows, err := q.Query(ctx, `SELECT `+macroscopChannelColumns+` FROM macroscop_agent_channels
		WHERE config_id = $1 ORDER BY channel_id`, configID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	channels := []MacroscopChannel{}
	ids := []string{}
	for rows.Next() {
		var c MacroscopChannel
		var name, device, archiveMode, tz, createdBy, updatedBy pgtype.Text
		var created, updated pgtype.Timestamptz
		if err := rows.Scan(&c.ID, &c.ConfigID, &c.MacroscopID, &name, &device, &c.Enabled, &c.Exists,
			&c.ArchivingEnabled, &c.ArchiveAllowed, &c.RealtimeAllowed, &c.SoundAllowed, &archiveMode, &tz,
			&c.Used, &created, &createdBy, &updated, &updatedBy); err != nil {
			return nil, err
		}
		c.Name = db.NullString(name)
		c.Device = db.NullString(device)
		c.ArchiveMode = db.NullString(archiveMode)
		c.TZ = db.NullString(tz)
		c.CreatedAt = db.NullOffsetTime(created)
		c.CreatedBy = db.NullString(createdBy)
		c.UpdatedAt = db.NullOffsetTime(updated)
		c.UpdatedBy = db.NullString(updatedBy)
		c.Streams = []MacroscopChannelStream{}
		channels = append(channels, c)
		ids = append(ids, c.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return channels, nil
	}
	streams, err := s.macroscopStreams(ctx, q, ids)
	if err != nil {
		return nil, err
	}
	for i := range channels {
		if st, ok := streams[channels[i].ID]; ok {
			channels[i].Streams = st
		}
	}
	return channels, nil
}

func (s *Store) macroscopStreams(ctx context.Context, q db.Querier, channelIDs []string) (map[string][]MacroscopChannelStream, error) {
	rows, err := q.Query(ctx, `
		SELECT channel_id, stream_order, stream_type, stream_format
		FROM macroscop_channel_streams
		WHERE channel_id IN (`+db.BuildPlaceholders(1, len(channelIDs))+`)
		ORDER BY channel_id, stream_order`, toAny(channelIDs)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]MacroscopChannelStream{}
	for rows.Next() {
		var id string
		var st MacroscopChannelStream
		var typ, format pgtype.Text
		if err := rows.Scan(&id, &st.Order, &typ, &format); err != nil {
			return nil, err
		}
		st.Type = db.NullString(typ)
		st.Format = db.NullString(format)
		out[id] = append(out[id], st)
	}
	return out, rows.Err()
}

// FindMacroscopChannel loads one channel by its configuration and Macroscop-side
// channel id.
func (s *Store) FindMacroscopChannel(ctx context.Context, q db.Querier, configID, macroscopID string) (*MacroscopChannel, error) {
	row := q.QueryRow(ctx, `SELECT `+macroscopChannelColumns+` FROM macroscop_agent_channels
		WHERE config_id = $1 AND channel_id = $2`, configID, macroscopID)
	var c MacroscopChannel
	var name, device, archiveMode, tz, createdBy, updatedBy pgtype.Text
	var created, updated pgtype.Timestamptz
	if err := row.Scan(&c.ID, &c.ConfigID, &c.MacroscopID, &name, &device, &c.Enabled, &c.Exists,
		&c.ArchivingEnabled, &c.ArchiveAllowed, &c.RealtimeAllowed, &c.SoundAllowed, &archiveMode, &tz,
		&c.Used, &created, &createdBy, &updated, &updatedBy); err != nil {
		return nil, err
	}
	c.Name = db.NullString(name)
	c.Device = db.NullString(device)
	c.ArchiveMode = db.NullString(archiveMode)
	c.TZ = db.NullString(tz)
	c.CreatedAt = db.NullOffsetTime(created)
	c.CreatedBy = db.NullString(createdBy)
	c.UpdatedAt = db.NullOffsetTime(updated)
	c.UpdatedBy = db.NullString(updatedBy)
	c.Streams = []MacroscopChannelStream{}
	streams, err := s.macroscopStreams(ctx, q, []string{c.ID})
	if err != nil {
		return nil, err
	}
	c.Streams = streams[c.ID]
	return &c, nil
}

// SaveMacroscopChannel writes a channel row and replaces its stream list.
func (s *Store) SaveMacroscopChannel(ctx context.Context, q db.Querier, c *MacroscopChannel) error {
	now := common.NowOffsetDateTime()
	if c.ID == "" {
		c.ID = newID()
	}
	c.CreatedAt = &now
	c.UpdatedAt = &now
	if _, err := q.Exec(ctx, `
		INSERT INTO macroscop_agent_channels
			(id, config_id, channel_id, channel_name, device, enabled, exists_on_server, archive_on,
			 archive_allow, realtime_allow, sound_allow, archive_mode, channel_tz, use_channel,
			 created_at, created_by, updated_at, updated_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$15,$16)
		ON CONFLICT (id) DO UPDATE
		SET channel_name = EXCLUDED.channel_name, device = EXCLUDED.device, enabled = EXCLUDED.enabled,
		    exists_on_server = EXCLUDED.exists_on_server, archive_on = EXCLUDED.archive_on,
		    archive_allow = EXCLUDED.archive_allow, realtime_allow = EXCLUDED.realtime_allow,
		    sound_allow = EXCLUDED.sound_allow, archive_mode = EXCLUDED.archive_mode,
		    channel_tz = EXCLUDED.channel_tz, use_channel = EXCLUDED.use_channel,
		    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
		c.ID, c.ConfigID, c.MacroscopID, db.StringValue(c.Name), db.StringValue(c.Device), c.Enabled,
		c.Exists, c.ArchivingEnabled, c.ArchiveAllowed, c.RealtimeAllowed, c.SoundAllowed,
		db.StringValue(c.ArchiveMode), db.StringValue(c.TZ), c.Used,
		now.Time, db.StringValue(c.CreatedBy)); err != nil {
		return err
	}
	if _, err := q.Exec(ctx, `DELETE FROM macroscop_channel_streams WHERE channel_id = $1`, c.ID); err != nil {
		return err
	}
	for i := range c.Streams {
		st := c.Streams[i]
		if _, err := q.Exec(ctx, `
			INSERT INTO macroscop_channel_streams (channel_id, stream_order, stream_type, stream_format)
			VALUES ($1, $2, $3, $4)`,
			c.ID, st.Order, db.StringValue(st.Type), db.StringValue(st.Format)); err != nil {
			return err
		}
	}
	return nil
}

// DeleteMacroscopChannel removes a channel and reports whether it existed.
func (s *Store) DeleteMacroscopChannel(ctx context.Context, q db.Querier, id string) (bool, error) {
	if _, err := q.Exec(ctx, `DELETE FROM macroscop_channel_streams WHERE channel_id = $1`, id); err != nil {
		return false, err
	}
	tag, err := q.Exec(ctx, `DELETE FROM macroscop_agent_channels WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

// ============================================================
// Places of the event and camera families
// ============================================================

// ListAgentPlaces loads the places of one agent.
func (s *Store) ListAgentPlaces(ctx context.Context, q db.Querier, f agentFamily, agentID string) ([]AgentPlace, error) {
	rows, err := q.Query(ctx, `SELECT id, name, available FROM `+f.Places+` WHERE agent_id = $1 ORDER BY name, id`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AgentPlace{}
	for rows.Next() {
		var p AgentPlace
		if err := rows.Scan(&p.ID, &p.Name, &p.Available); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ============================================================
// helpers
// ============================================================

// toAny widens a string slice for the variadic query arguments.
func toAny(values []string) []any {
	out := make([]any, len(values))
	for i, v := range values {
		out[i] = v
	}
	return out
}

// AgentConfig is the subtype configuration row of an agent: its only content is
// the audit trail, and its existence is what marks the agent configured.
type AgentConfig struct {
	ID        string
	CreatedAt *common.LocalDateTime
	CreatedBy *string
	UpdatedAt *common.LocalDateTime
	UpdatedBy *string
}

// InsertAgentConfig writes a subtype configuration row.
func (s *Store) InsertAgentConfig(ctx context.Context, q db.Querier, f agentFamily, c *AgentConfig) error {
	now := common.NowLocalDateTime()
	c.CreatedAt = &now
	c.UpdatedAt = &now
	if _, err := q.Exec(ctx, `
		INSERT INTO `+f.Configs+` (id, created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $2, $3)`,
		c.ID, now.Time, db.StringValue(c.CreatedBy)); err != nil {
		return err
	}
	if f.ConfigSubtype == "" {
		return nil
	}
	// The child row carries no audit of its own; it exists so the joined
	// inheritance read finds a configuration rather than nothing.
	_, err := q.Exec(ctx, `INSERT INTO `+f.ConfigSubtype+` (id) VALUES ($1)`, c.ID)
	return err
}

// FindCRMOrgByAgent resolves the external CRM organization an agent owns.
//
// crm_places and crm_organizations hang off crm_agents.crm_organization_id
// rather than off the agent directly, so this is a join rather than a
// single-table lookup. The Java repository expressed the same thing as
// findByAgentId, a @Query across the joined subclass.
func (s *Store) FindCRMOrgByAgent(ctx context.Context, q db.Querier, agentID string) (*CRMOrganization, error) {
	return scanCRMOrg(q.QueryRow(ctx, `SELECT `+prefixed(crmOrgColumns, "o")+`
		FROM crm_organizations o JOIN crm_agents a ON a.crm_organization_id = o.id
		WHERE a.id = $1`, agentID))
}

// ListCRMPlacesForAgent loads the places of the external organization an agent
// owns. A place belongs to the organization, not the agent, so two agents
// sharing an external company would share its places; the CRM binding is unique
// per organization, so in practice there is only ever one.
func (s *Store) ListCRMPlacesForAgent(ctx context.Context, q db.Querier, agentID string) ([]CRMPlace, error) {
	rows, err := q.Query(ctx, `SELECT `+prefixed(crmPlaceColumns, "p")+`
		FROM crm_places p
		JOIN crm_agents a ON a.crm_organization_id = p.organization_id
		WHERE a.id = $1 ORDER BY p.yc_id`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CRMPlace{}
	for rows.Next() {
		v, err := scanCRMPlace(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

// FindCRMPlaceByYcID looks up a place of an agent by its external id, which is
// the uniqueness rule the add endpoint enforces.
func (s *Store) FindCRMPlaceByYcID(ctx context.Context, q db.Querier, agentID string, ycID int64) (*CRMPlace, error) {
	return scanCRMPlace(q.QueryRow(ctx, `SELECT `+prefixed(crmPlaceColumns, "p")+`
		FROM crm_places p
		JOIN crm_agents a ON a.crm_organization_id = p.organization_id
		WHERE a.id = $1 AND p.yc_id = $2`, agentID, ycID))
}

// UpdateCRMPlace writes the mutable columns of a place.
func (s *Store) UpdateCRMPlace(ctx context.Context, q db.Querier, p *CRMPlace) error {
	now := common.NowLocalDateTime()
	p.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		UPDATE crm_places SET name = $2, yc_name = $3, available = $4, updated_at = $5, updated_by = $6
		WHERE id = $1`,
		p.ID, p.Name, db.StringValue(p.YcName), p.Available, now.Time, db.StringValue(p.UpdatedBy))
	return err
}

// FindCRMServiceByYcID looks up a service of an agent by its external id.
func (s *Store) FindCRMServiceByYcID(ctx context.Context, q db.Querier, agentID string, ycID int64) (*CRMService, error) {
	return scanCRMService(q.QueryRow(ctx, `SELECT `+crmServiceColumns+` FROM crm_services
		WHERE agent_id = $1 AND yc_id = $2`, agentID, ycID))
}

// UpdateCRMService writes the mutable columns of a service.
func (s *Store) UpdateCRMService(ctx context.Context, q db.Querier, v *CRMService) error {
	now := common.NowLocalDateTime()
	v.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		UPDATE crm_services SET name = $2, yc_name = $3, updated_at = $4, updated_by = $5 WHERE id = $1`,
		v.ID, v.Name, db.StringValue(v.YcName), now.Time, db.StringValue(v.UpdatedBy))
	return err
}

// prefixed qualifies a comma-separated column list with a table alias.
func prefixed(columns, alias string) string {
	parts := strings.Split(columns, ",")
	for i, p := range parts {
		parts[i] = alias + "." + strings.TrimSpace(p)
	}
	return strings.Join(parts, ", ")
}

// InsertYCCategory writes a service category for an agent.
func (s *Store) InsertYCCategory(ctx context.Context, q db.Querier, c *YCServiceCategory) error {
	now := common.NowLocalDateTime()
	c.CreatedAt = &now
	c.UpdatedAt = &now
	_, err := q.Exec(ctx, `
		INSERT INTO yc_service_categories (yc_id, yc_name, agent_id, organization_id, created_at, created_by, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $5, $6)`,
		c.YcID, db.StringValue(c.YcName), db.StringValue(c.AgentID), db.StringValue(c.OrganizationID),
		now.Time, db.StringValue(c.CreatedBy))
	return err
}

// TouchYCCategory stamps updated_by/updated_at on a category whose name changed.
// The category's name is the only mutable column, and it is written on the
// upsert path rather than here, so this only refreshes the audit trail.
func (s *Store) TouchYCCategory(ctx context.Context, q db.Querier, ycID int64, actor *string) error {
	now := common.NowLocalDateTime()
	_, err := q.Exec(ctx, `UPDATE yc_service_categories SET updated_at = $2, updated_by = $3 WHERE yc_id = $1`,
		ycID, now.Time, db.StringValue(actor))
	return err
}

// ListMacroscopConfigs returns the registered Macroscop servers, newest name
// first is deliberately not attempted: the Java repository had no ordering, so
// the database decides and the front-end sorts the list itself.
func (s *Store) ListMacroscopConfigs(ctx context.Context, q db.Querier) ([]MacroscopConfig, error) {
	rows, err := q.Query(ctx, `SELECT id, name FROM macroscop_agent_configs`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MacroscopConfig{}
	for rows.Next() {
		var c MacroscopConfig
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ListOrgIDsByEvtConfig returns the organizations whose event agents are bound
// to a Macroscop configuration.
//
// The permission check for a Macroscop server is made against the event agents
// rather than the camera ones: an organization that cannot see an organization's
// events cannot be expected to manage its cameras either, and the two agent
// families are always registered together. The reverse direction does not hold,
// so consulting the event side is the side that is never missing.
func (s *Store) ListOrgIDsByEvtConfig(ctx context.Context, q db.Querier, configID string) ([]string, error) {
	rows, err := q.Query(ctx, `
		SELECT DISTINCT a.organization_id
		FROM evt_agents a
		JOIN macroscop_evt_agent_configs m ON m.id = a.id
		WHERE m.config_id = $1 AND a.organization_id IS NOT NULL`, configID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var orgID string
		if err := rows.Scan(&orgID); err != nil {
			return nil, err
		}
		out = append(out, orgID)
	}
	return out, rows.Err()
}
