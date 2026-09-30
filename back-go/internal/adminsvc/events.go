package adminsvc

import (
	"context"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// OrgChangeEvent is exported here as a convenience alias; the shared wire type
// lives in common so the consumers (service-auth and service-monitoring) marshal
// the exact same JSON the publisher writes.
type OrgChangeEvent = common.OrgChangeEvent

// orgChangeEvent builds the event for a dictionary-driven change, reading the
// flags from the organization row.
//
// The Java mapper declared all three flags as @Mapping(ignore = true), so every
// published event carried false and every consumer's copy of the flags was reset
// on each update. The flags are read here instead. See MIGRATION.md,
// "Fixed defects": EventCommandMapper ignored the agent-presence flags.
func orgChangeEvent(org *Organization, mode common.OrgChangeMode) *OrgChangeEvent {
	return &OrgChangeEvent{
		OrgID:           org.ID,
		Mode:            mode,
		ShortName:       &org.ShortName,
		FullName:        &org.FullName,
		UpdatedAt:       org.UpdatedAt,
		UpdatedBy:       org.UpdatedBy,
		CRMAgentSet:     org.CRMAgentSet,
		EventAgentsSet:  org.EventAgentsSet,
		CameraAgentsSet: org.CameraAgentsSet,
	}
}

// orgChangeEventWithUsers builds the event for an access-driven change, which
// additionally reports the membership. This is the payload of the ADD, UPDATE
// and UPDATE_NAME modes.
func orgChangeEventWithUsers(org *Organization, mode common.OrgChangeMode, users []string) *OrgChangeEvent {
	evt := orgChangeEvent(org, mode)
	evt.Users = users
	return evt
}

// newDeleteEvent builds the payload of the DELETE mode, which carries only the id:
// a consumer must not try to apply names to a row it is about to drop.
func newDeleteEvent(orgID string) *OrgChangeEvent {
	return &OrgChangeEvent{OrgID: orgID, Mode: common.ModeDelete}
}

// Publisher sends commands to the other services.
//
// The routes differ per event: a bind or unbind only changes the dictionary
// copies, while a create, rename or delete also changes what a logged-in user
// can reach, so it must reach service-auth as well. Publishing the wrong route
// is silent in the Java service, which is why the split is spelled out here
// rather than derived.
type Publisher struct {
	// Publish is app.App.Publish, injected so the service layer can be tested
	// without a broker.
	Publish func(ctx context.Context, route string, cmdType common.CommandMessageType, payload any)
	// Log records a publish failure that the caller chose not to fail on.
	Log func(route string, cmdType common.CommandMessageType, err error)
}

// Routes. They mirror RabbitMQConfig: the topic is mon3.exchange and the keys
// are mon3.<service>.
const (
	RouteAuth = "mon3.auth"
	RouteMon  = "mon3.mon"
)

// NewPublisher builds a Publisher around the application's send function.
//
// The signature mirrors app.App.Publish rather than the rabbit.Client so the
// service layer never learns that RabbitMQ exists, and so a test can substitute
// a recorder for the transport. sourceService is carried on the envelope for
// diagnostics; nothing in the payload depends on it.
func NewPublisher(send func(ctx context.Context, route string, cmdType common.CommandMessageType, payload any)) *Publisher {
	return &Publisher{Publish: send}
}

// publishAuthMon sends an organization event to both the auth and the monitoring
// service, which is what a create, rename, update or delete needs.
func (p *Publisher) publishAuthMon(ctx context.Context, evt *OrgChangeEvent) {
	p.Publish(ctx, RouteAuth, common.CmdOrganizationInfoChanged, evt)
	p.Publish(ctx, RouteMon, common.CmdOrganizationInfoChanged, evt)
}

// publishMon sends an organization event to the monitoring service only, which
// is what an agent bind or unbind needs: it changes no membership and no name.
func (p *Publisher) publishMon(ctx context.Context, evt *OrgChangeEvent) {
	p.Publish(ctx, RouteMon, common.CmdOrganizationInfoChanged, evt)
}

// UserEvent is the mirror row a service-auth user event produces. It is not
// published: service-auth is the only producer, and service-admin only consumes.
//
// The two command shapes are normalised into one Go type because the handlers
// apply them identically; the difference that matters is in the field set, and
// that is expressed by which fields the handler reads.
type UserEvent struct {
	UserID      string
	Username    string
	DisplayName *string
	// Active and Approved are only present on the update event. Java's create
	// handler ignored both and stored a false valid flag; that is reproduced by
	// leaving Valid unset, which the handler does.
	Active   bool
	Approved bool
	Full     bool
	// Roles arrives as an array and is stored comma-joined in the single text
	// column. An empty array becomes the empty string, not null, matching the
	// Java arrToString helper.
	Roles []string
}
