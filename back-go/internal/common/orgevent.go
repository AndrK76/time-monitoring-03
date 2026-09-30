package common

// OrgChangeEvent mirrors OrganizationInfoChangedEventCommandDto, the shared wire
// type for the organization dictionary. service-admin is the only publisher;
// service-auth and service-monitoring keep copies of the dictionary and consume
// it from their queues. Keeping the type here guarantees the producer and the
// two consumers agree on the JSON, which is not something that can be tested
// across services.
type OrgChangeEvent struct {
	OrgID     string         `json:"orgId"`
	Mode      OrgChangeMode  `json:"mode"`
	ShortName *string        `json:"shortName"`
	FullName  *string        `json:"fullName"`
	UpdatedAt *LocalDateTime `json:"updatedAt"`
	UpdatedBy *string        `json:"updatedBy"`
	// Users is the membership at the time of the change. The agent binding
	// flows leave it null, because they are driven from the dictionary side of
	// the model and have no membership to report; the access flows fill it in.
	Users           []string `json:"users"`
	CRMAgentSet     bool     `json:"crmAgentSet"`
	EventAgentsSet  bool     `json:"eventAgentsSet"`
	CameraAgentsSet bool     `json:"cameraAgentsSet"`
}
