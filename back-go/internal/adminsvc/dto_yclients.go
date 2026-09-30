package adminsvc

// The YClients wire DTOs.
//
// Every YClients call returns a YClientsDataResponse envelope rather than a
// bare payload, so a partner whose account is suspended or whose plan has run
// out still produces a 200 from this service with success=false and an
// errorMessage the front-end can show. That envelope is part of the contract and
// is reproduced field for field.

// YClientCredentialsDTO mirrors YClientCredentialsDto: the partner token that
// identifies the integration and the user token that scopes it to one employee.
type YClientCredentialsDTO struct {
	PartnerToken *string `json:"partnerToken"`
	UserToken    *string `json:"userToken"`
}

// YClientsAgentConfigDTO mirrors YClientsAgentConfigDto. Id is the CRM agent id,
// never the credential row id; the credential row shares it.
type YClientsAgentConfigDTO struct {
	ID          string                 `json:"id"`
	Credentials *YClientCredentialsDTO `json:"credentials"`
}

// YClientsDataResponse is the generic YClients envelope.
//
// Meta carries the upstream's own metadata block, which YClients populates with a
// "message" key on failure. It is a map, so an absent block renders as null and
// an empty one as {}, exactly as Jackson did.
type YClientsDataResponse[T any] struct {
	StatusCode    int               `json:"statusCode"`
	StatusMessage *string           `json:"statusMessage"`
	Success       bool              `json:"success"`
	ErrorMessage  *string           `json:"errorMessage"`
	Data          T                 `json:"data"`
	Meta          map[string]string `json:"meta"`
}

// YClientsTokenRequestDTO mirrors YClientsTokenRequestDto, the body of
// POST /api/v1/yc/misc/get-token. It carries a plain login and password rather
// than a user token, because this is how a user obtains one.
type YClientsTokenRequestDTO struct {
	PartnerToken string `json:"partnerToken"`
	Login        string `json:"login"`
	Password     string `json:"password"`
}

// YClientsTokenResponseDTO mirrors YClientsTokenResponseDto: the envelope plus
// the issued user token, which is absent when the exchange failed.
type YClientsTokenResponseDTO struct {
	StatusCode    int     `json:"statusCode"`
	StatusMessage *string `json:"statusMessage"`
	Success       bool    `json:"success"`
	ErrorMessage  *string `json:"errorMessage"`
	UserToken     *string `json:"userToken"`
}

// YClientsOrganizationDTO mirrors YClientsOrganizationDto.
//
// Places is deliberately always null: YClientsModelMapper ignored the association
// when building this DTO, so the front-end fetches places through
// /agents/{id}/places. See MIGRATION.md, "Inherited limitations".
type YClientsOrganizationDTO struct {
	ID       string   `json:"id"`
	Places   []string `json:"places"`
	AgentID  *string  `json:"agentId"`
	YCID     *int64   `json:"ycId"`
	Name     *string  `json:"name"`
	Timezone *string  `json:"timezone"`
}

// YClientsServiceCategoryDTO mirrors YClientsServiceCategoryDto. Id is the
// external YClients category id, and OrgID the external YClients company id, not
// the local organization UUID.
type YClientsServiceCategoryDTO struct {
	ID    *int64  `json:"id"`
	Name  *string `json:"name"`
	OrgID *int64  `json:"orgId"`
}

// YClientsServiceDTO mirrors YClientsServiceDto. It doubles as the upstream
// search result, where the local id is absent and only ycId/ycName are set.
type YClientsServiceDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	YCID       int64  `json:"ycId"`
	YCName     string `json:"ycName"`
	CategoryID int64  `json:"categoryId"`
}

// YClientsPlaceDTO mirrors YClientsPlaceDto. As with services, a place returned
// by a YClients search has no local id.
type YClientsPlaceDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	YCID      int64  `json:"ycId"`
	YCName    string `json:"ycName"`
	Available bool   `json:"available"`
}
