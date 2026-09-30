package adminsvc

import (
	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// The Macroscop wire DTOs.
//
// Macroscop is reached server-side only: this service holds the server
// credentials, masks them at rest, and proxies screenshots. The credentials DTO
// therefore returns an unmasked password to any caller who is allowed to see
// the configuration, which is a narrower set than "any authenticated user" and
// matches what the Java service already did for GET.

// MacroscopCredentialsDTO mirrors MacroscopCredentialsDto.
type MacroscopCredentialsDTO struct {
	Login    *string `json:"login"`
	Password *string `json:"password"`
}

// MacroscopServerInfoDTO mirrors MacroscopServerInfoDto.
//
// TZ is a ZoneOffset rendered as "Z" or "+HH:MM", and UseTZ is a plain boolean
// that is false rather than null for a configuration never contacted: the Java
// mapper used Boolean.TRUE.equals, which collapses NULL to false.
type MacroscopServerInfoDTO struct {
	ID           *string                `json:"id"`
	Version      *string                `json:"version"`
	ResponseDate *common.OffsetDateTime `json:"responseDate"`
	TZ           *string                `json:"tz"`
	UseTZ        bool                   `json:"useTz"`
}

// MacroscopAgentConfigDTO mirrors MacroscopAgentConfigDto, a Macroscop server
// registration. It is both the request and the response body, so ID and Name are
// nullable: the update path distinguishes "rename me" from "leave the name" by
// whether the field is present, and the create path is allowed to omit both.
type MacroscopAgentConfigDTO struct {
	ID            *string                  `json:"id"`
	Name          *string                  `json:"name"`
	ServerAddress *string                  `json:"serverAddress"`
	Credentials   *MacroscopCredentialsDTO `json:"credentials"`
	ServerInfo    *MacroscopServerInfoDTO  `json:"serverInfo"`
}

// MacroscopAgentConfigListDTO mirrors MacroscopAgentConfigListDto: the trimmed
// form used by the configuration list endpoint.
type MacroscopAgentConfigListDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// MacroscopEvtAgentConfigDTO mirrors MacroscopEvtAgentConfigDto, the payload of
// the event-agent configuration endpoints. It has no id of its own: the agent id
// comes from the path.
type MacroscopEvtAgentConfigDTO struct {
	Config *MacroscopAgentConfigDTO `json:"config"`
}

// MacroscopImgAgentConfigDTO mirrors MacroscopImgAgentConfigDto.
type MacroscopImgAgentConfigDTO struct {
	Config *MacroscopAgentConfigDTO `json:"config"`
}

// MacroscopArchiveModeDTO mirrors the MacroscopArchiveModeDto record, whose field
// names are id and name but which carries the enum's name and description. The
// mapping is deliberate - the front-end reads the pair as a value/label select -
// and is preserved.
type MacroscopArchiveModeDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// MacroscopChannelStreamDTO mirrors MacroscopChannelStreamDto.
type MacroscopChannelStreamDTO struct {
	Type   *string `json:"type"`
	Format *string `json:"format"`
}

// MacroscopChannelDTO mirrors MacroscopChannelDto.
type MacroscopChannelDTO struct {
	ID               string                      `json:"id"`
	MacroscopID      string                      `json:"macroscopId"`
	Name             *string                     `json:"name"`
	Device           *string                     `json:"device"`
	Enabled          bool                        `json:"enabled"`
	Exists           bool                        `json:"exists"`
	Used             bool                        `json:"used"`
	ArchivingEnabled bool                        `json:"archivingEnabled"`
	ArchiveAllowed   bool                        `json:"archiveAllowed"`
	RealtimeAllowed  bool                        `json:"realtimeAllowed"`
	SoundAllowed     bool                        `json:"soundAllowed"`
	ArchiveMode      *string                     `json:"archiveMode"`
	TZ               *string                     `json:"tz"`
	Streams          []MacroscopChannelStreamDTO `json:"streams"`
}

// MacroscopServerCredentials is the internal triple used to talk to a Macroscop
// server. PasswordHash is already md5-hashed: the server expects the digest, not
// the password, so the hash is applied at the boundary and never persisted.
type MacroscopServerCredentials struct {
	Address      string
	Login        string
	PasswordHash string
}

// MacroscopDataResponse is the generic Macroscop envelope, the counterpart of
// YClientsDataResponse. ErrorMessage carries the upstream's own text when the
// call failed, so the front-end can distinguish "wrong password" from "server
// unreachable".
type MacroscopDataResponse[T any] struct {
	StatusCode   int     `json:"statusCode"`
	Success      bool    `json:"success"`
	ErrorMessage *string `json:"errorMessage"`
	Data         T       `json:"data"`
}

// MacroscopCredentialsRequestDTO is the body of POST /macroscop/misc/server-info,
// which probes a server that is not registered yet.
//
// The Java record declared the field as passwordHash and overrode the JSON name
// to "password", so the wire name is password while the Java accessor was
// passwordHash; the two are kept apart here so the internal triple is not
// mistaken for request data. The value is the plain password: the md5 digest the
// MSCP API expects is computed at the call boundary and is never accepted from,
// or exposed to, a client.
type MacroscopCredentialsRequestDTO struct {
	Address  string `json:"address"`
	Login    string `json:"login"`
	Password string `json:"password"`
}
