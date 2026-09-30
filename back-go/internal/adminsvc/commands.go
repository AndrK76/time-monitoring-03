package adminsvc

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// The inbound half of service-admin.
//
// service-auth is the only producer of user events and service-admin the only
// consumer: it keeps a mirror of the user list so the access-management screen
// can list users and their organizations without a cross-service call. The mirror
// is write-only from this service's point of view - nothing here ever publishes
// a user change back - so the handler is deliberately one-directional and every
// event is applied idempotently.

// userInfoUpdatedEvent mirrors UserInfoUpdatedEventCommandDto.
//
// Full distinguishes the two things the same event type carries. A partial event
// is emitted whenever a user's profile changes and reports only the fields that
// changed; a full event is emitted when the account's validity or roles change
// and reports everything. Both are applied the same way here, because the mirror
// row has no partial state: an absent field in the event means "unchanged", and
// the Java mapper copied absent fields as null, overwriting the mirror with
// nulls. The Go handler skips absent fields instead. See MIGRATION.md,
// "Fixed defects": a partial USER_INFO_UPDATED blanked the mirrored columns.
type userInfoUpdatedEvent struct {
	UserID      string   `json:"userId"`
	Username    string   `json:"username"`
	Email       *string  `json:"email"`
	FirstName   *string  `json:"firstName"`
	LastName    *string  `json:"lastName"`
	DisplayName *string  `json:"displayName"`
	Active      *bool    `json:"active"`
	Approved    *bool    `json:"approved"`
	Roles       []string `json:"roles"`
	Full        bool     `json:"fullUpdate"`
}

// userCreatedEvent mirrors UserCreatedEventCommandDto.
type userCreatedEvent struct {
	UserID      string  `json:"userId"`
	Username    string  `json:"username"`
	Email       *string `json:"email"`
	FirstName   *string `json:"firstName"`
	LastName    *string `json:"lastName"`
	DisplayName *string `json:"displayName"`
	Active      bool    `json:"active"`
	Approved    bool    `json:"approved"`
	Roles       []string
}

// HandleCommand is the queue handler.
//
// The two user command types are applied and everything else is logged and
// ignored, which is what the Java switch did. An unknown command type is a
// warning rather than an error: a newer service-auth may publish command types
// this build predates, and refusing them would stop the consumer entirely.
func (s *Service) HandleCommand(ctx context.Context, cmd *common.CommandMessage) error {
	if s.Log != nil {
		s.Log.Info("received command", "commandType", cmd.CommandType, "source", cmd.SourceService)
	}
	switch cmd.CommandType {
	case common.CmdUserInfoUpdated:
		var evt userInfoUpdatedEvent
		if err := decodePayload(cmd.Payload, &evt); err != nil {
			return err
		}
		return s.ApplyUserUpdated(ctx, &evt)
	case common.CmdUserCreated:
		var evt userCreatedEvent
		if err := decodePayload(cmd.Payload, &evt); err != nil {
			return err
		}
		return s.ApplyUserCreated(ctx, &evt)
	default:
		if s.Log != nil {
			s.Log.Warn("command type not processed", "commandType", cmd.CommandType)
		}
		return nil
	}
}

func decodePayload(raw json.RawMessage, target any) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, target)
}

// ApplyUserUpdated mirrors an updated user into admin.app_users.
//
// The row is created when it is unknown, so a service-auth that starts after
// service-admin still converges without a separate backfill. The two derived
// fields follow the Java expressions: is_valid is the conjunction of active and
// approved, and roles is the comma-joined list, which is the empty string rather
// than null when the list is empty.
func (s *Service) ApplyUserUpdated(ctx context.Context, evt *userInfoUpdatedEvent) error {
	if evt == nil || evt.UserID == "" {
		return nil
	}
	row := &AppUser{
		ID:       evt.UserID,
		Username: evt.Username,
	}
	if evt.DisplayName != nil {
		row.DisplayName = evt.DisplayName
	} else if name := joinNonBlank(evt.FirstName, evt.LastName); name != "" {
		// service-auth sends a composed display name on a full update. A
		// partial event may omit it, in which case the existing value is kept
		// rather than blanked.
		row.DisplayName = &name
	}
	if evt.Active != nil && evt.Approved != nil {
		row.Valid = *evt.Active && *evt.Approved
	} else {
		row.Valid = false
	}
	joined := strings.Join(evt.Roles, ",")
	row.Roles = &joined
	if err := s.Store.UpsertUser(ctx, s.Store.pool, row); err != nil {
		return err
	}
	if s.Log != nil {
		s.Log.Debug("user mirrored", "username", evt.Username, "full", evt.Full)
	}
	return nil
}

// ApplyUserCreated mirrors a newly created user.
//
// The Java mapper deliberately left the validity flag and the roles null on the
// create event, because at creation time the account has neither been approved
// nor granted roles by anyone. That is preserved: a created user is stored
// invalid with no roles, and only a subsequent update grants them.
func (s *Service) ApplyUserCreated(ctx context.Context, evt *userCreatedEvent) error {
	if evt == nil || evt.UserID == "" {
		return nil
	}
	existing, err := s.Store.FindUser(ctx, s.Store.pool, evt.UserID)
	if err != nil {
		return err
	}
	if existing != nil {
		if s.Log != nil {
			s.Log.Debug("user already mirrored", "username", evt.Username)
		}
		return nil
	}
	row := &AppUser{ID: evt.UserID, Username: evt.Username}
	if evt.DisplayName != nil {
		row.DisplayName = evt.DisplayName
	} else if name := joinNonBlank(evt.FirstName, evt.LastName); name != "" {
		row.DisplayName = &name
	}
	if err := s.Store.UpsertUser(ctx, s.Store.pool, row); err != nil {
		return err
	}
	if s.Log != nil {
		s.Log.Debug("user mirrored on create", "username", evt.Username)
	}
	return nil
}

// joinNonBlank composes a display name from the parts, skipping absent or blank
// ones. The names arrive as separate fields because service-auth stores them
// that way; the mirror stores only the composed form.
func joinNonBlank(first, last *string) string {
	parts := make([]string, 0, 2)
	for _, p := range []*string{first, last} {
		if p != nil && strings.TrimSpace(*p) != "" {
			parts = append(parts, strings.TrimSpace(*p))
		}
	}
	return strings.Join(parts, " ")
}
