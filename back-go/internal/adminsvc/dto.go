package adminsvc

import (
	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// The wire DTOs for service-admin.
//
// Field names and nullability are the contract with the Angular front-end and
// are reproduced exactly. Two of them carry a deliberate Java quirk, marked
// below, where MapStruct ignored fields the UI still reads; those are documented
// in MIGRATION.md rather than silently changed, because the front-end was built
// against the shape the backend actually returns.

// OrganizationListDTO mirrors core-web OrganizationListDto: the access service's
// create and list payload.
type OrganizationListDTO struct {
	ID        string `json:"id"`
	ShortName string `json:"shortName"`
	FullName  string `json:"fullName"`
}

// OrganizationItemDTO mirrors admin.OrganizationItemDto, which adds the
// membership array. Users is an array, never omitted, and a collection with no
// members renders as [] because the Java mapper always produced an array.
type OrganizationItemDTO struct {
	ID        string   `json:"id"`
	ShortName string   `json:"shortName"`
	FullName  string   `json:"fullName"`
	Users     []string `json:"users"`
}

// UserListItemDTO mirrors core-web UserListItemDto.
//
// Approved, Roles and Organizations are always false / null / null: the
// AccessModelMapper that produced this DTO ignored all three because app_users
// has no such columns. The front-end treats a null roles list as "no roles", so
// reproducing it is safe, and a nil Go slice marshals as null, which is what
// Jackson emitted. See MIGRATION.md, "Inherited limitations".
type UserListItemDTO struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	DisplayName   *string  `json:"displayName"`
	Active        bool     `json:"active"`
	Approved      bool     `json:"approved"`
	Roles         []string `json:"roles"`
	Organizations []string `json:"organizations"`
}

// OrgStructListDTO mirrors lib OrgStructListDto, the dictionary payload.
type OrgStructListDTO struct {
	ID              string `json:"id"`
	ShortName       string `json:"shortName"`
	FullName        string `json:"fullName"`
	CRMAgentSet     bool   `json:"crmAgentSet"`
	EventAgentsSet  bool   `json:"eventAgentsSet"`
	CameraAgentsSet bool   `json:"cameraAgentsSet"`
}

// AgentTypeDTO mirrors the per-family CrmAgentTypeDto, EvtAgentTypeDto and
// ImgAgentTypeDto, which are structurally identical.
type AgentTypeDTO struct {
	Value       string `json:"value"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// AgentConfigDTO mirrors CrmAgentConfigDto, EvtAgentConfigDto and
// ImgAgentConfigDto, which are structurally identical: the config row's id,
// which is also the owning agent's id, and the agent type denormalised onto it.
type AgentConfigDTO struct {
	ID        string  `json:"id"`
	AgentType *string `json:"agentType"`
}

// CrmAgentListDTO mirrors CrmAgentListDto. Also the create payload, whose
// agentType is @NotBlank.
type CrmAgentListDTO struct {
	ID             string  `json:"id"`
	OrganizationID *string `json:"organizationId"`
	AgentType      string  `json:"agentType"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Configured     bool    `json:"configured"`
}

// CrmOrganizationDTO mirrors CrmOrganizationDto: only the id and the external
// organization's name are exposed.
type CrmOrganizationDTO struct {
	ID   string  `json:"id"`
	Name *string `json:"name"`
}

// CrmServiceDTO mirrors CrmServiceDto.
type CrmServiceDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CrmAgentItemDTO mirrors CrmAgentItemDto.
type CrmAgentItemDTO struct {
	ID              string              `json:"id"`
	OrganizationID  *string             `json:"organizationId"`
	AgentType       *string             `json:"agentType"`
	Name            string              `json:"name"`
	Description     *string             `json:"description"`
	Configured      bool                `json:"configured"`
	Config          *AgentConfigDTO     `json:"config"`
	CRMOrganization *CrmOrganizationDTO `json:"crmOrganization"`
	Services        []CrmServiceDTO     `json:"services"`
}

// EvtAgentListDTO mirrors EvtAgentListDto. Also the create payload.
type EvtAgentListDTO struct {
	ID             string  `json:"id"`
	OrganizationID *string `json:"organizationId"`
	AgentType      string  `json:"agentType"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Configured     bool    `json:"configured"`
}

// EvtPlaceListDTO mirrors EvtPlaceListDto.
type EvtPlaceListDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// EvtAgentItemDTO mirrors EvtAgentItemDto.
type EvtAgentItemDTO struct {
	ID             string            `json:"id"`
	OrganizationID *string           `json:"organizationId"`
	AgentType      *string           `json:"agentType"`
	Name           string            `json:"name"`
	Description    *string           `json:"description"`
	Configured     bool              `json:"configured"`
	Config         *AgentConfigDTO   `json:"config"`
	Places         []EvtPlaceListDTO `json:"places"`
}

// ImgAgentListDTO mirrors ImgAgentListDto. Also the create payload.
type ImgAgentListDTO struct {
	ID             string  `json:"id"`
	OrganizationID *string `json:"organizationId"`
	AgentType      string  `json:"agentType"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	Configured     bool    `json:"configured"`
}

// ImgPlaceListDTO mirrors ImgPlaceListDto.
type ImgPlaceListDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ImgAgentItemDTO mirrors ImgAgentItemDto.
type ImgAgentItemDTO struct {
	ID             string            `json:"id"`
	OrganizationID *string           `json:"organizationId"`
	AgentType      *string           `json:"agentType"`
	Name           string            `json:"name"`
	Description    *string           `json:"description"`
	Configured     bool              `json:"configured"`
	Config         *AgentConfigDTO   `json:"config"`
	Places         []ImgPlaceListDTO `json:"places"`
}

// TestResponse mirrors admin.TestResponse, the payload of every /api/v1/test
// endpoint. Roles and Permissions are comma-space joined strings, not arrays,
// and are absent (null) for the unauthenticated probe rather than empty.
type TestResponse struct {
	Message     string               `json:"message"`
	Username    *string              `json:"username"`
	UserID      *string              `json:"userId"`
	Roles       *string              `json:"roles"`
	Permissions *string              `json:"permissions"`
	Timestamp   common.LocalDateTime `json:"timestamp"`
	Success     bool                 `json:"success"`
}
