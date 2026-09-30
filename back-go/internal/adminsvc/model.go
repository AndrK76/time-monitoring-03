// Package adminsvc is service-admin: the organization dictionary, user access
// management, and the three agent families (CRM, event, camera) with their
// YClients and Macroscop configurations.
//
// It owns the `admin` PostgreSQL schema and is the only publisher of
// organization lifecycle events; service-auth and service-monitoring consume
// them.
package adminsvc

import (
	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// Organization mirrors the admin.organizations row.
//
// Two JPA entities were mapped to this one table in the Java services -
// core-persistence AppOrganization (with the users collection) and
// lib-monitoring Organization (with the three agent flags). They are merged
// here: the access service needs the membership, the dictionary service and the
// agent services need the flags, and no endpoint exposes one without the other.
type Organization struct {
	ID        string
	ShortName string
	FullName  string

	// The three flags record that at least one agent of the family is bound to
	// this organization. They are what service-monitoring keeps in sync through
	// the *_BIND organization events.
	CRMAgentSet     bool
	EventAgentsSet  bool
	CameraAgentsSet bool

	CreatedAt *common.LocalDateTime
	CreatedBy *string
	UpdatedAt *common.LocalDateTime
	UpdatedBy *string
}

// AppUser mirrors admin.app_users, the local mirror of an auth user that the
// service-auth user events keep up to date. It carries no password and no
// email: the only fields the events carry that the dictionary needs are the
// identity, the display name, the validity flag, and the role names.
type AppUser struct {
	ID          string
	Username    string
	DisplayName *string
	Valid       bool
	// Roles is the comma-joined role name list, exactly as the event payload
	// delivered it: ServiceEventsReceiveService joins the array with "," and
	// stores the result in the single text column.
	Roles *string
}

// UserOrganization mirrors admin.user_organizations, the membership join.
type UserOrganization struct {
	ID             string
	OrganizationID string
	UserID         string
	CreatedAt      *common.LocalDateTime
	CreatedBy      *string
}

// AgentType is one of the closed sets of agent implementations. The three
// families each have their own enum, and the wire value is the enum constant
// name, matched case-insensitively on input.
type AgentType struct {
	// Value is the enum name, which is also the agent_type column value and the
	// DTO's agentType field.
	Value string
	// Name and Description are the human-readable labels the front-end shows in
	// the agent-type picker.
	Name        string
	Description string
	// Discriminator is the type_discriminator column value of the subclass
	// Hibernate wrote, which must be reproduced so the joined-subtype tables
	// keep resolving.
	Discriminator string
}

// CRM agent types, from CrmAgentType.
var (
	AgentTypeYClients = AgentType{
		Value: "YClients", Name: "YClients CRM", Description: "YClients CRM", Discriminator: "YCLIENTS",
	}
)

// Event agent types, from EvtAgentType.
var (
	AgentTypeMacroscopEvt = AgentType{
		Value: "Macroscop", Name: "Macroscop", Description: "Macroscop API", Discriminator: "MACROSCOP",
	}
	AgentTypeZigbee = AgentType{
		Value: "Zigbee", Name: "ZigbeeDevice", Description: "Zigbee Devices Service", Discriminator: "ZIGBEE",
	}
)

// Camera agent types, from ImgAgentType.
var (
	AgentTypeMacroscopImg = AgentType{
		Value: "Macroscop", Name: "Macroscop", Description: "Macroscop API", Discriminator: "MACROSCOP",
	}
)

// Agent mirrors a row of crm_agents, evt_agents or img_agents.
//
// The three tables have the same shape apart from crm_agents.crm_organization_id,
// so one struct serves all three; a nil CRMOrganizationID is a genuinely absent
// column for the event and camera families rather than a NULL value.
type Agent struct {
	ID             string
	Discriminator  string
	OrganizationID *string
	AgentType      string
	Name           string
	Description    *string
	Configured     bool

	// CRMOrganizationID links a CRM agent to the external CRM organization
	// (crm_organizations) it synchronises.
	CRMOrganizationID *string

	CreatedAt *common.LocalDateTime
	CreatedBy *string
	UpdatedAt *common.LocalDateTime
	UpdatedBy *string
}

// CRMOrganization mirrors a crm_organizations row. Only the YClients subtype
// exists, so the YClients* fields are the only ones read.
type CRMOrganization struct {
	ID            string
	Discriminator string
	YcID          *int64
	YcName        *string
	YcTZ          *string
	CreatedAt     *common.LocalDateTime
	CreatedBy     *string
	UpdatedAt     *common.LocalDateTime
	UpdatedBy     *string
}

// CRMService mirrors a crm_services row: one YClients service registered for an
// agent.
type CRMService struct {
	ID                string
	Discriminator     string
	Name              string
	AgentID           *string
	YcID              int64
	YcName            *string
	ServiceCategoryID *int64
	CreatedAt         *common.LocalDateTime
	CreatedBy         *string
	UpdatedAt         *common.LocalDateTime
	UpdatedBy         *string
}

// CRMPlace mirrors a crm_places row: one YClients employee (a "place") attached
// to a CRM organization.
type CRMPlace struct {
	ID             string
	Discriminator  string
	Name           string
	OrganizationID *string
	YcID           int64
	YcName         *string
	Available      bool
	CreatedAt      *common.LocalDateTime
	CreatedBy      *string
	UpdatedAt      *common.LocalDateTime
	UpdatedBy      *string
}

// AgentPlace mirrors an evt_places or img_places row. Nothing in the codebase
// writes these tables; they are read through the agent DTOs, which is why the
// family services return them but expose no mutation endpoint.
type AgentPlace struct {
	ID        string
	Name      string
	Available bool
}

// YCServiceCategory mirrors yc_service_categories, whose primary key is the
// YClients category id rather than a generated UUID.
type YCServiceCategory struct {
	YcID           int64
	YcName         *string
	AgentID        *string
	OrganizationID *string
	CreatedAt      *common.LocalDateTime
	CreatedBy      *string
	UpdatedAt      *common.LocalDateTime
	UpdatedBy      *string
}

// MacroscopConfig mirrors macroscop_agent_configs.
//
// The credentials and server-info columns are embedded in the Java entity, so
// they are flat here. Password is stored XOR-masked with the store secret and is
// only ever decrypted on the way out, exactly as in the Java service.
type MacroscopConfig struct {
	ID            string
	Name          string
	ServerAddress *string
	Login         *string
	Password      *string

	ServerID      *string
	ServerVersion *string
	// InfoResponseTime is a TIMESTAMP WITH TIME ZONE, unlike every other audit
	// column in this schema.
	InfoResponseTime *common.OffsetDateTime
	ServerTZ         *string
	ServerUseTZ      *bool

	CreatedAt *common.LocalDateTime
	CreatedBy *string
	UpdatedAt *common.LocalDateTime
	UpdatedBy *string
}

// HasCredentials reports whether both halves of the login are present. A loaded
// row always has the embeddable instantiated, so the fields themselves are the
// test, matching MacroscopManageService._getCredsByConfigId.
func (c *MacroscopConfig) HasCredentials() bool {
	return c != nil && !isBlank(c.ServerAddress) && !isBlank(c.Login)
}

// MacroscopChannel mirrors macroscop_agent_channels, one camera channel of one
// Macroscop server. The Macroscop-side id is channel_id; the surrogate primary
// key is the local id, because macroscop_channel_streams keys on it.
type MacroscopChannel struct {
	ID               string
	ConfigID         string
	MacroscopID      string
	Name             *string
	Device           *string
	Enabled          bool
	Exists           bool
	Used             bool
	ArchivingEnabled bool
	ArchiveAllowed   bool
	RealtimeAllowed  bool
	SoundAllowed     bool
	ArchiveMode      *string
	TZ               *string

	Streams []MacroscopChannelStream

	CreatedAt *common.OffsetDateTime
	CreatedBy *string
	UpdatedAt *common.OffsetDateTime
	UpdatedBy *string
}

// MacroscopChannelStream mirrors one macroscop_channel_streams row.
type MacroscopChannelStream struct {
	Order  int
	Type   *string
	Format *string
}

// ArchiveMode is one of the Macroscop recording modes, from
// MacroscopArchiveMode. Name is the DTO's id and Description its name, which is
// how the front-end reads the pair.
type ArchiveMode struct {
	Name        string
	Description string
	// MacroscopID is the value the Macroscop server itself uses in its own
	// channel payload, which differs from the enum name.
	MacroscopID string
}

// ArchiveModes is the enum in declaration order; the API sorts by name.
var ArchiveModes = []ArchiveMode{
	{Name: "Always", MacroscopID: "AlwaysOn", Description: "Всегда включена"},
	{Name: "Manual", MacroscopID: "OnlyManual", Description: "Вручную"},
	{Name: "Schedule", MacroscopID: "BySchedule", Description: "По расписанию"},
	{Name: "Detector", MacroscopID: "MDandManual", Description: "По детектору движения"},
}

// ArchiveModeByName resolves a DTO archiveMode value, case-insensitively.
func ArchiveModeByName(name string) *ArchiveMode {
	if name == "" {
		return nil
	}
	for i := range ArchiveModes {
		if equalFoldIgnoreCase(ArchiveModes[i].Name, name) {
			return &ArchiveModes[i]
		}
	}
	return nil
}

// ArchiveModeNameByMacroscopID resolves the server-side value back to the enum
// name, which is what the channel column stores. An unknown value yields nil,
// matching MacroscopArchiveMode.idByMacroscopId.
func ArchiveModeNameByMacroscopID(id string) *string {
	if id == "" {
		return nil
	}
	for i := range ArchiveModes {
		if equalFoldIgnoreCase(ArchiveModes[i].MacroscopID, id) {
			name := ArchiveModes[i].Name
			return &name
		}
	}
	return nil
}

// BinaryContent mirrors common.dto.common.BinaryContent, the screenshot proxy
// payload: raw bytes plus the upstream content type.
type BinaryContent struct {
	Data        []byte `json:"-"`
	ContentType string `json:"-"`
}
