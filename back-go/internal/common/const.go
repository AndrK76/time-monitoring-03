package common

// Constants mirrored from ru.igorit.monitoring.common.AuthConstants.
const (
	AnonymousUser   = "anonymousUser"
	AnonymousUserID = "00000000-0000-0000-0000-000000000000"
	SystemUser      = "system"
	SystemUserID    = "ffffffff-ffff-ffff-ffff-ffffffffffff"
)

// CommandMessageType mirrors ru.igorit.monitoring.common.enums.command.CommandMessageType.
type CommandMessageType string

const (
	CmdUserInfoUpdated         CommandMessageType = "USER_INFO_UPDATED"
	CmdUserCreated             CommandMessageType = "USER_CREATED"
	CmdOrganizationInfoChanged CommandMessageType = "ORGANIZATION_INFO_CHANGED"
)

// OrgChangeMode mirrors OrganizationInfoChangedEventCommandDto.Mode.
type OrgChangeMode string

const (
	ModeAdd           OrgChangeMode = "ADD"
	ModeUpdate        OrgChangeMode = "UPDATE"
	ModeDelete        OrgChangeMode = "DELETE"
	ModeUpdateName    OrgChangeMode = "UPDATE_NAME"
	ModeUpdateCRMBind OrgChangeMode = "UPDATE_CRM_BIND"
	ModeUpdateEvtBind OrgChangeMode = "UPDATE_EVT_BIND"
	ModeUpdateImgBind OrgChangeMode = "UPDATE_IMG_BIND"
)
