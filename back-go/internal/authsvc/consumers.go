package authsvc

import (
	"context"
	"log/slog"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
)

// HandleCommand applies one command consumed from the auth queue.
//
// The queue's routing key is mon3.auth, which carries the ORGANIZATION_INFO_CHANGED
// events service-admin publishes for the organizations it owns. This service is
// the read side of that dictionary: it mirrors the names into auth.organizations
// and, for ADD/UPDATE/DELETE, reconciles user_organizations so the membership
// every login checks stays consistent with the admin service's edits. The bind
// modes never reach this queue (service-admin sends those only to mon3.mon), and
// are ignored here the way the Java switch ignored them.
func (s *Service) HandleCommand(ctx context.Context, cmd *common.CommandMessage) error {
	if cmd.CommandType != common.CmdOrganizationInfoChanged {
		slog.Warn("command type not processed", "commandType", cmd.CommandType)
		return nil
	}
	var evt common.OrgChangeEvent
	if err := cmd.DecodePayload(&evt); err != nil {
		return err
	}
	slog.Info("applying organization event", "mode", evt.Mode, "orgId", evt.OrgID)
	return s.ApplyOrgEvent(ctx, &evt)
}

// ApplyOrgEvent mirrors OrganizationEventsReceiveService.applyChangeEvent.
//
// The branch structure matches the Java service exactly: the three name modes
// update the row and reconcile membership (ADD and UPDATE only), DELETE removes
// the org from every member and drops the row, and anything else — the bind
// modes, an unknown mode — is a no-op.
func (s *Service) ApplyOrgEvent(ctx context.Context, evt *common.OrgChangeEvent) error {
	if evt == nil || evt.OrgID == "" {
		return nil
	}
	switch evt.Mode {
	case common.ModeAdd, common.ModeUpdate, common.ModeUpdateName:
		return s.applyOrgUpsert(ctx, evt)
	case common.ModeDelete:
		return s.applyOrgDelete(ctx, evt)
	default:
		slog.Warn("organization event mode ignored", "mode", evt.Mode, "orgId", evt.OrgID)
		return nil
	}
}

// applyOrgUpsert writes the names, then reconciles membership for ADD/UPDATE.
//
// Membership reconciliation follows the Java set arithmetic: the org is removed
// from members the event no longer lists, and granted to newly listed users.
// The event's user ids are first filtered through app_users, because Java
// resolved them through getUsersByIds and silently dropped ids that were not
// users, and the same is reproduced here rather than surfacing a foreign-key
// error on a stale event.
func (s *Service) applyOrgUpsert(ctx context.Context, evt *common.OrgChangeEvent) error {
	return s.pool.InTx(ctx, func(q db.Querier) error {
		existing, err := s.store.UserIDsForOrganization(ctx, q, evt.OrgID)
		if err != nil {
			return err
		}
		newUsers, err := s.store.ExistingUserIDs(ctx, q, evt.Users)
		if err != nil {
			return err
		}
		if err := s.store.UpsertOrganization(ctx, q, Organization{
			ID:        evt.OrgID,
			ShortName: deref(evt.ShortName),
			FullName:  deref(evt.FullName),
		}); err != nil {
			return err
		}
		if evt.Mode != common.ModeAdd && evt.Mode != common.ModeUpdate {
			// UPDATE_NAME renames only; membership is not part of that event.
			return nil
		}
		target := map[string]bool{}
		for _, id := range newUsers {
			target[id] = true
		}
		existingSet := map[string]bool{}
		for _, id := range existing {
			existingSet[id] = true
		}
		for _, id := range existing {
			if !target[id] {
				if err := s.store.RemoveUserFromOrganization(ctx, q, id, evt.OrgID); err != nil {
					return err
				}
			}
		}
		for _, id := range newUsers {
			if !existingSet[id] {
				if err := s.store.AddUserToOrganization(ctx, q, id, evt.OrgID); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// applyOrgDelete removes the org from every member and drops the row.
func (s *Service) applyOrgDelete(ctx context.Context, evt *common.OrgChangeEvent) error {
	return s.pool.InTx(ctx, func(q db.Querier) error {
		members, err := s.store.UserIDsForOrganization(ctx, q, evt.OrgID)
		if err != nil {
			return err
		}
		for _, id := range members {
			if err := s.store.RemoveUserFromOrganization(ctx, q, id, evt.OrgID); err != nil {
				return err
			}
		}
		return s.store.DeleteOrganization(ctx, q, evt.OrgID)
	})
}
