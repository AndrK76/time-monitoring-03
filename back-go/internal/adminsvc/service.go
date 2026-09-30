package adminsvc

import (
	"context"
	"log/slog"
	"sort"
	"strings"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// Service is the application layer of service-admin: the organization
// dictionary, user access management, the three agent families and their
// external integrations.
type Service struct {
	Store *Store
	Pub   *Publisher
	// Cipher masks and unmasks stored credentials. Macroscop passwords and
	// YClients tokens are both held XOR-masked, exactly as in the Java entity
	// hooks, so a database dump never yields a usable secret.
	Cipher *common.XorCipher
	// XorSecret is the key the cipher was built with. It comes from
	// security.store.xor, the same property the Java service injected.
	XorSecret string
	// YC and MS are the external API clients.
	YC  *YClientsAPI
	MS  *MacroscopAPI
	Log *slog.Logger
}

// NewService wires the service layer.
func NewService(store *Store, pub *Publisher, cipher *common.XorCipher, xorSecret string, yc *YClientsAPI, ms *MacroscopAPI, log *slog.Logger) *Service {
	return &Service{Store: store, Pub: pub, Cipher: cipher, XorSecret: xorSecret, YC: yc, MS: ms, Log: log}
}

// ============================================================
// /api/v1/access - organization and membership administration
// ============================================================

// GetOrganizations lists every organization.
//
// There is no permission filter beyond authentication: the Java method carried
// no @PreAuthorize, so any valid token saw the full list. That is a deliberate
// difference from the dictionary endpoint, which filters to the caller's
// organizations; the access screen is the administrative one and the front-end
// hides the rows the caller cannot edit. See MIGRATION.md, "Inherited
// limitations".
func (s *Service) GetOrganizations(ctx context.Context) ([]OrganizationListDTO, error) {
	orgs, err := s.Store.ListOrgs(ctx, s.Store.pool)
	if err != nil {
		return nil, err
	}
	out := make([]OrganizationListDTO, 0, len(orgs))
	for i := range orgs {
		out = append(out, OrganizationListDTO{
			ID: orgs[i].ID, ShortName: orgs[i].ShortName, FullName: orgs[i].FullName,
		})
	}
	return out, nil
}

// GetOrganization returns one organization with its membership.
func (s *Service) GetOrganization(ctx context.Context, acc *Access, id string) (*OrganizationItemDTO, error) {
	if !acc.IsAllowedOrganization(id) {
		return nil, httpx.Forbidden("Access denied")
	}
	var out *OrganizationItemDTO
	err := s.Store.pool.InReadTx(ctx, func(q db.Querier) error {
		org, err := s.Store.FindOrg(ctx, q, id)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.NotFound("Organization not found")
			}
			return err
		}
		users, err := s.Store.OrgUserIDs(ctx, q, id)
		if err != nil {
			return err
		}
		out = orgItemDTO(org, users)
		return nil
	})
	return out, err
}

func orgItemDTO(org *Organization, users []string) *OrganizationItemDTO {
	if users == nil {
		users = []string{}
	}
	return &OrganizationItemDTO{
		ID: org.ID, ShortName: org.ShortName, FullName: org.FullName, Users: users,
	}
}

// AddOrganization creates an organization and announces it.
func (s *Service) AddOrganization(ctx context.Context, acc *Access, in *OrganizationListDTO) (*OrganizationListDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	if err := validateListDTO(in); err != nil {
		return nil, err
	}
	creator := acc.UserID()
	org := &Organization{
		ShortName: in.ShortName,
		FullName:  in.FullName,
		CreatedBy: &creator,
		UpdatedBy: &creator,
	}
	var evt *common.OrgChangeEvent
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		if err := s.Store.InsertOrg(ctx, q, org); err != nil {
			return err
		}
		// The ADD event carries the creation audit, not the update audit: a
		// consumer applying ADD writes the row's created_at/created_by, and a
		// later UPDATE would overwrite them with a value that is only a few
		// microseconds newer and belongs to nobody.
		evt = orgChangeEventWithUsers(org, common.ModeAdd, []string{})
		evt.UpdatedBy = org.CreatedBy
		evt.UpdatedAt = org.CreatedAt
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.Pub.publishAuthMon(ctx, evt)
	return &OrganizationListDTO{ID: org.ID, ShortName: org.ShortName, FullName: org.FullName}, nil
}

// UpdateOrganization renames an organization and replaces its membership when
// the request carries one.
func (s *Service) UpdateOrganization(ctx context.Context, acc *Access, id string, in *OrganizationItemDTO) (*OrganizationItemDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	if err := validateItemDTO(in); err != nil {
		return nil, err
	}
	updater := acc.UserID()
	var evt *common.OrgChangeEvent
	var out *OrganizationItemDTO
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		org, err := s.Store.FindOrg(ctx, q, id)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.NotFound("Organization not found")
			}
			return err
		}
		org.ShortName = in.ShortName
		org.FullName = in.FullName
		org.UpdatedBy = &updater
		if err := s.Store.UpdateOrg(ctx, q, org); err != nil {
			return err
		}
		if in.Users != nil {
			// Java computed the add and remove sets and logged, but did not
			// check, whether every id resolved to a real user: findAllById
			// silently returned fewer rows and the missing membership was
			// dropped. The replacement below does the same, so a request naming
			// an unknown user still succeeds and simply does not grant it.
			if err := s.Store.ReplaceOrgUsers(ctx, q, id, in.Users, &updater); err != nil {
				return err
			}
		}
		users, err := s.Store.OrgUserIDs(ctx, q, id)
		if err != nil {
			return err
		}
		evt = orgChangeEventWithUsers(org, common.ModeUpdate, users)
		out = orgItemDTO(org, users)
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.Pub.publishAuthMon(ctx, evt)
	return out, nil
}

// DeleteOrganization removes an organization, its membership and its agent
// bindings.
//
// The event is published after the transaction commits. The Java service sent it
// before the delete, from inside the same transaction, so a consumer that
// applied the DELETE and then failed its own transaction would leave the
// organization gone here but present there.
func (s *Service) DeleteOrganization(ctx context.Context, acc *Access, id string) error {
	if !acc.IsSuperUser() {
		return httpx.Forbidden("Access denied")
	}
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		found, err := s.Store.DeleteOrg(ctx, q, id)
		if err != nil {
			return err
		}
		if !found {
			// Java called deleteById unconditionally, which threw
			// EmptyResultDataAccessException and surfaced as a 500. Reporting a
			// missing row as 404 is the same information without the trace.
			return httpx.NotFound("Organization not found")
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.Pub.publishAuthMon(ctx, newDeleteEvent(id))
	return nil
}

// GetUsers lists the valid mirrored users.
//
// Only valid users are returned: app_users is a mirror of the auth service, and
// a deactivated account is one the caller should not be able to grant access to.
func (s *Service) GetUsers(ctx context.Context, acc *Access) ([]UserListItemDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	users, err := s.Store.ListUsers(ctx, s.Store.pool)
	if err != nil {
		return nil, err
	}
	out := make([]UserListItemDTO, 0, len(users))
	for i := range users {
		if !users[i].Valid {
			continue
		}
		// Roles and Organizations stay nil: the Java mapper ignored both, and
		// the front-end treats a null roles list as "none".
		out = append(out, UserListItemDTO{
			ID:          users[i].ID,
			Username:    users[i].Username,
			DisplayName: users[i].DisplayName,
			Active:      users[i].Valid,
		})
	}
	return out, nil
}

// ============================================================
// /api/v1/dict - the organization dictionary
// ============================================================

// GetAllowedOrganizations lists the organizations the caller may see, sorted by
// short name then full name then id, all case-insensitively with nulls last.
func (s *Service) GetAllowedOrganizations(ctx context.Context, acc *Access) ([]OrgStructListDTO, error) {
	orgs, err := s.Store.ListOrgs(ctx, s.Store.pool)
	if err != nil {
		return nil, err
	}
	out := make([]OrgStructListDTO, 0, len(orgs))
	for i := range orgs {
		if !acc.IsAllowedOrganization(orgs[i].ID) {
			continue
		}
		out = append(out, orgStructDTO(&orgs[i]))
	}
	sortOrgStructs(out)
	return out, nil
}

func orgStructDTO(org *Organization) OrgStructListDTO {
	return OrgStructListDTO{
		ID:              org.ID,
		ShortName:       org.ShortName,
		FullName:        org.FullName,
		CRMAgentSet:     org.CRMAgentSet,
		EventAgentsSet:  org.EventAgentsSet,
		CameraAgentsSet: org.CameraAgentsSet,
	}
}

// sortOrgStructs applies the Java comparator: short name, then full name, then
// id, each compared case-insensitively.
//
// Both name columns are NOT NULL in the schema, so the nulls-last branches of
// the Java comparator were unreachable and are not needed here.
func sortOrgStructs(items []OrgStructListDTO) {
	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i], items[j]
		if c := compareFold(a.ShortName, b.ShortName); c != 0 {
			return c < 0
		}
		if c := compareFold(a.FullName, b.FullName); c != 0 {
			return c < 0
		}
		return a.ID < b.ID
	})
}

// compareFold is String.compareToIgnoreCase, the case-insensitive comparator the
// Java sort used.
func compareFold(a, b string) int {
	ar, br := []rune(a), []rune(b)
	n := len(ar)
	if len(br) < n {
		n = len(br)
	}
	for i := 0; i < n; i++ {
		ca, cb := toUpperRune(ar[i]), toUpperRune(br[i])
		if ca != cb {
			// Fall back to the lowercase forms, which is what compareToIgnoreCase
			// does: it compares upper-cased characters and, when those tie,
			// lower-cased ones.
			la, lb := toLowerRune(ar[i]), toLowerRune(br[i])
			if la != lb {
				if la < lb {
					return -1
				}
				return 1
			}
		}
	}
	switch {
	case len(ar) < len(br):
		return -1
	case len(ar) > len(br):
		return 1
	}
	return 0
}

func toUpperRune(r rune) rune {
	if r >= 'a' && r <= 'z' {
		return r - 32
	}
	return r
}

func toLowerRune(r rune) rune {
	if r >= 'A' && r <= 'Z' {
		return r + 32
	}
	return r
}

// GetDictOrganization returns one organization from the dictionary.
//
// A caller who may not see the organization gets 404, not 403. The Java service
// threw a bare ResponseStatusException(NOT_FOUND) from checkOrgId, and the
// front-end uses this endpoint to decide whether to offer the "not found" or the
// "forbidden" screen, so the distinction is deliberate.
func (s *Service) GetDictOrganization(ctx context.Context, acc *Access, id string) (*OrgStructListDTO, error) {
	if !acc.IsAllowedOrganization(id) {
		return nil, httpx.NotFound("Not Found")
	}
	org, err := s.Store.FindOrg(ctx, s.Store.pool, id)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Not Found")
		}
		return nil, err
	}
	dto := orgStructDTO(org)
	return &dto, nil
}

// UpdateDictOrganization renames an organization from the dictionary.
func (s *Service) UpdateDictOrganization(ctx context.Context, acc *Access, id string, in *OrgStructListDTO) (*OrgStructListDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	org, err := s.Store.FindOrg(ctx, s.Store.pool, id)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Not Found")
		}
		return nil, err
	}
	org.ShortName = in.ShortName
	org.FullName = in.FullName
	updater := acc.UserID()
	org.UpdatedBy = &updater
	if err := s.Store.UpdateOrg(ctx, s.Store.pool, org); err != nil {
		return nil, err
	}
	// UPDATE_NAME rather than UPDATE: the membership did not change, and a
	// consumer that treats UPDATE as a full replace would rewrite the audit
	// columns unnecessarily.
	evt := orgChangeEvent(org, common.ModeUpdateName)
	evt.Users = []string{}
	s.Pub.publishAuthMon(ctx, evt)
	dto := orgStructDTO(org)
	return &dto, nil
}

// ============================================================
// /api/v1/test - the authorization probe endpoints
// ============================================================

// TestUserInfo builds the payload of the diagnostic endpoints, which double as a
// way for the front-end to confirm what the current token grants.
func (s *Service) TestUserInfo(ctx context.Context, acc *Access, action string) *TestResponse {
	return testUserInfo(acc.auth, action)
}

func testUserInfo(auth *security.Auth, action string) *TestResponse {
	now := common.NowLocalDateTime()
	if auth == nil {
		return &TestResponse{
			Message:   "Пользователь не аутентифицирован",
			Success:   false,
			Timestamp: now,
		}
	}
	// Roles and permissions are comma-space joined strings here, unlike the
	// comma-joined form the command envelope uses. The front-end splits on ", ".
	roles := strings.Join(auth.Roles, ", ")
	permissions := strings.Join(auth.Permissions, ", ")
	username := auth.Username
	userID := auth.UserID
	return &TestResponse{
		Message:     action + " - успешно выполнено",
		Username:    &username,
		UserID:      &userID,
		Roles:       &roles,
		Permissions: &permissions,
		Timestamp:   now,
		Success:     true,
	}
}

// TestCheckDeviationPermission is the /test/deviation/check probe, which answers
// with a 403 rather than a payload when the caller lacks the permission.
func (s *Service) TestCheckDeviationPermission(ctx context.Context, acc *Access) (*TestResponse, error) {
	if acc.auth == nil {
		return nil, httpx.Forbidden("Пользователь не аутентифицирован")
	}
	if !acc.HasPermission(PermissionDeviationApprove) {
		return nil, httpx.Forbidden("Требуется право DEVIATION_APPROVE")
	}
	return testUserInfo(acc.auth, "Проверка права DEVIATION_APPROVE"), nil
}

// The role and permission names the probe endpoints test for. They are exported
// because the HTTP layer enforces them directly: Spring read them from the
// @PreAuthorize expressions, and here the check lives in the handler that owns
// the route.
const (
	PermissionDeviationApprove = "DEVIATION_APPROVE"
	RoleSystemAdmin            = "SYSTEM_ADMIN"
	RoleOrgAdmin               = "ORG_ADMIN"
	RoleDispatcher             = "DISPATCHER"
)

// TestPublicResponse is the payload of GET /api/v1/test/public, which reports
// only that the service is up and therefore has no dependency on the caller.
func TestPublicResponse() *TestResponse {
	return &TestResponse{
		Message:   "Public endpoint - доступен всем",
		Success:   true,
		Timestamp: common.NowLocalDateTime(),
	}
}

// HasRole is the ROLE_-prefixed form of the token role check, for the endpoints
// guarded by hasRole(...). Spring's hasRole adds the ROLE_ prefix itself, and the
// service-auth issuer stores roles prefixed, so the two cancel out.
func (a *Access) HasRole(role string) bool { return a.auth.HasRole("ROLE_" + role) }

// ============================================================
// helpers
// ============================================================

// validateListDTO applies the @NotBlank constraints of OrganizationListDto.
func validateListDTO(in *OrganizationListDTO) error {
	if in == nil {
		return httpx.BadRequest("Request body is required")
	}
	if blank(in.ShortName) {
		return httpx.BadRequest("shortName must not be blank")
	}
	if blank(in.FullName) {
		return httpx.BadRequest("fullName must not be blank")
	}
	return nil
}

// validateItemDTO applies the @NotBlank constraints of OrganizationItemDto.
func validateItemDTO(in *OrganizationItemDTO) error {
	if in == nil {
		return httpx.BadRequest("Request body is required")
	}
	if blank(in.ShortName) {
		return httpx.BadRequest("shortName must not be blank")
	}
	if blank(in.FullName) {
		return httpx.BadRequest("fullName must not be blank")
	}
	return nil
}
