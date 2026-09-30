// Package monsvc is the entire domain of service-monitoring.
//
// The monitoring service has no HTTP surface and no business logic of its own:
// it keeps a copy of the organization dictionary so the data it later stores
// can be labelled with a name and a set of agent flags without a cross-service
// call at write time. The copy is built exclusively from the
// ORGANIZATION_INFO_CHANGED commands service-admin publishes, which is why this
// package is one store, one row type and one command handler.
package monsvc

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
)

// Store is the repository over the mon.organizations mirror.
type Store struct {
	Pool *db.Pool
}

// NewStore builds the monitoring repository.
func NewStore(pool *db.Pool) *Store {
	return &Store{Pool: pool}
}

// SaveOrganization writes one organization row, merging the same subset of
// fields the Java handler did: exactly which depends on the mode, and the mode
// is expressed by which arguments are nil. On an existing row the nil group is
// left untouched (COALESCE back to the stored value), on a missing row it is
// written as SQL NULL, which is what Hibernate's plain insert did.
//
// flag is the dictionary column a bind mode changes, or "" for the name modes,
// which change the names and nothing else.
func (s *Store) SaveOrganization(ctx context.Context, q db.Querier, id, shortName, fullName string,
	createdAt, createdBy, updatedAt, updatedBy any, flag string, flagVal bool) error {
	cols := "id, short_name, full_name, created_at, created_by, updated_at, updated_by"
	args := []any{id, shortName, fullName, createdAt, createdBy, updatedAt, updatedBy}
	if flag != "" {
		cols += ", " + flag
		args = append(args, flagVal)
	}
	flagSet := ""
	if flag != "" {
		flagSet = ", " + flag + " = EXCLUDED." + flag
	}
	placeholder := ", $8"
	if flag == "" {
		placeholder = ""
	}
	_, err := q.Exec(ctx, `
		INSERT INTO organizations (`+cols+`)
		VALUES ($1, $2, $3, $4, $5, $6, $7`+placeholder+`)
		ON CONFLICT (id) DO UPDATE SET
			short_name = EXCLUDED.short_name,
			full_name  = EXCLUDED.full_name,
			created_at = COALESCE(EXCLUDED.created_at, organizations.created_at),
			created_by = COALESCE(EXCLUDED.created_by, organizations.created_by),
			updated_at = COALESCE(EXCLUDED.updated_at, organizations.updated_at),
			updated_by = COALESCE(EXCLUDED.updated_by, organizations.updated_by)`+flagSet,
		args...)
	return err
}

// DeleteOrganization drops one mirror row. Deleting an id that is not present
// is not an error, matching Spring Data JPA 3's deleteById.
func (s *Store) DeleteOrganization(ctx context.Context, q db.Querier, id string) error {
	_, err := q.Exec(ctx, `DELETE FROM organizations WHERE id = $1`, id)
	return err
}

// Service handles the commands inbound on the monitoring queue.
type Service struct {
	Store *Store
	Log   *slog.Logger
}

// NewService builds the monitoring command handler.
func NewService(store *Store, log *slog.Logger) *Service {
	return &Service{Store: store, Log: log}
}

// HandleCommand dispatches one consumed command.
//
// Only ORGANIZATION_INFO_CHANGED is expected. Anything else is logged and
// acknowledged, because the Java listener acknowledged everything too and the
// acknowledgement is what keeps one unknown message from stalling the queue.
func (s *Service) HandleCommand(ctx context.Context, cmd *common.CommandMessage) error {
	if s.Log != nil {
		s.Log.Info("received command", "commandType", cmd.CommandType, "source", cmd.SourceService)
	}
	if cmd.CommandType != common.CmdOrganizationInfoChanged {
		if s.Log != nil {
			s.Log.Warn("command type not processed", "commandType", cmd.CommandType)
		}
		return nil
	}
	var evt common.OrgChangeEvent
	if err := decodePayload(cmd.Payload, &evt); err != nil {
		return err
	}
	return s.ApplyOrgEvent(ctx, &evt)
}

func decodePayload(raw json.RawMessage, target any) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, target)
}

// ApplyOrgEvent mirrors one organization change into the mirror row.
//
// The branch structure follows DictEventsReceiveService.applyOrgEvent exactly:
// the three name modes, then DELETE, then the three bind modes. Errors are
// returned instead of swallowed so the handler boundary can test them; the
// message is acknowledged either way, which is what the Java catch did.
func (s *Service) ApplyOrgEvent(ctx context.Context, evt *common.OrgChangeEvent) error {
	if evt == nil || evt.OrgID == "" {
		return nil
	}
	switch evt.Mode {
	case common.ModeAdd, common.ModeUpdate, common.ModeUpdateName:
		var createdAt, createdBy, updatedAt, updatedBy any
		if evt.Mode == common.ModeAdd {
			createdAt = db.LocalTimeValue(evt.UpdatedAt)
			createdBy = db.StringValue(evt.UpdatedBy)
		} else {
			updatedAt = db.LocalTimeValue(evt.UpdatedAt)
			updatedBy = db.StringValue(evt.UpdatedBy)
		}
		return s.save(ctx, evt, "", false, createdAt, createdBy, updatedAt, updatedBy)
	case common.ModeDelete:
		return s.Store.DeleteOrganization(ctx, s.Store.Pool, evt.OrgID)
	case common.ModeUpdateCRMBind:
		return s.save(ctx, evt, "crm_agent_set", evt.CRMAgentSet, nil, nil, nil, nil)
	case common.ModeUpdateEvtBind:
		return s.save(ctx, evt, "events_agents_set", evt.EventAgentsSet, nil, nil, nil, nil)
	case common.ModeUpdateImgBind:
		// Java wrote eventAgentsSet into the camera column here, so the flag
		// the event reported was the wrong one whenever the two differed. The
		// camera flag is read out of the event's own camera field. See
		// MIGRATION.md, "Fixed defects".
		return s.save(ctx, evt, "camera_agents_set", evt.CameraAgentsSet, nil, nil, nil, nil)
	default:
		if s.Log != nil {
			s.Log.Warn("unknown organization event mode", "mode", evt.Mode, "orgId", evt.OrgID)
		}
		return nil
	}
}

func (s *Service) save(ctx context.Context, evt *common.OrgChangeEvent, flag string, flagVal bool,
	createdAt, createdBy, updatedAt, updatedBy any) error {
	short, full := "", ""
	if evt.ShortName != nil {
		short = *evt.ShortName
	}
	if evt.FullName != nil {
		full = *evt.FullName
	}
	if flag != "" {
		// A bind mode stamps updated_at/updated_by and leaves the created group
		// alone. The event carries the names, so a missing row can be
		// recreated from a bind event too; Java inserted a row with null names
		// instead, hit the NOT NULL constraint, and dropped the event.
		createdAt, createdBy = nil, nil
		updatedAt = db.LocalTimeValue(evt.UpdatedAt)
		updatedBy = db.StringValue(evt.UpdatedBy)
	}
	return s.Store.SaveOrganization(ctx, s.Store.Pool, evt.OrgID, short, full,
		createdAt, createdBy, updatedAt, updatedBy, flag, flagVal)
}
