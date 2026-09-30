package adminsvc

import (
	"context"
	"sort"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
)

// The three agent families.
//
// CrmManageService, EvtManageService and ImgManageService were three 250-line
// near-copies in the Java service. They differ only in the table names, the
// agent-type enum, the word used in error messages, and whether an organization
// may hold more than one agent. This file expresses those differences as data
// and implements the shared logic once, so a fix to the binding rules cannot
// land in two of the three families and miss the third.

// AgentKind describes one family.
type AgentKind struct {
	family agentFamily
	// Label is the word the Java error messages used: "CRM", "Event",
	// "Camera". It is reproduced because the front-end matches on some of them.
	Label string
	// Types is the closed set of implementations for this family.
	Types []AgentType
	// UniquePerOrg marks the family where an organization may hold at most one
	// agent. Only CRM is: crm_agents.organization_id carries a unique index,
	// because one organization syncs with one external CRM company.
	UniquePerOrg bool
	// flag names the organization flag this family owns, which is what its
	// bind and unbind transitions set and clear.
	flag    func(o *Organization) bool
	setFlag func(o *Organization, v bool)
	// bindMode is the organization event mode the family publishes.
	bindMode common.OrgChangeMode
}

// The three families. The flag accessors are the direct equivalent of
// CrmAgent#setOrganization, EvtAgent#setOrganization and
// ImgAgent#setOrganization.
var (
	KindCRM = &AgentKind{
		family:       familyCRM,
		Label:        "CRM",
		Types:        []AgentType{AgentTypeYClients},
		UniquePerOrg: true,
		flag:         func(o *Organization) bool { return o.CRMAgentSet },
		setFlag:      func(o *Organization, v bool) { o.CRMAgentSet = v },
		bindMode:     common.ModeUpdateCRMBind,
	}
	KindEvt = &AgentKind{
		family:   familyEvt,
		Label:    "Event",
		Types:    []AgentType{AgentTypeMacroscopEvt, AgentTypeZigbee},
		flag:     func(o *Organization) bool { return o.EventAgentsSet },
		setFlag:  func(o *Organization, v bool) { o.EventAgentsSet = v },
		bindMode: common.ModeUpdateEvtBind,
	}
	KindImg = &AgentKind{
		family:   familyImg,
		Label:    "Camera",
		Types:    []AgentType{AgentTypeMacroscopImg},
		flag:     func(o *Organization) bool { return o.CameraAgentsSet },
		setFlag:  func(o *Organization, v bool) { o.CameraAgentsSet = v },
		bindMode: common.ModeUpdateImgBind,
	}
)

// Kinds indexes the families by the name used in the error messages, so the
// common code paths can name the family without being given it.
var Kinds = map[string]*AgentKind{
	"CRM":    KindCRM,
	"Event":  KindEvt,
	"Camera": KindImg,
}

// AgentTypes lists the implementations of one family.
func (k *AgentKind) AgentTypes() []AgentTypeDTO {
	out := make([]AgentTypeDTO, 0, len(k.Types))
	for _, t := range k.Types {
		out = append(out, AgentTypeDTO{Value: t.Value, Name: t.Name, Description: t.Description})
	}
	return out
}

// resolveType maps the wire agentType to its enum entry, case-insensitively on
// the enum name, which is what CrmAgentType.byId and its siblings did. A value
// that matches nothing is a 400, not a 404: the request is well formed but names
// an implementation this build does not have.
func (k *AgentKind) resolveType(value string) (AgentType, bool) {
	for _, t := range k.Types {
		if equalFoldIgnoreCase(t.Value, value) {
			return t, true
		}
	}
	return AgentType{}, false
}

// agentNotFound is the single 404 both "no such agent" and "not allowed to see
// it" produce. Distinguishing them would tell a caller that an id exists which
// it is not allowed to read, so the Java service returned the same 404 for both
// and so does this.
func (k *AgentKind) agentNotFound(id string) error {
	return httpx.NotFound(k.Label + " Agent with id " + id + " not found")
}

// ============================================================
// Reads
// ============================================================

// ListAgents returns every agent the caller may see, sorted by name, then
// description, then id.
//
// The Java comparator used the natural String order, which throws a
// NullPointerException on a null description. Since description is nullable in
// the schema and the front-end omits it when creating an agent, that made the
// whole list fail to render; the Go comparator puts nulls last instead. See
// MIGRATION.md, "Fixed defects".
func (s *Service) ListAgents(ctx context.Context, acc *Access, k *AgentKind) ([]AgentListDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	agents, err := s.Store.ListAgents(ctx, s.Store.pool, k.family)
	if err != nil {
		return nil, err
	}
	out := make([]AgentListDTO, 0, len(agents))
	for i := range agents {
		if !acc.IsSuperUser() && !acc.IsAllowedOrganization(deref(agents[i].OrganizationID)) {
			continue
		}
		out = append(out, k.toListDTO(&agents[i]))
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		// A missing description sorts after a present one, matching the
		// nulls-last rule the dictionary sort already used.
		di, dj := deref(out[i].Description), deref(out[j].Description)
		if di != "" || dj != "" {
			if di == "" {
				return false
			}
			if dj == "" {
				return true
			}
			if di != dj {
				return di < dj
			}
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

// AgentListDTO is the family-agnostic list projection. The three Java list DTOs
// have identical fields, so one Go type serves all of them.
type AgentListDTO struct {
	ID             string  `json:"id"`
	OrganizationID *string `json:"organizationId"`
	AgentType      string  `json:"agentType"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Configured     bool    `json:"configured"`
}

func (k *AgentKind) toListDTO(a *Agent) AgentListDTO {
	return AgentListDTO{
		ID:             a.ID,
		OrganizationID: a.OrganizationID,
		AgentType:      a.AgentType,
		Name:           a.Name,
		Description:    a.Description,
		Configured:     a.Configured,
	}
}

// AgentsByOrganization lists the agents bound to one organization, in the order
// the caller is entitled to see.
func (s *Service) AgentsByOrganization(ctx context.Context, acc *Access, k *AgentKind, orgID string) ([]AgentListDTO, error) {
	if !acc.IsAllowedOrganization(orgID) {
		return nil, httpx.Forbidden("Access denied")
	}
	agents, err := s.Store.ListAgentsByOrg(ctx, s.Store.pool, k.family, orgID)
	if err != nil {
		return nil, err
	}
	return k.sortedListDTOs(agents), nil
}

// AgentsByOrganizationWithUnbounded is the same list for a caller who is
// allowed to bind, including agents the organization does not own.
//
// The difference from AgentsByOrganization is that this one requires SUPERUSER
// and filters nothing: it exists so the binding screen can offer an agent that is
// currently bound elsewhere. The Java method ignored its organizationId argument
// for the filter and used it only for the final predicate, which is reproduced.
func (s *Service) AgentsByOrganizationWithUnbounded(ctx context.Context, acc *Access, k *AgentKind, orgID string) ([]AgentListDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	agents, err := s.Store.ListAgents(ctx, s.Store.pool, k.family)
	if err != nil {
		return nil, err
	}
	filtered := make([]Agent, 0, len(agents))
	for i := range agents {
		if deref(agents[i].OrganizationID) == orgID {
			filtered = append(filtered, agents[i])
		}
	}
	return k.sortedListDTOs(filtered), nil
}

func (k *AgentKind) sortedListDTOs(agents []Agent) []AgentListDTO {
	out := make([]AgentListDTO, 0, len(agents))
	for i := range agents {
		out = append(out, k.toListDTO(&agents[i]))
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		di, dj := deref(out[i].Description), deref(out[j].Description)
		if di != "" || dj != "" {
			if di == "" {
				return false
			}
			if dj == "" {
				return true
			}
			if di != dj {
				return di < dj
			}
		}
		return out[i].ID < out[j].ID
	})
	return out
}

// GetAgent returns one agent with its associated configuration and, for the CRM
// family, its external organization and registered services.
//
// A caller who may not see the agent's organization gets the same 404 as a
// missing agent.
func (s *Service) GetAgent(ctx context.Context, acc *Access, k *AgentKind, agentID string) (any, error) {
	agent, err := s.Store.FindAgent(ctx, s.Store.pool, k.family, agentID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, k.agentNotFound(agentID)
		}
		return nil, err
	}
	if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(deref(agent.OrganizationID)) {
		return nil, k.agentNotFound(agentID)
	}
	return s.agentItem(ctx, acc, k, agent, s.Store.pool)
}

// agentItem loads the associations and builds the family-specific item DTO.
//
// The querier is a parameter rather than the pool because the write paths call
// this from inside their transaction: the agent, its configuration and its CRM
// organization are all rows that transaction created and has not committed, so
// reading them over a second connection would see nothing and answer with an
// item missing its own configuration.
func (s *Service) agentItem(ctx context.Context, acc *Access, k *AgentKind, agent *Agent, q db.Querier) (any, error) {
	cfg, err := s.Store.FindAgentConfig(ctx, q, k.family, agent.ID)
	if err != nil && !db.IsNoRows(err) {
		return nil, err
	}
	var cfgDTO *AgentConfigDTO
	if cfg != nil {
		agentType := agent.AgentType
		cfgDTO = &AgentConfigDTO{ID: cfg.ID, AgentType: &agentType}
	}
	if !k.family.HasCRMOrg {
		places, err := s.Store.ListAgentPlaces(ctx, q, k.family, agent.ID)
		if err != nil {
			return nil, err
		}
		if k == KindEvt {
			out := make([]EvtPlaceListDTO, 0, len(places))
			for _, p := range places {
				out = append(out, EvtPlaceListDTO{ID: p.ID, Name: p.Name})
			}
			return &EvtAgentItemDTO{
				ID: agent.ID, OrganizationID: agent.OrganizationID, AgentType: &agent.AgentType,
				Name: agent.Name, Description: agent.Description, Configured: agent.Configured,
				Config: cfgDTO, Places: out,
			}, nil
		}
		out := make([]ImgPlaceListDTO, 0, len(places))
		for _, p := range places {
			out = append(out, ImgPlaceListDTO{ID: p.ID, Name: p.Name})
		}
		return &ImgAgentItemDTO{
			ID: agent.ID, OrganizationID: agent.OrganizationID, AgentType: &agent.AgentType,
			Name: agent.Name, Description: agent.Description, Configured: agent.Configured,
			Config: cfgDTO, Places: out,
		}, nil
	}
	var crmOrg *CrmOrganizationDTO
	if agent.CRMOrganizationID != nil {
		org, err := s.Store.FindCRMOrg(ctx, q, *agent.CRMOrganizationID)
		if err != nil && !db.IsNoRows(err) {
			return nil, err
		}
		if org != nil {
			crmOrg = &CrmOrganizationDTO{ID: org.ID, Name: org.YcName}
		}
	}
	services, err := s.Store.ListCRMServicesForAgent(ctx, q, agent.ID)
	if err != nil {
		return nil, err
	}
	out := make([]CrmServiceDTO, 0, len(services))
	for _, v := range services {
		out = append(out, CrmServiceDTO{ID: v.ID, Name: v.Name})
	}
	return &CrmAgentItemDTO{
		ID: agent.ID, OrganizationID: agent.OrganizationID, AgentType: &agent.AgentType,
		Name: agent.Name, Description: agent.Description, Configured: agent.Configured,
		Config: cfgDTO, CRMOrganization: crmOrg, Services: out,
	}, nil
}

// GetAgentConfig returns the agent's subtype configuration row, creating it on
// first read.
//
// The lazy creation is the Java design and is kept: the front-end calls
// /agents/{id}/config as the first step of configuring an agent, and the row
// marks the agent as configured. It is created with the caller's id in
// created_by, and the agent is stamped with updated_by.
//
// The CRM branch of the Java code stamped created_by on the agent instead, which
// meant a later audit read the agent as never having been touched. See
// MIGRATION.md, "Fixed defects".
func (s *Service) GetAgentConfig(ctx context.Context, acc *Access, k *AgentKind, agentID string) (*AgentConfigDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	var out *AgentConfigDTO
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		agent, err := s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				return k.agentNotFound(agentID)
			}
			return err
		}
		if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(deref(agent.OrganizationID)) {
			return k.agentNotFound(agentID)
		}
		if _, err := s.Store.FindAgentConfig(ctx, q, k.family, agentID); err == nil {
			agentType := agent.AgentType
			out = &AgentConfigDTO{ID: agentID, AgentType: &agentType}
			return nil
		} else if !db.IsNoRows(err) {
			return err
		}
		if !equalFoldIgnoreCase(agent.AgentType, k.family.ConfigType) {
			// The Java services switched on the agent type before creating the
			// configuration, so a type with no configuration subclass - a
			// Zigbee event agent - was refused here rather than half-written.
			return httpx.BadRequest("Unsupported " + k.family.ConfigTypeLabel +
				" agent type: " + agent.AgentType)
		}
		actor := acc.UserID()
		if err := s.Store.InsertAgentConfig(ctx, q, k.family, &AgentConfig{ID: agentID, CreatedBy: &actor}); err != nil {
			return err
		}
		agent.Configured = true
		agent.UpdatedBy = &actor
		if err := s.Store.UpdateAgent(ctx, q, k.family, agent); err != nil {
			return err
		}
		agentType := agent.AgentType
		out = &AgentConfigDTO{ID: agentID, AgentType: &agentType}
		return nil
	})
	return out, err
}

// ============================================================
// Writes
// ============================================================

// AddAgentInput is the family-agnostic create payload, which the three Java list
// DTOs shared.
type AddAgentInput struct {
	ID             *string `json:"id"`
	OrganizationID *string `json:"organizationId"`
	AgentType      string  `json:"agentType"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Configured     *bool   `json:"configured"`
}

// AddAgent creates an agent, optionally binding it to an organization.
//
// The CRM family additionally creates the external-organization row that every
// CRM agent owns, because the CRM binding is to an external company rather than
// to a configuration: the credentials live in yc_agent_configs, the external
// company in crm_organizations, and both hang off the agent.
func (s *Service) AddAgent(ctx context.Context, acc *Access, k *AgentKind, in *AddAgentInput) (any, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	if in == nil {
		return nil, httpx.BadRequest("Request data for " + k.Label + " Agent is empty")
	}
	agentType, ok := k.resolveType(in.AgentType)
	if !ok {
		return nil, httpx.BadRequest("Not known " + k.Label + " agent type")
	}
	if blank(in.Name) {
		return nil, httpx.BadRequest("name must not be blank")
	}
	actor := acc.UserID()

	var item any
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		// A bound agent needs its organization to exist, and the CRM family
		// refuses to share one organization between two agents.
		var org *Organization
		if in.OrganizationID != nil && !blank(*in.OrganizationID) {
			var err error
			org, err = s.Store.FindOrg(ctx, q, *in.OrganizationID)
			if err != nil {
				if db.IsNoRows(err) {
					return httpx.BadRequest("Not exists organization")
				}
				return err
			}
			if k.UniquePerOrg {
				existing, err := s.Store.ListAgentsByOrg(ctx, q, k.family, *in.OrganizationID)
				if err != nil {
					return err
				}
				if len(existing) > 0 {
					return httpx.Conflict("Crm agent for organization " + *in.OrganizationID + " already exists")
				}
			}
		}
		agent := &Agent{
			Discriminator: agentType.Discriminator,
			AgentType:     agentType.Value,
			Name:          in.Name,
			Description:   in.Description,
			Configured:    false,
			CreatedBy:     &actor,
		}
		if k.family.HasCRMOrg {
			crmOrg := &CRMOrganization{
				Discriminator: agentType.Discriminator,
				CreatedBy:     &actor,
			}
			if err := s.Store.InsertCRMOrg(ctx, q, crmOrg); err != nil {
				return err
			}
			agent.CRMOrganizationID = &crmOrg.ID
		}
		if org != nil {
			agent.OrganizationID = &org.ID
		}
		if err := s.Store.InsertAgent(ctx, q, k.family, agent); err != nil {
			return err
		}
		if org != nil {
			// setOrganization(org) turned the organization's flag on before the
			// insert, and the save below is what made it durable. The Java
			// service published no event here, so neither does this: the
			// organization was already announced, and only a binding change
			// needs announcing.
			k.setFlag(org, true)
			org.UpdatedBy = &actor
			if err := s.Store.SaveOrgFlags(ctx, q, org); err != nil {
				return err
			}
		}
		var err error
		item, err = s.agentItem(ctx, acc, k, agent, q)
		return err
	})
	return item, err
}

// UpdateAgent renames an agent and, when the request moves it, rebinds it.
//
// Rebinding is a separate step because it has its own authorization rule: a
// caller who may edit the agent may not move it between organizations, since
// that changes which organization can see the video streams it collects.
func (s *Service) UpdateAgent(ctx context.Context, acc *Access, k *AgentKind, agentID string, in *AgentItemInput) (any, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if in == nil {
		return nil, httpx.BadRequest("Request data for " + k.Label + " Agent is empty")
	}
	if in.ID == nil || !equalFoldIgnoreCase(agentID, *in.ID) {
		return nil, httpx.BadRequest("Request Id not equal " + k.Label + " Agent id=" + deref(in.ID))
	}
	actor := acc.UserID()
	var item any
	var events []*common.OrgChangeEvent

	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		stored, err := s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				return k.agentNotFound(agentID)
			}
			return err
		}
		storedOrgID := deref(stored.OrganizationID)
		if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(storedOrgID) {
			return httpx.Forbidden(k.Label + " Agent with id " + agentID + " not allowed for change")
		}
		newOrgID := deref(in.OrganizationID)
		changeOrg := storedOrgID != newOrgID
		if changeOrg && !acc.IsSuperUser() {
			return httpx.Forbidden(k.Label + " Agent organization binding not allowed")
		}
		if stored.Name != in.Name {
			stored.Name = in.Name
		}
		if deref(stored.Description) != deref(in.Description) {
			stored.Description = in.Description
		}
		stored.UpdatedBy = &actor
		if err := s.Store.UpdateAgent(ctx, q, k.family, stored); err != nil {
			return err
		}
		if changeOrg {
			if in.OrganizationID != nil && !blank(*in.OrganizationID) {
				evts, err := s.bindAgent(ctx, q, acc, k, stored, *in.OrganizationID)
				if err != nil {
					return err
				}
				events = evts
			} else {
				evts, err := s.unbindAgent(ctx, q, acc, k, stored)
				if err != nil {
					return err
				}
				events = evts
			}
			stored, err = s.Store.FindAgent(ctx, q, k.family, agentID)
			if err != nil {
				return err
			}
		}
		item, err = s.agentItem(ctx, acc, k, stored, q)
		return err
	})
	if err != nil {
		return nil, err
	}
	// Published after the commit: the Java service sent these from inside the
	// transaction, so a rollback after the send left the consumers holding a
	// binding that never existed here.
	for _, evt := range events {
		s.Pub.publishMon(ctx, evt)
	}
	return item, nil
}

// AgentItemInput is the family-agnostic update payload.
type AgentItemInput struct {
	ID             *string         `json:"id"`
	OrganizationID *string         `json:"organizationId"`
	Name           string          `json:"name"`
	Description    *string         `json:"description"`
	Configured     *bool           `json:"configured"`
	Config         *AgentConfigDTO `json:"config"`
}

// DeleteAgent removes an agent, unbinding it first so the organization's flag is
// corrected and the consumers are told.
func (s *Service) DeleteAgent(ctx context.Context, acc *Access, k *AgentKind, agentID string) error {
	if !acc.IsSuperUser() {
		return httpx.Forbidden("Access denied")
	}
	actor := acc.UserID()
	var events []*common.OrgChangeEvent
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		curr, err := s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				// Java called deleteById unconditionally, which threw for an
				// unknown id and surfaced as a 500.
				return k.agentNotFound(agentID)
			}
			return err
		}
		if curr.OrganizationID != nil {
			evts, err := s.unbindAgent(ctx, q, acc, k, curr)
			if err != nil {
				return err
			}
			events = evts
		}
		found, err := s.Store.DeleteAgent(ctx, q, k.family, agentID)
		if err != nil {
			return err
		}
		if !found {
			return k.agentNotFound(agentID)
		}
		if k.family.HasCRMOrg && curr.CRMOrganizationID != nil {
			if _, err := s.Store.DeleteCRMOrg(ctx, q, *curr.CRMOrganizationID); err != nil {
				return err
			}
		}
		_ = actor
		return nil
	})
	if err != nil {
		return err
	}
	for _, evt := range events {
		s.Pub.publishMon(ctx, evt)
	}
	return nil
}

// UnbindAgent detaches an agent from its organization.
func (s *Service) UnbindAgent(ctx context.Context, acc *Access, k *AgentKind, agentID string) (any, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	var item any
	var events []*common.OrgChangeEvent
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		stored, err := s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				return k.agentNotFound(agentID)
			}
			return err
		}
		events, err = s.unbindAgent(ctx, q, acc, k, stored)
		if err != nil {
			return err
		}
		stored, err = s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			return err
		}
		item, err = s.agentItem(ctx, acc, k, stored, q)
		return err
	})
	if err != nil {
		return nil, err
	}
	for _, evt := range events {
		s.Pub.publishMon(ctx, evt)
	}
	return item, nil
}

// BindAgent attaches an agent to an organization.
func (s *Service) BindAgent(ctx context.Context, acc *Access, k *AgentKind, agentID, orgID string) (any, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	var item any
	var events []*common.OrgChangeEvent
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		stored, err := s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				return k.agentNotFound(agentID)
			}
			return err
		}
		events, err = s.bindAgent(ctx, q, acc, k, stored, orgID)
		if err != nil {
			return err
		}
		stored, err = s.Store.FindAgent(ctx, q, k.family, agentID)
		if err != nil {
			return err
		}
		item, err = s.agentItem(ctx, acc, k, stored, q)
		return err
	})
	if err != nil {
		return nil, err
	}
	for _, evt := range events {
		s.Pub.publishMon(ctx, evt)
	}
	return item, nil
}

// unbindAgent clears the agent's organization and, when this was the family's
// last agent there, turns the organization's flag off.
//
// The flag is only turned off when the agent really was the last one, so an
// organization with three event agents keeps its flag while any remain bound.
func (s *Service) unbindAgent(ctx context.Context, q db.Querier, acc *Access, k *AgentKind, stored *Agent) ([]*common.OrgChangeEvent, error) {
	actor := acc.UserID()
	var events []*common.OrgChangeEvent
	currOrgID := deref(stored.OrganizationID)
	stored.OrganizationID = nil
	stored.UpdatedBy = &actor
	if err := s.Store.UpdateAgent(ctx, q, k.family, stored); err != nil {
		return nil, err
	}
	if currOrgID == "" {
		return nil, nil
	}
	org, err := s.Store.FindOrg(ctx, q, currOrgID)
	if err != nil {
		if db.IsNoRows(err) {
			// The organization is gone. Its agents were nulled by the foreign
			// key, so this agent cannot still be bound to it; nothing to report.
			return nil, nil
		}
		return nil, err
	}
	remaining, err := s.Store.ListAgentsByOrg(ctx, q, k.family, currOrgID)
	if err != nil {
		return nil, err
	}
	if len(remaining) > 0 || !k.flag(org) {
		return nil, nil
	}
	k.setFlag(org, false)
	org.UpdatedBy = &actor
	if err := s.Store.SaveOrgFlags(ctx, q, org); err != nil {
		return nil, err
	}
	events = append(events, orgChangeEvent(org, k.bindMode))
	return events, nil
}

// bindAgent moves an agent onto an organization.
//
// Three things can happen, in this order: the agent's previous organization may
// lose its flag, the organization it is moving to may gain one, and whatever
// agent already occupied the target organization (only possible for CRM, where
// the binding is unique) is displaced. An event is produced for each flag that
// actually changed, and no event for a flag that was already correct.
func (s *Service) bindAgent(ctx context.Context, q db.Querier, acc *Access, k *AgentKind, stored *Agent, orgID string) ([]*common.OrgChangeEvent, error) {
	actor := acc.UserID()
	var events []*common.OrgChangeEvent

	currOrgID := deref(stored.OrganizationID)
	if currOrgID != "" {
		currOrg, err := s.Store.FindOrg(ctx, q, currOrgID)
		if err != nil && !db.IsNoRows(err) {
			return nil, err
		}
		if currOrg != nil {
			siblings, err := s.Store.ListAgentsByOrg(ctx, q, k.family, currOrgID)
			if err != nil {
				return nil, err
			}
			// Only the family's last agent turns the flag off. Java compared the
			// whole list against this agent's id, which is true only when the
			// list holds nothing else, so the effect is the same.
			last := true
			for i := range siblings {
				if siblings[i].ID != stored.ID {
					last = false
					break
				}
			}
			if last && k.flag(currOrg) {
				k.setFlag(currOrg, false)
				currOrg.UpdatedBy = &actor
				if err := s.Store.SaveOrgFlags(ctx, q, currOrg); err != nil {
					return nil, err
				}
				events = append(events, orgChangeEvent(currOrg, k.bindMode))
			}
		}
		stored.OrganizationID = nil
		stored.UpdatedBy = &actor
		if err := s.Store.UpdateAgent(ctx, q, k.family, stored); err != nil {
			return nil, err
		}
	}

	newOrg, err := s.Store.FindOrg(ctx, q, orgID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Organization with id " + orgID + " not found")
		}
		return nil, err
	}

	// The target organization may already hold an agent of this family. For CRM
	// that is impossible, because the binding is unique; for the other two the
	// displaced agent is simply unbound, and its organization keeps its flag
	// because the incoming agent takes its place.
	if occupants, err := s.Store.ListAgentsByOrg(ctx, q, k.family, orgID); err != nil {
		return nil, err
	} else {
		for i := range occupants {
			if occupants[i].ID == stored.ID {
				continue
			}
			displaced := occupants[i]
			displaced.OrganizationID = nil
			displaced.UpdatedBy = &actor
			if err := s.Store.UpdateAgent(ctx, q, k.family, &displaced); err != nil {
				return nil, err
			}
		}
	}

	stored.OrganizationID = &newOrg.ID
	stored.UpdatedBy = &actor
	if err := s.Store.UpdateAgent(ctx, q, k.family, stored); err != nil {
		return nil, err
	}

	// The Java service published this event before the binding, with the flag
	// still false, so the consumer's copy never learned that the organization
	// had gained an agent. Here the flag is set and persisted first, and the
	// event is published after the transaction commits. See MIGRATION.md,
	// "Fixed defects".
	if !k.flag(newOrg) {
		k.setFlag(newOrg, true)
		newOrg.UpdatedBy = &actor
		if err := s.Store.SaveOrgFlags(ctx, q, newOrg); err != nil {
			return nil, err
		}
		events = append(events, orgChangeEvent(newOrg, k.bindMode))
	}
	return events, nil
}
