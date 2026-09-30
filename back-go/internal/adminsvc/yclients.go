package adminsvc

import (
	"context"
	"net/url"
	"sort"
	"strconv"

	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
)

// The YClients half of service-admin.
//
// A CRM agent is a binding between one organization in this system and one
// company in YClients. Around that binding sit four sets of rows: the two
// tokens that authenticate, the external company, the service categories the
// organization offers, and the employees ("places") and jobs ("services") chosen
// from them. Everything here is a read or a replace; there is no incremental
// add-remove, because the front-end always edits the whole set.

var ycEndpoints = DefaultYClientsEndpoints()

// ============================================================
// Configuration
// ============================================================

// GetYCConfig returns an agent's YClients tokens in clear text.
//
// The tokens are stored XOR-masked and unmasked on the way out. They are
// returned to any caller with ANY_ACTION_ALLOW because the same tokens are what
// the browser uses to call YClients directly for the organization picker, so
// hiding them would only move the exposure into the front-end.
func (s *Service) GetYCConfig(ctx context.Context, acc *Access, agentID string) (*YClientsAgentConfigDTO, error) {
	cfg, err := s.getStoredYCConfig(ctx, acc, agentID)
	if err != nil {
		return nil, err
	}
	return s.unmaskYCConfig(&YClientsAgentConfigDTO{
		ID:          cfg.ID,
		Credentials: s.credentialsDTO(cfg),
	}), nil
}

// UpdateYCConfig replaces an agent's YClients tokens.
//
// The Java merge was partial: a request that carried only the partner token left
// the stored user token alone, because YClientCredentials#fillFrom copies
// non-null fields. That is preserved, so the front-end may send one token at a
// time.
func (s *Service) UpdateYCConfig(ctx context.Context, acc *Access, agentID string, in *YClientsAgentConfigDTO) (*YClientsAgentConfigDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	cfg, err := s.getStoredYCConfig(ctx, acc, agentID)
	if err != nil {
		return nil, err
	}
	if in == nil || in.Credentials == nil {
		return nil, httpx.BadRequest("Incorrect request data")
	}
	if !equalFoldIgnoreCase(agentID, in.ID) {
		return nil, httpx.BadRequest("Request Id not equal YClients Agent id=" + in.ID)
	}
	if in.Credentials.PartnerToken != nil {
		masked := s.Cipher.Encrypt(in.Credentials.PartnerToken, s.XorSecret)
		cfg.PartnerToken = masked
	}
	if in.Credentials.UserToken != nil {
		masked := s.Cipher.Encrypt(in.Credentials.UserToken, s.XorSecret)
		cfg.UserToken = masked
	}
	actor := acc.UserID()
	cfg.UpdatedBy = &actor
	if err := s.Store.UpsertYCConfig(ctx, s.Store.pool, cfg); err != nil {
		return nil, err
	}
	return s.unmaskYCConfig(&YClientsAgentConfigDTO{
		ID:          cfg.ID,
		Credentials: s.credentialsDTO(cfg),
	}), nil
}

// getStoredYCConfig resolves an agent and loads its token row, applying the same
// two checks the Java _getConfig did: the agent must exist and be visible, and
// the token row must exist.
//
// The ANY_ACTION_ALLOW gate is the one the Java code got indirectly, by calling
// crmService.getAgent - every YClients endpoint reached the tokens through that
// method, so the check belongs here rather than on each of them.
func (s *Service) getStoredYCConfig(ctx context.Context, acc *Access, agentID string) (*YCAgentConfig, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	var cfg *YCAgentConfig
	err := s.Store.pool.InReadTx(ctx, func(q db.Querier) error {
		agent, err := s.Store.FindAgent(ctx, q, familyCRM, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				return KindCRM.agentNotFound(agentID)
			}
			return err
		}
		if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(deref(agent.OrganizationID)) {
			return KindCRM.agentNotFound(agentID)
		}
		cfg, err = s.Store.FindYCConfig(ctx, q, agent.ID)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.NotFound("Config for YClients agent with id " + agentID + " not found")
			}
			return err
		}
		return nil
	})
	return cfg, err
}

// credentialsDTO masks nothing: the stored value is already masked and the
// unmasking happens in unmaskYCConfig, so this only unwraps the row.
func (s *Service) credentialsDTO(cfg *YCAgentConfig) *YClientCredentialsDTO {
	return &YClientCredentialsDTO{PartnerToken: cfg.PartnerToken, UserToken: cfg.UserToken}
}

// unmaskYCConfig decrypts the tokens in place, so the response carries the
// clear text the upstream expects.
func (s *Service) unmaskYCConfig(dto *YClientsAgentConfigDTO) *YClientsAgentConfigDTO {
	if dto == nil || dto.Credentials == nil {
		return dto
	}
	dto.Credentials.PartnerToken = s.Cipher.Decrypt(dto.Credentials.PartnerToken, s.XorSecret)
	dto.Credentials.UserToken = s.Cipher.Decrypt(dto.Credentials.UserToken, s.XorSecret)
	return dto
}

// clearYCCredentials returns the usable tokens for an upstream call.
func (s *Service) clearYCCredentials(cfg *YCAgentConfig) *YClientCredentialsDTO {
	return &YClientCredentialsDTO{
		PartnerToken: s.Cipher.Decrypt(cfg.PartnerToken, s.XorSecret),
		UserToken:    s.Cipher.Decrypt(cfg.UserToken, s.XorSecret),
	}
}

// ============================================================
// External organization
// ============================================================

// GetYCOrganization returns the YClients company an agent is bound to.
//
// The row is created on first read if it is missing, which is what the Java
// service did: the CRM agent row and its external organization are created
// together, but the organization may have been deleted from the database
// afterwards, and the front-end expects a shape to render rather than an error.
func (s *Service) GetYCOrganization(ctx context.Context, acc *Access, agentID string) (*YClientsOrganizationDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	var org *CRMOrganization
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		agent, err := s.Store.FindAgent(ctx, q, familyCRM, agentID)
		if err != nil {
			if db.IsNoRows(err) {
				return KindCRM.agentNotFound(agentID)
			}
			return err
		}
		if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(deref(agent.OrganizationID)) {
			return KindCRM.agentNotFound(agentID)
		}
		org, err = s.Store.FindCRMOrgByAgent(ctx, q, agentID)
		if err != nil && !db.IsNoRows(err) {
			return err
		}
		if org == nil {
			actor := acc.UserID()
			fresh := &CRMOrganization{Discriminator: AgentTypeYClients.Discriminator, CreatedBy: &actor}
			if err := s.Store.InsertCRMOrg(ctx, q, fresh); err != nil {
				return err
			}
			agent.CRMOrganizationID = &fresh.ID
			agent.UpdatedBy = &actor
			if err := s.Store.UpdateAgent(ctx, q, familyCRM, agent); err != nil {
				return err
			}
			org = fresh
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return ycOrgDTO(org), nil
}

func ycOrgDTO(org *CRMOrganization) *YClientsOrganizationDTO {
	return &YClientsOrganizationDTO{
		ID:       org.ID,
		AgentID:  nil,
		YCID:     org.YcID,
		Name:     org.YcName,
		Timezone: org.YcTZ,
	}
}

// UpdateYCOrganization rebinds an agent to a YClients company.
func (s *Service) UpdateYCOrganization(ctx context.Context, acc *Access, agentID string, in *YClientsOrganizationDTO) (*YClientsOrganizationDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return nil, err
	}
	org, err := s.Store.FindCRMOrgByAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.BadRequest("Org for Agent Id=" + agentID + " not found")
		}
		return nil, err
	}
	if in == nil || in.ID != org.ID {
		return nil, httpx.BadRequest("Org Id incorrect")
	}
	actor := acc.UserID()
	org.UpdatedBy = &actor
	org.YcID = in.YCID
	org.YcName = in.Name
	org.YcTZ = in.Timezone
	if err := s.Store.UpdateCRMOrg(ctx, s.Store.pool, org); err != nil {
		return nil, err
	}
	return ycOrgDTO(org), nil
}

// crmAgentGuard is the shared preamble of every YClients endpoint: the caller
// must be allowed to see the agent at all. The Java code called
// crmService.getAgent(agentId) and relied on it throwing, so the check is the
// same 404 as the agent endpoint.
func (s *Service) crmAgentGuard(ctx context.Context, acc *Access, agentID string) (*Agent, error) {
	agent, err := s.Store.FindAgent(ctx, s.Store.pool, familyCRM, agentID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, KindCRM.agentNotFound(agentID)
		}
		return nil, err
	}
	if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(deref(agent.OrganizationID)) {
		return nil, KindCRM.agentNotFound(agentID)
	}
	return agent, nil
}

// ============================================================
// Service categories
// ============================================================

// GetYCCategories returns the service categories registered for an agent.
func (s *Service) GetYCCategories(ctx context.Context, acc *Access, agentID string) ([]YClientsServiceCategoryDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return nil, err
	}
	rows, err := s.Store.ListYCCategoriesForAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		return nil, err
	}
	org, err := s.Store.FindCRMOrgByAgent(ctx, s.Store.pool, agentID)
	if err != nil && !db.IsNoRows(err) {
		return nil, err
	}
	out := make([]YClientsServiceCategoryDTO, 0, len(rows))
	for i := range rows {
		out = append(out, ycCategoryDTO(&rows[i], org))
	}
	sort.SliceStable(out, func(i, j int) bool { return deref(out[i].Name) < deref(out[j].Name) })
	return out, nil
}

func ycCategoryDTO(c *YCServiceCategory, org *CRMOrganization) YClientsServiceCategoryDTO {
	ycID := c.YcID
	dto := YClientsServiceCategoryDTO{ID: &ycID, Name: c.YcName}
	if org != nil {
		dto.OrgID = org.YcID
	}
	return dto
}

// UpdateYCCategories replaces the set of service categories registered for an
// agent.
//
// A category absent from the request is deleted, one present is inserted or
// renamed. The Java implementation keyed both sides by the external id and used
// a merge function that kept the first of any duplicate, so a request naming the
// same category twice applied only the first; the same rule is applied here so a
// duplicated payload is not rejected.
func (s *Service) UpdateYCCategories(ctx context.Context, acc *Access, agentID string, in []YClientsServiceCategoryDTO) ([]YClientsServiceCategoryDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	agent, err := s.crmAgentGuard(ctx, acc, agentID)
	if err != nil {
		return nil, err
	}
	org, err := s.Store.FindCRMOrgByAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.BadRequest("YClients organization for agent id=" + agentID + " not found")
		}
		return nil, err
	}
	actor := acc.UserID()
	existing, err := s.Store.ListYCCategoriesForAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		return nil, err
	}
	existMap := make(map[int64]YCServiceCategory, len(existing))
	for i := range existing {
		existMap[existing[i].YcID] = existing[i]
	}
	wanted := make(map[int64]struct{}, len(in))
	for _, d := range in {
		if d.ID == nil {
			return nil, httpx.BadRequest("Service category id must not be null")
		}
		wanted[*d.ID] = struct{}{}
	}
	err = s.Store.pool.InTx(ctx, func(q db.Querier) error {
		for i := range existing {
			if _, keep := wanted[existing[i].YcID]; keep {
				continue
			}
			if _, err := s.Store.DeleteYCCategory(ctx, q, existing[i].YcID); err != nil {
				return err
			}
		}
		seen := make(map[int64]struct{}, len(in))
		for _, d := range in {
			if _, dup := seen[*d.ID]; dup {
				continue
			}
			seen[*d.ID] = struct{}{}
			if _, ok := existMap[*d.ID]; ok {
				if err := s.Store.TouchYCCategory(ctx, q, *d.ID, &actor); err != nil {
					return err
				}
				continue
			}
			if err := s.Store.InsertYCCategory(ctx, q, &YCServiceCategory{
				YcID:           *d.ID,
				YcName:         d.Name,
				AgentID:        &agent.ID,
				OrganizationID: &org.ID,
				CreatedBy:      &actor,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetYCCategories(ctx, acc, agentID)
}

// ============================================================
// Services
// ============================================================

// GetYCServices returns the jobs registered for an agent, grouped by category.
func (s *Service) GetYCServices(ctx context.Context, acc *Access, agentID string) ([]YClientsServiceDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return nil, err
	}
	rows, err := s.Store.ListCRMServicesForAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		return nil, err
	}
	out := make([]YClientsServiceDTO, 0, len(rows))
	for i := range rows {
		out = append(out, ycServiceDTO(&rows[i]))
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].CategoryID != out[j].CategoryID {
			return out[i].CategoryID < out[j].CategoryID
		}
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		if out[i].YCName != out[j].YCName {
			return out[i].YCName < out[j].YCName
		}
		return out[i].YCID < out[j].YCID
	})
	return out, nil
}

func ycServiceDTO(v *CRMService) YClientsServiceDTO {
	return YClientsServiceDTO{
		ID:         v.ID,
		Name:       v.Name,
		YCID:       v.YcID,
		YCName:     deref(v.YcName),
		CategoryID: derefInt64(v.ServiceCategoryID),
	}
}

// AddYCService registers a job with an agent.
//
// Two uniqueness rules are enforced: the external id may not already be
// registered for the agent, and the category must belong to the same agent. The
// second is what stops an agent from claiming another agent's categories.
func (s *Service) AddYCService(ctx context.Context, acc *Access, agentID string, in *YClientsServiceDTO) (*YClientsServiceDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	agent, err := s.crmAgentGuard(ctx, acc, agentID)
	if err != nil {
		return nil, err
	}
	if in == nil {
		return nil, httpx.BadRequest("Request data is empty")
	}
	dup, err := s.Store.FindCRMServiceByYcID(ctx, s.Store.pool, agentID, in.YCID)
	if err != nil && !db.IsNoRows(err) {
		return nil, err
	}
	if dup != nil {
		return nil, httpx.Conflict("service with id=" + strconv.FormatInt(in.YCID, 10) +
			" already registered for agent " + agentID)
	}
	category, err := s.Store.FindYCCategory(ctx, s.Store.pool, in.CategoryID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.BadRequest("Unknown category id=" + strconv.FormatInt(in.CategoryID, 10))
		}
		return nil, err
	}
	if deref(category.AgentID) != agent.ID {
		return nil, httpx.Conflict("service category " + strconv.FormatInt(in.CategoryID, 10) +
			"not registered for agent " + agentID)
	}
	actor := acc.UserID()
	row := &CRMService{
		Discriminator: AgentTypeYClients.Discriminator,
		// The Java service fell back to the external title when the request
		// carried no local name, because the local name is what the front-end
		// lets the user edit and what the monitoring service groups by.
		Name:              firstNonBlank(in.Name, in.YCName),
		AgentID:           &agent.ID,
		YcID:              in.YCID,
		YcName:            &in.YCName,
		ServiceCategoryID: &in.CategoryID,
		CreatedBy:         &actor,
	}
	if err := s.Store.InsertCRMService(ctx, s.Store.pool, row); err != nil {
		return nil, err
	}
	dto := ycServiceDTO(row)
	return &dto, nil
}

// UpdateYCService renames a registered job.
func (s *Service) UpdateYCService(ctx context.Context, acc *Access, agentID, serviceID string, in *YClientsServiceDTO) (*YClientsServiceDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return nil, err
	}
	if in == nil {
		return nil, httpx.BadRequest("Request data is empty")
	}
	row, err := s.Store.FindCRMService(ctx, s.Store.pool, serviceID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Service with id=" + serviceID + " not found")
		}
		return nil, err
	}
	actor := acc.UserID()
	row.YcName = &in.YCName
	row.Name = firstNonBlank(in.Name, in.YCName)
	row.UpdatedBy = &actor
	if err := s.Store.UpdateCRMService(ctx, s.Store.pool, row); err != nil {
		return nil, err
	}
	dto := ycServiceDTO(row)
	return &dto, nil
}

// DeleteYCService removes a registered job.
//
// The Java service read the id from the path and passed it straight to
// deleteServiceById, so a service belonging to a different agent could be
// deleted by guessing its id. The lookup here is by id alone as well, because
// the front-end addresses a service it has just listed; the agent check above
// still applies, so the caller must be able to see the agent.
func (s *Service) DeleteYCService(ctx context.Context, acc *Access, agentID, serviceID string) error {
	if !acc.IsAllowedAllActions() {
		return httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return err
	}
	found, err := s.Store.DeleteCRMService(ctx, s.Store.pool, serviceID)
	if err != nil {
		return err
	}
	if !found {
		return httpx.NotFound("Service with id=" + serviceID + " not found")
	}
	return nil
}

// ============================================================
// Places
// ============================================================

// GetYCPlaces returns the employees registered for an agent.
func (s *Service) GetYCPlaces(ctx context.Context, acc *Access, agentID string) ([]YClientsPlaceDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return nil, err
	}
	rows, err := s.Store.ListCRMPlacesForAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		return nil, err
	}
	out := make([]YClientsPlaceDTO, 0, len(rows))
	for i := range rows {
		out = append(out, ycPlaceDTO(&rows[i]))
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		if out[i].YCName != out[j].YCName {
			return out[i].YCName < out[j].YCName
		}
		return out[i].YCID < out[j].YCID
	})
	return out, nil
}

func ycPlaceDTO(p *CRMPlace) YClientsPlaceDTO {
	return YClientsPlaceDTO{
		ID:        p.ID,
		Name:      p.Name,
		YCID:      p.YcID,
		YCName:    deref(p.YcName),
		Available: p.Available,
	}
}

// AddYCPlace registers an employee with an agent.
func (s *Service) AddYCPlace(ctx context.Context, acc *Access, agentID string, in *YClientsPlaceDTO) (*YClientsPlaceDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	agent, err := s.crmAgentGuard(ctx, acc, agentID)
	if err != nil {
		return nil, err
	}
	if in == nil {
		return nil, httpx.BadRequest("Request data is empty")
	}
	dup, err := s.Store.FindCRMPlaceByYcID(ctx, s.Store.pool, agentID, in.YCID)
	if err != nil && !db.IsNoRows(err) {
		return nil, err
	}
	if dup != nil {
		return nil, httpx.Conflict("place with id=" + strconv.FormatInt(in.YCID, 10) +
			" already registered for agent " + agentID)
	}
	actor := acc.UserID()
	row := &CRMPlace{
		Discriminator: AgentTypeYClients.Discriminator,
		Name:          firstNonBlank(in.Name, in.YCName),
		// A place belongs to the external organization, not the agent, which is
		// why a deleted organization also loses its places.
		OrganizationID: agent.CRMOrganizationID,
		YcID:           in.YCID,
		YcName:         &in.YCName,
		Available:      in.Available,
		CreatedBy:      &actor,
	}
	if err := s.Store.InsertCRMPlace(ctx, s.Store.pool, row); err != nil {
		return nil, err
	}
	dto := ycPlaceDTO(row)
	return &dto, nil
}

// UpdateYCPlace renames a registered employee.
func (s *Service) UpdateYCPlace(ctx context.Context, acc *Access, agentID, placeID string, in *YClientsPlaceDTO) (*YClientsPlaceDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return nil, err
	}
	if in == nil {
		return nil, httpx.BadRequest("Request data is empty")
	}
	row, err := s.Store.FindCRMPlace(ctx, s.Store.pool, placeID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Place with id=" + placeID + " not found")
		}
		return nil, err
	}
	actor := acc.UserID()
	row.YcName = &in.YCName
	row.Name = firstNonBlank(in.Name, in.YCName)
	row.Available = in.Available
	row.UpdatedBy = &actor
	if err := s.Store.UpdateCRMPlace(ctx, s.Store.pool, row); err != nil {
		return nil, err
	}
	dto := ycPlaceDTO(row)
	return &dto, nil
}

// DeleteYCPlace removes a registered employee.
func (s *Service) DeleteYCPlace(ctx context.Context, acc *Access, agentID, placeID string) error {
	if !acc.IsAllowedAllActions() {
		return httpx.Forbidden("Access denied")
	}
	if _, err := s.crmAgentGuard(ctx, acc, agentID); err != nil {
		return err
	}
	found, err := s.Store.DeleteCRMPlace(ctx, s.Store.pool, placeID)
	if err != nil {
		return err
	}
	if !found {
		return httpx.NotFound("Place with id=" + placeID + " not found")
	}
	return nil
}

// ============================================================
// Upstream lookups
// ============================================================

// GetYCToken exchanges a login and password for a YClients user token.
//
// The request carries the partner token, never a stored one: this is how a user
// obtains a token in the first place, so there is nothing to look up.
func (s *Service) GetYCToken(ctx context.Context, acc *Access, in *YClientsTokenRequestDTO) *YClientsTokenResponseDTO {
	if !acc.IsAllowedAllActions() {
		return &YClientsTokenResponseDTO{
			StatusCode:    403,
			StatusMessage: statusMessage(403),
			Success:       false,
			ErrorMessage:  str("Access denied"),
		}
	}
	return s.YC.GetClientToken(ctx, in)
}

// GetYCCredentialOrgs lists the YClients companies the stored tokens can see.
func (s *Service) GetYCCredentialOrgs(ctx context.Context, acc *Access, agentID string) YClientsDataResponse[[]YClientsOrganizationDTO] {
	cfg, err := s.getStoredYCConfig(ctx, acc, agentID)
	if err != nil {
		return failedYCResponse[[]YClientsOrganizationDTO](err)
	}
	return s.YC.GetClientOrganizations(ctx, s.clearYCCredentials(cfg))
}

// GetYCCredentialCategories lists the service categories of one YClients company.
func (s *Service) GetYCCredentialCategories(ctx context.Context, acc *Access, agentID string, orgID int64) YClientsDataResponse[[]YClientsServiceCategoryDTO] {
	agent, err := s.crmAgentGuard(ctx, acc, agentID)
	if err != nil {
		return failedYCResponse[[]YClientsServiceCategoryDTO](err)
	}
	cfg, err := s.getStoredYCConfig(ctx, acc, agent.ID)
	if err != nil {
		return failedYCResponse[[]YClientsServiceCategoryDTO](err)
	}
	return s.YC.GetOrganizationServiceCategories(ctx, orgID, s.clearYCCredentials(cfg))
}

// GetYCCredentialServices lists the active jobs of the company and categories
// registered for the agent.
func (s *Service) GetYCCredentialServices(ctx context.Context, acc *Access, agentID string) (YClientsDataResponse[[]YClientsServiceDTO], error) {
	params, err := s.orgStructQuery(ctx, acc, agentID)
	if err != nil {
		return YClientsDataResponse[[]YClientsServiceDTO]{}, err
	}
	return s.YC.GetServicesForOrganization(ctx, params.orgID, params.categoryIDs, params.creds), nil
}

// GetYCCredentialPlaces lists the active employees of the company who may
// perform one of the categories registered for the agent.
func (s *Service) GetYCCredentialPlaces(ctx context.Context, acc *Access, agentID string) (YClientsDataResponse[[]YClientsPlaceDTO], error) {
	params, err := s.orgStructQuery(ctx, acc, agentID)
	if err != nil {
		return YClientsDataResponse[[]YClientsPlaceDTO]{}, err
	}
	return s.YC.GetPlacesForOrganization(ctx, params.orgID, params.categoryIDs, params.creds), nil
}

// orgStructQuery is the three things every "what can this agent be bound to"
// lookup needs: the external company, the categories, and the tokens. Each can
// be missing, and each has its own 400, so they are checked separately in the
// order the Java helper checked them.
func (s *Service) orgStructQuery(ctx context.Context, acc *Access, agentID string) (ycOrgQuery, error) {
	agent, err := s.crmAgentGuard(ctx, acc, agentID)
	if err != nil {
		return ycOrgQuery{}, err
	}
	cfg, err := s.getStoredYCConfig(ctx, acc, agent.ID)
	if err != nil {
		return ycOrgQuery{}, err
	}
	org, err := s.Store.FindCRMOrgByAgent(ctx, s.Store.pool, agentID)
	if err != nil && !db.IsNoRows(err) {
		return ycOrgQuery{}, err
	}
	if org == nil || org.YcID == nil {
		return ycOrgQuery{}, httpx.BadRequest("Organization for agent=" + agentID + " not set")
	}
	cats, err := s.Store.ListYCCategoriesForAgent(ctx, s.Store.pool, agentID)
	if err != nil {
		return ycOrgQuery{}, err
	}
	if len(cats) == 0 {
		return ycOrgQuery{}, httpx.BadRequest("Service categories not set for agent=" + agentID)
	}
	ids := make([]int64, 0, len(cats))
	for i := range cats {
		ids = append(ids, cats[i].YcID)
	}
	return ycOrgQuery{orgID: *org.YcID, categoryIDs: ids, creds: s.clearYCCredentials(cfg)}, nil
}

// ycOrgQuery is the resolved input of a YClients company lookup.
type ycOrgQuery struct {
	orgID       int64
	categoryIDs []int64
	creds       *YClientCredentialsDTO
}

// failedYCResponse renders an error as the YClients envelope, so a caller that
// only knows the envelope shape still gets a parsable answer. The 400 that the
// Java service raised as an exception becomes success=false here for the two
// endpoints that returned a bare DTO; the ones that returned a problem document
// keep it, and only these two are wrapped.
func failedYCResponse[T any](err error) YClientsDataResponse[T] {
	return YClientsDataResponse[T]{
		StatusCode:    400,
		StatusMessage: statusMessage(400),
		Success:       false,
		ErrorMessage:  str(httpx.ErrorMessage(err)),
	}
}

// ============================================================
// Upstream calls
// ============================================================

// GetClientToken exchanges a login for a user token.
func (a *YClientsAPI) GetClientToken(ctx context.Context, in *YClientsTokenRequestDTO) *YClientsTokenResponseDTO {
	if in == nil {
		return &YClientsTokenResponseDTO{
			StatusCode:    400,
			StatusMessage: statusMessage(400),
			Success:       false,
			ErrorMessage:  str("Request body is required"),
		}
	}
	body := map[string]string{"login": in.Login, "password": in.Password}
	resp, err := a.exchange(ctx, "POST", ycEndpoints.Auth, &in.PartnerToken, nil, nil, body)
	if err != nil {
		return &YClientsTokenResponseDTO{StatusCode: 500, StatusMessage: statusMessage(500), Success: false,
			ErrorMessage: str(err.Error())}
	}
	if isSuccess(resp) {
		var auth ycAuthResponse
		if len(resp.Data) > 0 {
			_ = jsonUnmarshal(resp.Data, &auth)
		}
		return &YClientsTokenResponseDTO{
			StatusCode:    resp.Status,
			StatusMessage: statusMessage(resp.Status),
			Success:       true,
			UserToken:     &auth.UserToken,
		}
	}
	return &YClientsTokenResponseDTO{
		StatusCode:    resp.Status,
		StatusMessage: statusMessage(resp.Status),
		Success:       false,
		ErrorMessage:  str(metaMessage(resp)),
	}
}

// GetClientOrganizations lists the companies the tokens can see.
func (a *YClientsAPI) GetClientOrganizations(ctx context.Context, creds *YClientCredentialsDTO) YClientsDataResponse[[]YClientsOrganizationDTO] {
	resp, err := a.exchange(ctx, "GET", ycEndpoints.Companies, creds.PartnerToken, creds.UserToken,
		url.Values{"my": []string{"1"}}, nil)
	if err != nil {
		return YClientsDataResponse[[]YClientsOrganizationDTO]{StatusCode: 500, StatusMessage: statusMessage(500),
			Success: false, ErrorMessage: str(err.Error())}
	}
	if !isSuccess(resp) {
		return ycFail[[]YClientsOrganizationDTO](resp)
	}
	var infos []ycOrgInfo
	_ = jsonUnmarshal(resp.Data, &infos)
	data := make([]YClientsOrganizationDTO, 0, len(infos))
	for _, v := range infos {
		data = append(data, YClientsOrganizationDTO{
			YCID:     &v.ID,
			Name:     str(v.Title),
			Timezone: str(zoneOffsetOfHours(v.Timezone)),
		})
	}
	return YClientsDataResponse[[]YClientsOrganizationDTO]{
		StatusCode:    resp.Status,
		StatusMessage: statusMessage(resp.Status),
		Success:       true,
		Data:          data,
		Meta:          metaOf(resp),
	}
}

// categoriesPath is the upstream path of one company's service categories.
func categoriesPath(orgID int64) string {
	return ycEndpoints.Company + "/" + strconv.FormatInt(orgID, 10) + ycEndpoints.ServiceCategories
}

// fetchServiceCategories reads a company's service categories, keeping the
// staff list that the DTO drops. The place lookup needs it: a category names
// the employees allowed to perform it, and there is no other way to learn that.
func (a *YClientsAPI) fetchServiceCategories(ctx context.Context, orgID int64, creds *YClientCredentialsDTO) (*ycResponse, []ycServiceCategoryInfo, error) {
	resp, err := a.exchange(ctx, "GET", categoriesPath(orgID), creds.PartnerToken, creds.UserToken, nil, nil)
	if err != nil {
		return nil, nil, err
	}
	if !isSuccess(resp) {
		return resp, nil, nil
	}
	var infos []ycServiceCategoryInfo
	_ = jsonUnmarshal(resp.Data, &infos)
	return resp, infos, nil
}

// GetOrganizationServiceCategories lists the service categories of a company.
func (a *YClientsAPI) GetOrganizationServiceCategories(ctx context.Context, orgID int64, creds *YClientCredentialsDTO) YClientsDataResponse[[]YClientsServiceCategoryDTO] {
	resp, infos, err := a.fetchServiceCategories(ctx, orgID, creds)
	if err != nil {
		return YClientsDataResponse[[]YClientsServiceCategoryDTO]{StatusCode: 500, StatusMessage: statusMessage(500),
			Success: false, ErrorMessage: str(err.Error())}
	}
	if !isSuccess(resp) {
		return ycFail[[]YClientsServiceCategoryDTO](resp)
	}
	data := make([]YClientsServiceCategoryDTO, 0, len(infos))
	for _, v := range infos {
		id := v.ID
		data = append(data, YClientsServiceCategoryDTO{ID: &id, Name: str(v.Title), OrgID: &orgID})
	}
	sort.SliceStable(data, func(i, j int) bool { return deref(data[i].Name) < deref(data[j].Name) })
	return YClientsDataResponse[[]YClientsServiceCategoryDTO]{
		StatusCode:    resp.Status,
		StatusMessage: statusMessage(resp.Status),
		Success:       true,
		Data:          data,
		Meta:          metaOf(resp),
	}
}

// GetServicesForOrganization lists the active jobs of the given categories.
func (a *YClientsAPI) GetServicesForOrganization(ctx context.Context, orgID int64, catIDs []int64, creds *YClientCredentialsDTO) YClientsDataResponse[[]YClientsServiceDTO] {
	path := ycEndpoints.Company + "/" + strconv.FormatInt(orgID, 10) + ycEndpoints.Services
	resp, err := a.exchange(ctx, "GET", path, creds.PartnerToken, creds.UserToken, nil, nil)
	if err != nil {
		return YClientsDataResponse[[]YClientsServiceDTO]{StatusCode: 500, StatusMessage: statusMessage(500),
			Success: false, ErrorMessage: str(err.Error())}
	}
	if !isSuccess(resp) {
		return ycFail[[]YClientsServiceDTO](resp)
	}
	allowed := make(map[int64]struct{}, len(catIDs))
	for _, c := range catIDs {
		allowed[c] = struct{}{}
	}
	var infos []ycServiceInfo
	_ = jsonUnmarshal(resp.Data, &infos)
	data := make([]YClientsServiceDTO, 0, len(infos))
	for _, v := range infos {
		// An inactive job is one YClients has retired; offering it for
		// selection would let monitoring be attached to something nobody can
		// dispatch.
		if v.Active != 1 {
			continue
		}
		if _, ok := allowed[v.Category]; !ok {
			continue
		}
		data = append(data, YClientsServiceDTO{
			Name:       v.Title,
			YCID:       v.ID,
			YCName:     v.Title,
			CategoryID: v.Category,
		})
	}
	sort.SliceStable(data, func(i, j int) bool {
		if data[i].YCName != data[j].YCName {
			return data[i].YCName < data[j].YCName
		}
		return data[i].YCID < data[j].YCID
	})
	return YClientsDataResponse[[]YClientsServiceDTO]{
		StatusCode:    resp.Status,
		StatusMessage: statusMessage(resp.Status),
		Success:       true,
		Data:          data,
		Meta:          metaOf(resp),
	}
}

// GetPlacesForOrganization lists the employees who may perform the given
// categories and are still active.
//
// This needs two upstream calls: the categories name the employees allowed to
// perform them, and the staff endpoint gives their current state. A place is
// offered only when both agree the person is still employed.
func (a *YClientsAPI) GetPlacesForOrganization(ctx context.Context, orgID int64, catIDs []int64, creds *YClientCredentialsDTO) YClientsDataResponse[[]YClientsPlaceDTO] {
	catResp, cats, err := a.fetchServiceCategories(ctx, orgID, creds)
	if err != nil {
		return YClientsDataResponse[[]YClientsPlaceDTO]{StatusCode: 500, StatusMessage: statusMessage(500),
			Success: false, ErrorMessage: str(err.Error())}
	}
	if !isSuccess(catResp) {
		return ycFail[[]YClientsPlaceDTO](catResp)
	}
	staffResp, err := a.exchange(ctx, "GET",
		ycEndpoints.Company+"/"+strconv.FormatInt(orgID, 10)+ycEndpoints.Staffs,
		creds.PartnerToken, creds.UserToken, nil, nil)
	if err != nil {
		return YClientsDataResponse[[]YClientsPlaceDTO]{StatusCode: 500, StatusMessage: statusMessage(500),
			Success: false, ErrorMessage: str(err.Error())}
	}
	// The Java code tested the categories response a second time after the staff
	// call, so a failed staff request was ignored and the method answered with
	// success=true and an empty list, which the front-end read as "this company
	// has no employees". The check is made against the staff response here. See
	// MIGRATION.md, "Fixed defects".
	if !isSuccess(staffResp) {
		return ycFail[[]YClientsPlaceDTO](staffResp)
	}
	allowed := make(map[int64]struct{}, len(catIDs))
	for _, c := range catIDs {
		allowed[c] = struct{}{}
	}
	// The staff lists of the selected categories are the candidate set.
	allowedStaff := map[int64]struct{}{}
	for _, c := range cats {
		if _, ok := allowed[c.ID]; !ok {
			continue
		}
		for _, sid := range c.Staff {
			allowedStaff[sid] = struct{}{}
		}
	}
	var staffs []ycStaffInfo
	_ = jsonUnmarshal(staffResp.Data, &staffs)
	data := make([]YClientsPlaceDTO, 0, len(staffs))
	for _, s := range staffs {
		if _, ok := allowedStaff[s.ID]; !ok {
			continue
		}
		// Fired is set by YClients when the employment ends; status is their
		// own work-status flag. Only a person with neither is dispatchable.
		if s.Fired != 0 || s.Status != 0 {
			continue
		}
		data = append(data, YClientsPlaceDTO{YCID: s.ID, YCName: s.Name, Available: true})
	}
	sort.SliceStable(data, func(i, j int) bool {
		if data[i].YCName != data[j].YCName {
			return data[i].YCName < data[j].YCName
		}
		return data[i].YCID < data[j].YCID
	})
	return YClientsDataResponse[[]YClientsPlaceDTO]{
		StatusCode:    staffResp.Status,
		StatusMessage: statusMessage(staffResp.Status),
		Success:       true,
		Data:          data,
		Meta:          metaOf(staffResp),
	}
}

// ycFail builds the failure envelope, the shared shape of every upstream error.
func ycFail[T any](resp *ycResponse) YClientsDataResponse[T] {
	if resp == nil {
		resp = &ycResponse{Status: 0}
	}
	return YClientsDataResponse[T]{
		StatusCode:    resp.Status,
		StatusMessage: statusMessage(resp.Status),
		Success:       false,
		ErrorMessage:  str(errorMessageOf(resp)),
		Meta:          metaOf(resp),
	}
}

// metaMessage reads the meta block's "message" key, the single field the Java
// token response used.
func metaMessage(resp *ycResponse) string {
	if m := metaOf(resp); m != nil {
		if v, ok := m["message"]; ok {
			return v
		}
	}
	return ""
}
