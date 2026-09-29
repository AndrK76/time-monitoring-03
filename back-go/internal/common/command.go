package common

import (
	"encoding/json"
	"strings"
)

// UserContext mirrors core-common UserContextDto.
//
// Note the comma-joined string encoding of the list-like fields: roles,
// permissions and allowedOrganizations are single strings in the wire format,
// not arrays. The helper accessors below reproduce the Java split helpers.
type UserContext struct {
	UserID               string  `json:"userId"`
	Username             string  `json:"username"`
	Email                *string `json:"email"`
	FirstName            *string `json:"firstName"`
	LastName             *string `json:"lastName"`
	DisplayName          *string `json:"displayName"`
	Roles                string  `json:"roles"`
	Permissions          string  `json:"permissions"`
	AllowedOrganizations string  `json:"allowedOrganizations"`
	SessionID            *string `json:"sessionId"`
	IPAddress            *string `json:"ipAddress"`
	Authenticated        bool    `json:"authenticated"`
}

// SystemUserContext mirrors UserContextDto.system().
func SystemUserContext() *UserContext {
	return &UserContext{
		UserID:        SystemUserID,
		Username:      SystemUser,
		Permissions:   "ALL",
		Authenticated: true,
	}
}

// AnonymousUserContext mirrors UserContextDto.anonymous().
func AnonymousUserContext() *UserContext {
	return &UserContext{
		UserID:        AnonymousUserID,
		Username:      AnonymousUser,
		Authenticated: false,
	}
}

// SplitList reproduces the Java comma-split helper: a blank string yields an
// empty slice, never a slice with one empty element.
func SplitList(s string) []string {
	if strings.TrimSpace(s) == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func (u *UserContext) HasRole(role string) bool {
	for _, r := range SplitList(u.Roles) {
		if r == role {
			return true
		}
	}
	return false
}

func (u *UserContext) HasPermission(perm string) bool {
	for _, p := range SplitList(u.Permissions) {
		if p == perm {
			return true
		}
	}
	return false
}

func (u *UserContext) GetAllowedOrganizationsList() []string {
	return SplitList(u.AllowedOrganizations)
}

func (u *UserContext) IsAllowedOrganization(id string) bool {
	for _, o := range u.GetAllowedOrganizationsList() {
		if o == id {
			return true
		}
	}
	return false
}

// SecurityContext mirrors core-common SecurityContextDto.
type SecurityContext struct {
	Principal     *string  `json:"principal"`
	Credentials   *string  `json:"credentials"`
	Authorities   []string `json:"authorities"`
	Authenticated bool     `json:"authenticated"`
	Name          *string  `json:"name"`
	Details       *string  `json:"details"`
}

// CommandMessage mirrors core-common CommandMessageDto, the RabbitMQ envelope.
type CommandMessage struct {
	CommandID       string             `json:"commandId"`
	CommandType     CommandMessageType `json:"commandType"`
	Payload         json.RawMessage    `json:"payload"`
	UserContext     *UserContext       `json:"userContext"`
	SecurityContext *SecurityContext   `json:"securityContext"`
	Timestamp       *LocalDateTime     `json:"timestamp"`
	SourceService   string             `json:"sourceService"`
	CorrelationID   string             `json:"correlationId"`
	Signature       *string            `json:"signature"`
}

// UserCreatedEvent mirrors UserCreatedEventCommandDto.
type UserCreatedEvent struct {
	UserID      string         `json:"userId"`
	Username    string         `json:"username"`
	Email       string         `json:"email"`
	FirstName   string         `json:"firstName"`
	LastName    string         `json:"lastName"`
	DisplayName string         `json:"displayName"`
	Active      bool           `json:"active"`
	CreatedAt   *LocalDateTime `json:"createdAt"`
	CreatedBy   string         `json:"createdBy"`
}

// UserInfoUpdatedEvent mirrors UserInfoUpdatedEventCommandDto.
type UserInfoUpdatedEvent struct {
	UserID      string         `json:"userId"`
	Username    string         `json:"username"`
	Email       string         `json:"email"`
	FirstName   string         `json:"firstName"`
	LastName    string         `json:"lastName"`
	DisplayName string         `json:"displayName"`
	Active      bool           `json:"active"`
	Approved    bool           `json:"approved"`
	UpdatedAt   *LocalDateTime `json:"updatedAt"`
	UpdatedBy   string         `json:"updatedBy"`
	FullUpdate  bool           `json:"fullUpdate"`
	Roles       []string       `json:"roles"`
}

// OrganizationInfoChangedEvent mirrors OrganizationInfoChangedEventCommandDto.
type OrganizationInfoChangedEvent struct {
	OrgID           string         `json:"orgId"`
	Mode            OrgChangeMode  `json:"mode"`
	ShortName       string         `json:"shortName"`
	FullName        string         `json:"fullName"`
	UpdatedAt       *LocalDateTime `json:"updatedAt"`
	UpdatedBy       string         `json:"updatedBy"`
	Users           []string       `json:"users"`
	CRMAgentSet     bool           `json:"crmAgentSet"`
	EventAgentsSet  bool           `json:"eventAgentsSet"`
	CameraAgentsSet bool           `json:"cameraAgentsSet"`
}

// NewDeleteOrgEvent mirrors OrganizationInfoChangedEventCommandDto#newDeleteEvent:
// only orgId and mode are populated.
func NewDeleteOrgEvent(orgID string) *OrganizationInfoChangedEvent {
	mode := ModeDelete
	return &OrganizationInfoChangedEvent{OrgID: orgID, Mode: mode}
}

// DecodePayload rehydrates a command payload into a concrete struct, mirroring
// CommandReceiver#getPayload. The Java version raises on conversion failure;
// here the error is returned so the listener can log and skip it.
func (c *CommandMessage) DecodePayload(target any) error {
	if len(c.Payload) == 0 || string(c.Payload) == "null" {
		return nil
	}
	return json.Unmarshal(c.Payload, target)
}
