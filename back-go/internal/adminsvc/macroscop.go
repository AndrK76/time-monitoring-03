package adminsvc

import (
	"context"
	"sort"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
)

// The Macroscop half of service-admin.
//
// A Macroscop *server* is registered once as a Macroscop configuration, holding
// an address and the credentials to reach it. An event or camera *agent* is then
// bound to one of those configurations, and the channels of that server become
// the places and cameras an organization monitors. So there are two levels: the
// server registration, which only a superuser touches, and the per-agent
// binding, which follows the agent's own access rules.

// MacroscopKind distinguishes the two agent families that can be bound to a
// Macroscop configuration. The camera family is listed first because the Java
// controller exposed it first, and the error messages name it.
type MacroscopKind struct {
	// kind is the agent family this binding belongs to.
	kind *AgentKind
	// link is the bridge table holding the binding.
	link agentFamily
	// notFound is the 404 raised when the agent has no binding row at all.
	notFound string
	// alreadyBound is the 409 raised when the agent holds a different binding.
	alreadyBound string
}

var (
	// MSCEvt binds an event agent to a Macroscop server.
	MSCEvt = &MacroscopKind{
		kind:         KindEvt,
		link:         familyEvt,
		notFound:     "Config for Macroscop event agent with id ",
		alreadyBound: "Event config for agent already bounded",
	}
	// MSCImg binds a camera agent to a Macroscop server.
	MSCImg = &MacroscopKind{
		kind:         KindImg,
		link:         familyImg,
		notFound:     "Config for Macroscop camera agent with id ",
		alreadyBound: "Camera config for agent already bounded",
	}
)

// ============================================================
// Per-agent bindings
// ============================================================

// GetMSLink reads the Macroscop configuration bound to an event or camera agent.
//
// The binding row has to exist before this can answer, and it is only created by
// GET /{crm,evt,img}/agents/{id}/config. The front-end calls that first as the
// first step of configuring an agent, so in practice it has already run.
func (s *Service) GetMSLink(ctx context.Context, acc *Access, m *MacroscopKind, agentID string) (any, error) {
	cfg, err := s.loadLink(ctx, acc, m, agentID)
	if err != nil {
		return nil, err
	}
	return m.wrap(s.maskedConfigDTO(cfg)), nil
}

// loadLink resolves the agent, then its binding row.
//
// The agent check is the shared one, so a caller who cannot see the agent gets
// the same 404 it would get from the agent endpoint rather than a 403 that would
// confirm the agent exists.
func (s *Service) loadLink(ctx context.Context, acc *Access, m *MacroscopKind, agentID string) (*MacroscopConfig, error) {
	agent, err := s.Store.FindAgent(ctx, s.Store.pool, m.link, agentID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, m.kind.agentNotFound(agentID)
		}
		return nil, err
	}
	if !acc.IsAllowedAllOrganizations() && !acc.IsAllowedOrganization(deref(agent.OrganizationID)) {
		return nil, m.kind.agentNotFound(agentID)
	}
	configID, err := s.Store.FindMacroscopLink(ctx, s.Store.pool, m.link, agent.ID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound(m.notFound + agentID + " not found")
		}
		return nil, err
	}
	if configID == "" {
		return nil, nil
	}
	cfg, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		if db.IsNoRows(err) {
			// The binding names a configuration that is gone. The row was
			// detached by the foreign key, so there is nothing to report and the
			// agent simply has no configuration.
			return nil, nil
		}
		return nil, err
	}
	return cfg, nil
}

// wrap renders the family-specific wrapper, which differs only in its type name.
func (m *MacroscopKind) wrap(cfg *MacroscopAgentConfigDTO) any {
	if m == MSCImg {
		return &MacroscopImgAgentConfigDTO{Config: cfg}
	}
	return &MacroscopEvtAgentConfigDTO{Config: cfg}
}

// UpdateMSLink creates or updates the Macroscop configuration of an agent.
//
// There are two cases, and they are not the same operation. When the agent has
// no configuration yet, the request either names an existing configuration to
// adopt or carries a new one to create; the response is then the newly stored
// configuration. When it already has one, the request may only edit that same
// configuration, because the point of the endpoint is to edit the agent's
// settings, not to swap which server it points at - swapping is what bind is
// for.
// MSLinkBody is the request and response shape of the two event and camera
// configuration endpoints. The two Java DTOs are identical, so one Go type
// serves both and MacroscopKind.wrap re-labels the response.
type MSLinkBody struct {
	Config *MacroscopAgentConfigDTO `json:"config"`
}

// The request is echoed back with only the config replaced, which is what the
// Java service did: it mutated the caller's DTO rather than building a new one.
// The distinction matters to the front-end, which reads the response as the
// state of the binding and would otherwise be told nothing about a request that
// stored nothing.
func (s *Service) UpdateMSLink(ctx context.Context, acc *Access, m *MacroscopKind, agentID string, in *MSLinkBody) (any, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if in == nil {
		return nil, httpx.Conflict("Empty Macroscop config")
	}
	existing, err := s.loadLink(ctx, acc, m, agentID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		// No binding yet. A request that carries no configuration stores
		// nothing and is echoed unchanged; one that carries either an existing
		// configuration to adopt or the fields of a new one creates the link.
		if in.Config == nil {
			return m.wrap(in.Config), nil
		}
		var stored *MacroscopConfig
		// fresh records whether this request created the configuration. A
		// configuration that was only read back was loaded, so it has the
		// all-null credentials and server-info blocks a load produces; one
		// created here has neither.
		fresh := false
		err = s.Store.pool.InTx(ctx, func(q db.Querier) error {
			if in.Config.ID != nil {
				stored, err = s.Store.FindMacroscopConfig(ctx, q, *in.Config.ID)
				if err != nil {
					if db.IsNoRows(err) {
						return httpx.NotFound("Macroscop config with id " + *in.Config.ID + " not found")
					}
					return err
				}
			} else {
				stored, err = s.newMacroscopConfig(ctx, q, acc)
				if err != nil {
					return err
				}
				fresh = true
			}
			if err := s.applyConfigUpdate(ctx, q, acc, stored, in.Config); err != nil {
				return err
			}
			return s.Store.SetMacroscopLink(ctx, q, m.link, agentID, stored.ID)
		})
		if err != nil {
			return nil, err
		}
		in.Config = s.unmaskConfigDTO(s.configDTO(stored, !fresh))
		return m.wrap(in.Config), nil
	}
	if in.Config == nil || in.Config.ID == nil || *in.Config.ID != existing.ID {
		return nil, httpx.Conflict("Incorrect Macroscop config")
	}
	if err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		return s.applyConfigUpdate(ctx, q, acc, existing, in.Config)
	}); err != nil {
		return nil, err
	}
	updated, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, existing.ID)
	if err != nil {
		return nil, err
	}
	in.Config = s.unmaskConfigDTO(s.configDTO(updated, true))
	return m.wrap(in.Config), nil
}

// BindMSConfig points an agent at an existing Macroscop configuration.
//
// Binding an already-bound agent to the same configuration is accepted and
// returns the current binding, so the operation is idempotent; binding it to a
// different one is a conflict, because silently moving an organization's cameras
// to another server is never what the request meant.
func (s *Service) BindMSConfig(ctx context.Context, acc *Access, m *MacroscopKind, agentID, configID string) (any, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	cfg, err := s.loadLink(ctx, acc, m, agentID)
	if err != nil {
		return nil, err
	}
	if cfg != nil {
		if cfg.ID != configID {
			return nil, httpx.Conflict(m.alreadyBound)
		}
		// The Java response here returned the stored, still-masked password,
		// because only getEvtConfig/getImgConfig decrypted. The clear text is
		// returned instead: the caller is a superuser who can already read the
		// configuration directly, and a masked password in a bind response is
		// indistinguishable from a corrupted one. See MIGRATION.md, "Deviations".
		return m.wrap(s.unmaskConfigDTO(s.configDTO(cfg, true))), nil
	}
	if err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		stored, err := s.Store.FindMacroscopConfig(ctx, q, configID)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.NotFound("Macroscop config with id " + configID + " not found")
			}
			return err
		}
		return s.Store.SetMacroscopLink(ctx, q, m.link, agentID, stored.ID)
	}); err != nil {
		return nil, err
	}
	linked, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		return nil, err
	}
	return m.wrap(s.unmaskConfigDTO(s.configDTO(linked, true))), nil
}

// UnbindMSConfig detaches whatever configuration an agent held. It is idempotent:
// unbinding an unbound agent returns the unbound shape rather than an error,
// because the caller's intent - that the agent have no configuration - already
// holds.
func (s *Service) UnbindMSConfig(ctx context.Context, acc *Access, m *MacroscopKind, agentID string) (any, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	cfg, err := s.loadLink(ctx, acc, m, agentID)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return m.wrap(nil), nil
	}
	if err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		return s.Store.DeleteMacroscopLink(ctx, q, m.link, agentID)
	}); err != nil {
		return nil, err
	}
	return m.wrap(nil), nil
}

// ============================================================
// Server configurations
// ============================================================

// ListMSConfigs returns the registered Macroscop servers, without credentials.
func (s *Service) ListMSConfigs(ctx context.Context, acc *Access) ([]MacroscopAgentConfigListDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	rows, err := s.Store.ListMacroscopConfigs(ctx, s.Store.pool)
	if err != nil {
		return nil, err
	}
	out := make([]MacroscopAgentConfigListDTO, 0, len(rows))
	for i := range rows {
		out = append(out, MacroscopAgentConfigListDTO{ID: rows[i].ID, Name: rows[i].Name})
	}
	return out, nil
}

// GetMSConfig returns one registered Macroscop server with clear-text
// credentials.
func (s *Service) GetMSConfig(ctx context.Context, acc *Access, configID string) (*MacroscopAgentConfigDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	cfg, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Macroscop config with id " + configID + " not found")
		}
		return nil, err
	}
	return s.unmaskConfigDTO(s.configDTO(cfg, true)), nil
}

// NewMSConfig registers a Macroscop server.
//
// The row is created immediately with a placeholder name, so the front-end can
// create a configuration, bind an agent to it, and only then name it. That is
// why the name is a generated temporary value rather than a required field.
func (s *Service) NewMSConfig(ctx context.Context, acc *Access) (*MacroscopAgentConfigDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	var cfg *MacroscopConfig
	err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		var err error
		cfg, err = s.newMacroscopConfig(ctx, q, acc)
		return err
	})
	if err != nil {
		return nil, err
	}
	return s.configDTO(cfg, false), nil
}

func (s *Service) newMacroscopConfig(ctx context.Context, q db.Querier, acc *Access) (*MacroscopConfig, error) {
	actor := acc.UserID()
	cfg := &MacroscopConfig{
		Name:      "temp-" + rabbit.NewUUID(),
		CreatedBy: &actor,
	}
	if err := s.Store.InsertMacroscopConfig(ctx, q, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

// UpdateMSConfig edits a registered Macroscop server.
//
// The three merge rules are the Java ones and are not symmetric, which is
// deliberate: the name and the credentials are only overwritten when the request
// carries them, so a front-end that edits the address does not have to resend the
// password it never had. The address, in contrast, is always overwritten, so
// clearing it is possible.
func (s *Service) UpdateMSConfig(ctx context.Context, acc *Access, configID string, in *MacroscopAgentConfigDTO) (*MacroscopAgentConfigDTO, error) {
	if !acc.IsSuperUser() {
		return nil, httpx.Forbidden("Access denied")
	}
	stored, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Macroscop config with id " + configID + " not found")
		}
		return nil, err
	}
	if in == nil || in.Credentials == nil {
		return nil, httpx.BadRequest("Incorrect request data")
	}
	if in.ID != nil && *in.ID != "" && !equalFoldIgnoreCase(configID, *in.ID) {
		return nil, httpx.BadRequest("Request Id not equal Macroscop config id=" + *in.ID)
	}
	if err := s.Store.pool.InTx(ctx, func(q db.Querier) error {
		return s.applyConfigUpdate(ctx, q, acc, stored, in)
	}); err != nil {
		return nil, err
	}
	updated, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		return nil, err
	}
	return s.unmaskConfigDTO(s.configDTO(updated, true)), nil
}

// applyConfigUpdate is the shared body of the two update paths.
//
// serverInfo is written field by field rather than skipped when partially
// present, so a request that sets the version and omits the zone clears the
// stored zone. useTz is a plain boolean and is always written.
func (s *Service) applyConfigUpdate(ctx context.Context, q db.Querier, acc *Access, stored *MacroscopConfig, in *MacroscopAgentConfigDTO) error {
	actor := acc.UserID()
	stored.UpdatedBy = &actor
	if in.Name != nil {
		stored.Name = *in.Name
	}
	if in.Credentials != nil {
		stored.Login = in.Credentials.Login
		stored.Password = s.Cipher.Encrypt(in.Credentials.Password, s.XorSecret)
	}
	stored.ServerAddress = in.ServerAddress
	if info := in.ServerInfo; info != nil {
		// The zone is stored as its rendered id, which is what the channel and
		// server-info columns hold. An unparsable value leaves it null, the
		// same outcome the Java utility produced.
		stored.ServerTZ = nil
		if info.TZ != nil {
			if seconds, ok := common.ParseZoneOffset(*info.TZ); ok {
				id := common.FormatZoneOffset(seconds)
				stored.ServerTZ = &id
			}
		}
		stored.ServerID = info.ID
		stored.ServerVersion = info.Version
		stored.InfoResponseTime = info.ResponseDate
		useTZ := info.UseTZ
		stored.ServerUseTZ = &useTZ
		if err := s.Store.MergeMacroscopServerInfo(ctx, q, stored); err != nil {
			return err
		}
	}
	return s.Store.UpdateMacroscopConfig(ctx, q, stored)
}

// DeleteMSConfig removes a registered Macroscop server and its channels.
func (s *Service) DeleteMSConfig(ctx context.Context, acc *Access, configID string) error {
	if !acc.IsSuperUser() {
		return httpx.Forbidden("Access denied")
	}
	found, err := s.Store.DeleteMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		return err
	}
	if !found {
		// Java called deleteById unconditionally, which threw for an unknown id
		// and surfaced as a 500.
		return httpx.NotFound("Macroscop config with id " + configID + " not found")
	}
	return nil
}

// GetArchiveModes lists the Macroscop recording modes, sorted by name.
func (s *Service) GetArchiveModes(ctx context.Context) []MacroscopArchiveModeDTO {
	out := make([]MacroscopArchiveModeDTO, 0, len(ArchiveModes))
	for _, m := range ArchiveModes {
		out = append(out, MacroscopArchiveModeDTO{ID: m.Name, Name: m.Description})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// ============================================================
// Channels
// ============================================================

// GetMSChannels returns the channels stored for a configuration.
func (s *Service) GetMSChannels(ctx context.Context, acc *Access, configID string) ([]MacroscopChannelDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if err := s.checkAllowedConfigByOrg(ctx, acc, configID); err != nil {
		return nil, err
	}
	rows, err := s.Store.ListMacroscopChannels(ctx, s.Store.pool, configID)
	if err != nil {
		return nil, err
	}
	out := make([]MacroscopChannelDTO, 0, len(rows))
	for i := range rows {
		out = append(out, msChannelDTO(&rows[i]))
	}
	sortChannels(out)
	return out, nil
}

func sortChannels(items []MacroscopChannelDTO) {
	sort.SliceStable(items, func(i, j int) bool {
		if deref(items[i].Name) != deref(items[j].Name) {
			return deref(items[i].Name) < deref(items[j].Name)
		}
		return items[i].MacroscopID < items[j].MacroscopID
	})
}

func msChannelDTO(c *MacroscopChannel) MacroscopChannelDTO {
	streams := make([]MacroscopChannelStreamDTO, 0, len(c.Streams))
	for _, st := range c.Streams {
		streams = append(streams, MacroscopChannelStreamDTO{Type: st.Type, Format: st.Format})
	}
	return MacroscopChannelDTO{
		ID:               c.ID,
		MacroscopID:      c.MacroscopID,
		Name:             c.Name,
		Device:           c.Device,
		Enabled:          c.Enabled,
		Exists:           c.Exists,
		Used:             c.Used,
		ArchivingEnabled: c.ArchivingEnabled,
		ArchiveAllowed:   c.ArchiveAllowed,
		RealtimeAllowed:  c.RealtimeAllowed,
		SoundAllowed:     c.SoundAllowed,
		ArchiveMode:      c.ArchiveMode,
		TZ:               c.TZ,
		Streams:          streams,
	}
}

// UpdateMSChannels reconciles the stored channels of a configuration with the
// channels a Macroscop server currently offers.
//
// The request is a full listing from the server, not a set of edits, and the
// three cases are distinguished by what the request says about a channel:
//
//   - a channel already stored and still present is updated;
//   - a channel already stored but marked absent keeps its row with exists and
//     used cleared, so a camera that comes back later is recognised as the same
//     one and keeps its settings;
//   - a channel not stored and present is inserted.
//
// A channel that is neither stored nor present is ignored, and a stored channel
// the request does not mention at all is left untouched, because the front-end
// pages the channel list and a page that omits a channel is not a deletion.
func (s *Service) UpdateMSChannels(ctx context.Context, acc *Access, configID string, in []MacroscopChannelDTO) ([]MacroscopChannelDTO, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if err := s.checkAllowedConfigByOrg(ctx, acc, configID); err != nil {
		return nil, err
	}
	if _, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID); err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Macroscop config with id " + configID + " not found")
		}
		return nil, err
	}
	actor := acc.UserID()
	stored, err := s.Store.ListMacroscopChannels(ctx, s.Store.pool, configID)
	if err != nil {
		return nil, err
	}
	storedByMacroscopID := make(map[string]*MacroscopChannel, len(stored))
	for i := range stored {
		storedByMacroscopID[stored[i].MacroscopID] = &stored[i]
	}
	inByMacroscopID := make(map[string]MacroscopChannelDTO, len(in))
	for _, d := range in {
		if _, dup := inByMacroscopID[d.MacroscopID]; dup {
			continue
		}
		inByMacroscopID[d.MacroscopID] = d
	}

	err = s.Store.pool.InTx(ctx, func(q db.Querier) error {
		for i := range stored {
			row := &stored[i]
			dto, present := inByMacroscopID[row.MacroscopID]
			if !present {
				continue
			}
			if !dto.Exists {
				if !row.Exists {
					continue
				}
				row.Exists = false
				row.Used = false
				row.UpdatedBy = &actor
				if err := s.Store.SaveMacroscopChannel(ctx, q, row); err != nil {
					return err
				}
				continue
			}
			fillChannelFromDTO(row, &dto)
			row.Used = dto.Used
			row.Exists = true
			row.UpdatedBy = &actor
			if err := s.Store.SaveMacroscopChannel(ctx, q, row); err != nil {
				return err
			}
		}
		for i := range in {
			dto := in[i]
			if _, known := storedByMacroscopID[dto.MacroscopID]; known {
				continue
			}
			if !dto.Exists {
				continue
			}
			row := &MacroscopChannel{ConfigID: configID, MacroscopID: dto.MacroscopID, CreatedBy: &actor}
			fillChannelFromDTO(row, &dto)
			row.Used = dto.Used
			row.Exists = true
			if err := s.Store.SaveMacroscopChannel(ctx, q, row); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	rows, err := s.Store.ListMacroscopChannels(ctx, s.Store.pool, configID)
	if err != nil {
		return nil, err
	}
	out := make([]MacroscopChannelDTO, 0, len(rows))
	for i := range rows {
		out = append(out, msChannelDTO(&rows[i]))
	}
	sortChannels(out)
	return out, nil
}

// fillChannelFromDTO copies the editable fields of a channel, replacing its
// streams wholesale.
//
// A row whose Macroscop id differs is left alone, which is the guard against a
// mismatched request writing one channel's settings onto another.
func fillChannelFromDTO(row *MacroscopChannel, dto *MacroscopChannelDTO) {
	if row == nil || dto == nil {
		return
	}
	if row.MacroscopID != "" && row.MacroscopID != dto.MacroscopID {
		return
	}
	row.Name = dto.Name
	row.Device = dto.Device
	row.Enabled = dto.Enabled
	row.Used = dto.Used
	row.ArchivingEnabled = dto.ArchivingEnabled
	row.ArchiveAllowed = dto.ArchiveAllowed
	row.RealtimeAllowed = dto.RealtimeAllowed
	row.SoundAllowed = dto.SoundAllowed
	// The archive mode is stored as the enum name, not the server-side token,
	// because the front-end edits it by enum name and a server upgrade renaming
	// its token must not invalidate the stored setting.
	row.ArchiveMode = nil
	if m := ArchiveModeByName(deref(dto.ArchiveMode)); m != nil {
		name := m.Name
		row.ArchiveMode = &name
	}
	row.TZ = nil
	if dto.TZ != nil {
		if seconds, ok := common.ParseZoneOffset(*dto.TZ); ok {
			id := common.FormatZoneOffset(seconds)
			row.TZ = &id
		}
	}
	row.Streams = nil
	if dto.Streams != nil {
		for i := range dto.Streams {
			if dto.Streams[i].Type == nil {
				continue
			}
			row.Streams = append(row.Streams, MacroscopChannelStream{
				Order:  i,
				Type:   dto.Streams[i].Type,
				Format: dto.Streams[i].Format,
			})
		}
	}
}

// ============================================================
// Live server probes
// ============================================================

// GetMSServerInfo asks a Macroscop server to describe itself.
func (s *Service) GetMSServerInfo(ctx context.Context, acc *Access, configID string) (MacroscopDataResponse[*MacroscopServerInfoDTO], error) {
	if !acc.IsAllowedAllActions() {
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{}, httpx.Forbidden("Access denied")
	}
	creds, err := s.macroscopCreds(ctx, acc, configID)
	if err != nil {
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{}, err
	}
	return s.MS.GetServerInfo(ctx, creds), nil
}

// GetMSAllowedChannels lists the cameras a Macroscop server currently offers,
// which is the list the channel reconciliation is built from.
func (s *Service) GetMSAllowedChannels(ctx context.Context, acc *Access, configID string) (MacroscopDataResponse[[]MacroscopChannelDTO], error) {
	if !acc.IsAllowedAllActions() {
		return MacroscopDataResponse[[]MacroscopChannelDTO]{}, httpx.Forbidden("Access denied")
	}
	creds, err := s.macroscopCreds(ctx, acc, configID)
	if err != nil {
		return MacroscopDataResponse[[]MacroscopChannelDTO]{}, err
	}
	return s.MS.GetAllowedChannels(ctx, creds), nil
}

// GetMSScreenshot proxies a live frame of one channel.
//
// Both streams are tried and the larger valid image wins, because the alternate
// stream is the one that keeps working when the main stream is busy. The bytes
// are returned verbatim with the upstream content type, so the browser decodes
// them without this service re-encoding anything.
func (s *Service) GetMSScreenshot(ctx context.Context, acc *Access, configID, channelID string) (*BinaryContent, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if err := s.checkAllowedConfigByOrg(ctx, acc, configID); err != nil {
		return nil, err
	}
	creds, err := s.macroscopCreds(ctx, acc, configID)
	if err != nil {
		return nil, err
	}
	channel, err := s.Store.FindMacroscopChannel(ctx, s.Store.pool, configID, channelID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Channel not found")
		}
		return nil, err
	}
	main := s.MS.GetCurrentScreenshot(ctx, creds, channel.MacroscopID, streamFor(channel, StreamMain))
	alt := s.MS.GetCurrentScreenshot(ctx, creds, channel.MacroscopID, streamFor(channel, StreamAlt))
	best := pickBestScreenshot(main, alt)
	if !validBinary(best) {
		// The upstream failure is surfaced as a gateway error, because the
		// caller asked this service for a picture and there is none; the
		// upstream's own text is the only useful diagnostic.
		return nil, httpx.BadGateway(deref(best.ErrorMessage))
	}
	return best.Data, nil
}

// GetMSLastArchiveScreenshot proxies the most recent archived frame of one
// channel.
func (s *Service) GetMSLastArchiveScreenshot(ctx context.Context, acc *Access, configID, channelID string) (*BinaryContent, error) {
	if !acc.IsAllowedAllActions() {
		return nil, httpx.Forbidden("Access denied")
	}
	if err := s.checkAllowedConfigByOrg(ctx, acc, configID); err != nil {
		return nil, err
	}
	creds, err := s.macroscopCreds(ctx, acc, configID)
	if err != nil {
		return nil, err
	}
	if _, err := s.Store.FindMacroscopChannel(ctx, s.Store.pool, configID, channelID); err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Channel not found")
		}
		return nil, err
	}
	res := s.MS.GetLastArchiveScreenshot(ctx, creds, channelID)
	if !validBinary(res) {
		return nil, httpx.BadGateway(deref(res.ErrorMessage))
	}
	return res.Data, nil
}

// streamFor picks which stream variant to request for a preferred one.
//
// A channel that declares no streams at all is asked for the preferred variant
// anyway, since a server that reports no streams will still answer for a named
// one; a channel that declares streams but not the preferred one is asked for the
// first it does declare.
func streamFor(channel *MacroscopChannel, preferred string) string {
	if len(channel.Streams) == 0 {
		return preferred
	}
	for _, s := range channel.Streams {
		if s.Type != nil && *s.Type == preferred {
			return preferred
		}
	}
	for _, s := range channel.Streams {
		if s.Type != nil {
			return *s.Type
		}
	}
	return preferred
}

// pickBestScreenshot returns the larger of two valid frames.
//
// When neither is valid the main result is returned, so the error the caller sees
// is the one from the stream that was asked for first.
func pickBestScreenshot(main, alt MacroscopDataResponse[*BinaryContent]) MacroscopDataResponse[*BinaryContent] {
	mainOK, altOK := validBinary(main), validBinary(alt)
	switch {
	case mainOK && !altOK:
		return main
	case !mainOK && altOK:
		return alt
	case !mainOK:
		return main
	case len(alt.Data.Data) > len(main.Data.Data):
		return alt
	default:
		return main
	}
}

func validBinary(res MacroscopDataResponse[*BinaryContent]) bool {
	return res.Success && res.Data != nil && len(res.Data.Data) > 0
}

// ============================================================
// helpers
// ============================================================

// checkAllowedConfigByOrg answers whether the caller may reach the servers an
// organization uses.
//
// Only the event bindings are consulted, which is narrower than it looks: a
// camera configuration is always reachable by the same organizations that own
// the event agents pointing at the same server, because an organization that
// cannot see the events cannot be expected to manage the cameras. A caller with
// no allowed organizations is denied outright rather than being offered a
// configuration it might own.
func (s *Service) checkAllowedConfigByOrg(ctx context.Context, acc *Access, configID string) error {
	if acc.IsSuperUser() {
		return nil
	}
	allowed := acc.AllowedOrganizations()
	if len(allowed) == 0 {
		return httpx.Forbidden("Config not allowed")
	}
	// The check is the join the other way round: the event agents bound to this
	// configuration, then the organizations they are attached to.
	orgIDs, err := s.Store.ListOrgIDsByEvtConfig(ctx, s.Store.pool, configID)
	if err != nil {
		return err
	}
	for _, orgID := range orgIDs {
		if acc.IsAllowedOrganization(orgID) {
			return nil
		}
	}
	return httpx.Forbidden("Config not allowed")
}

// macroscopCreds reads the credentials of a configuration in the form the MSCP
// API wants, which is the address, the login, and the md5 digest of the
// password.
//
// The digest is computed at the boundary and never stored: the Macroscop server
// expects the digest, so keeping the plain password would give a database dump
// more than it needs. A configuration with no address or no login cannot be
// called, and that is a conflict rather than a 404: the configuration exists, it
// is just not usable yet.
func (s *Service) macroscopCreds(ctx context.Context, acc *Access, configID string) (*MacroscopServerCredentials, error) {
	cfg, err := s.Store.FindMacroscopConfig(ctx, s.Store.pool, configID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Config not found")
		}
		return nil, err
	}
	address := deref(cfg.ServerAddress)
	login := deref(s.Cipher.Decrypt(cfg.Login, s.XorSecret))
	if address == "" || login == "" {
		return nil, httpx.Conflict("Invalid credentials in config")
	}
	// The login is stored in the same masked column as the password, because
	// MacroscopCredentials is one embeddable and the Java service masked both
	// fields through the same helpers.
	return &MacroscopServerCredentials{
		Address:      address,
		Login:        login,
		PasswordHash: common.Md5HashUtf(s.Cipher.Decrypt(cfg.Password, s.XorSecret)),
	}, nil
}

// configDTO renders a stored configuration.
//
// loaded distinguishes the two shapes the Java mapper produced. A configuration
// read from the database always has a credentials block and a server-info block,
// even when every field of each is null, because Hibernate materialised the two
// embeddables while loading the row. A configuration created in the current
// request has neither, because no load happened. The front-end distinguishes the
// two, so the difference is preserved.
func (s *Service) configDTO(cfg *MacroscopConfig, loaded bool) *MacroscopAgentConfigDTO {
	if cfg == nil {
		return nil
	}
	out := &MacroscopAgentConfigDTO{
		ID:            &cfg.ID,
		Name:          &cfg.Name,
		ServerAddress: cfg.ServerAddress,
	}
	if !loaded {
		return out
	}
	out.Credentials = &MacroscopCredentialsDTO{Login: cfg.Login, Password: cfg.Password}
	out.ServerInfo = &MacroscopServerInfoDTO{
		ID:           cfg.ServerID,
		Version:      cfg.ServerVersion,
		ResponseDate: cfg.InfoResponseTime,
		TZ:           cfg.ServerTZ,
		UseTZ:        cfg.ServerUseTZ != nil && *cfg.ServerUseTZ,
	}
	return out
}

// maskedConfigDTO renders the stored, still-masked credentials.
func (s *Service) maskedConfigDTO(cfg *MacroscopConfig) *MacroscopAgentConfigDTO {
	return s.configDTO(cfg, true)
}

// unmaskConfigDTO decrypts the credentials of a rendered configuration.
func (s *Service) unmaskConfigDTO(dto *MacroscopAgentConfigDTO) *MacroscopAgentConfigDTO {
	if dto == nil || dto.Credentials == nil {
		return dto
	}
	dto.Credentials.Login = s.Cipher.Decrypt(dto.Credentials.Login, s.XorSecret)
	dto.Credentials.Password = s.Cipher.Decrypt(dto.Credentials.Password, s.XorSecret)
	return dto
}

// GetMSServerInfoByCreds probes a Macroscop server the caller supplies directly,
// without a registered configuration.
//
// This is the "test connection" form of the server-info call: an operator
// types an address, a login and a password into a form and wants to know whether
// they work before committing them to a configuration. The access check is the
// same as for a registered server, because the response describes an internal
// server - its id, its version and the time it thinks it is.
//
// The password arrives in clear text over the same TLS connection as everything
// else and is hashed immediately; it is never stored.
func (s *Service) GetMSServerInfoByCreds(ctx context.Context, acc *Access, in *MacroscopCredentialsRequestDTO) (MacroscopDataResponse[*MacroscopServerInfoDTO], error) {
	if !acc.IsAllowedAllActions() {
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{}, httpx.Forbidden("Access denied")
	}
	if in == nil {
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{}, httpx.BadRequest("Request body is required")
	}
	if in.Address == "" || in.Login == "" {
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{}, httpx.BadRequest(
			"address: must not be blank, login: must not be blank, password: must not be blank")
	}
	return s.MS.GetServerInfo(ctx, &MacroscopServerCredentials{
		Address:      in.Address,
		Login:        in.Login,
		PasswordHash: common.Md5HashUtf(&in.Password),
	}), nil
}
