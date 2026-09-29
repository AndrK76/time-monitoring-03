package authsvc

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// SetUserRoles serves PUT /users/{id}/roles, replacing a user's role set.
//
// Rejected with 400 when the request names a role that does not exist. The Java
// implementation silently dropped unknown names, which left an administrator
// believing a permission had been granted when it had not.
func (s *Service) SetUserRoles(ctx context.Context, a *security.Auth, userID string, roleNames []string) ([]string, error) {
	target, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.canUpdateUser(ctx, a, target); err != nil {
		return nil, err
	}

	err = s.pool.InTx(ctx, func(q db.Querier) error {
		unknown, err := s.unknownRoleNames(ctx, q, roleNames)
		if err != nil {
			return err
		}
		if len(unknown) > 0 {
			return httpx.BadRequest("Unknown role(s): " + strings.Join(unknown, ", "))
		}
		return s.store.UpdateUserRoles(ctx, q, userID, roleNames, a.UserID)
	})
	if err != nil {
		return nil, err
	}

	reloaded, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	s.publishUserInfoUpdated(ctx, reloaded, true, a.UserID)
	return reloaded.RoleNames(), nil
}

func (s *Service) unknownRoleNames(ctx context.Context, q db.Querier, names []string) ([]string, error) {
	if len(names) == 0 {
		return nil, nil
	}
	rows, err := q.Query(ctx, `SELECT name FROM roles WHERE name = ANY($1)`, names)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	found := make(map[string]bool, len(names))
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		found[name] = true
	}
	var unknown []string
	for _, name := range names {
		if !found[name] {
			unknown = append(unknown, name)
		}
	}
	return unknown, nil
}

// GetRole serves GET /roles/{id}.
func (s *Service) GetRole(ctx context.Context, roleID string) (*RoleWithPermissionResponse, error) {
	role, err := s.store.FindRole(ctx, s.pool, roleID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("Role not available: " + roleID)
		}
		return nil, err
	}
	perms, err := s.store.PermissionsForRoles(ctx, s.pool, []string{roleID})
	if err != nil {
		return nil, err
	}
	special, err := s.store.RoleIsSpecial(ctx, s.pool, []string{roleID})
	if err != nil {
		return nil, err
	}
	return &RoleWithPermissionResponse{
		ID:          role.ID,
		Name:        role.Name,
		Description: role.Description,
		Permissions: perms,
		Special:     special,
	}, nil
}

// TelegramTokenView is the API shape of a magic-link token. The token value is
// only ever returned to its owner, never to an admin listing another user.
type TelegramTokenView struct {
	ID        string     `json:"id"`
	UserID    string     `json:"userId"`
	ExpiresAt *time.Time `json:"expiresAt"`
	Used      bool       `json:"used"`
	TargetURL *string    `json:"targetUrl"`
	// Link is the deep link the client opens. It is composed here rather than
	// stored, so changing the link format needs no migration.
	Link string `json:"link"`
}

// telegramLinkBase is the public host the magic link points at.
const telegramLinkBase = "https://crm.host/telegram-auth"

// CreateTelegramToken mints a short-lived login token for a user.
//
// The Java service had a TelegramTokenService with no endpoint reaching it, so
// the flow was dead code. The endpoints are wired here because the storage and
// TTL are already in the schema; the token is never consumed by this port (there
// is no Telegram bot to redeem it), so it is issued and then rotatable but not
// redeemable. That is called out in MIGRATION.md rather than silently shipped as
// a working login path.
func (s *Service) CreateTelegramToken(ctx context.Context, userID, targetURL string) (*TelegramTokenView, error) {
	if _, err := s.store.FindUserByID(ctx, s.pool, userID); err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("User not available: " + userID)
		}
		return nil, err
	}

	secret, err := randomSecret(32)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	expires := now.Add(s.telegramTTL)
	target := nullable(strings.TrimSpace(targetURL))

	row := &TelegramToken{
		ID:        rabbit.NewUUID(),
		Token:     secret,
		UserID:    userID,
		ExpiresAt: expires,
		TargetURL: target,
		CreatedAt: now,
	}

	err = s.pool.InTx(ctx, func(q db.Querier) error {
		// A user has at most one live token; issuing a new one invalidates the
		// previous so a leaked link stops working as soon as it is reissued.
		if _, err := q.Exec(ctx,
			`DELETE FROM telegram_tokens WHERE user_id = $1 AND is_used = FALSE`, userID); err != nil {
			return err
		}
		_, err := q.Exec(ctx, `
			INSERT INTO telegram_tokens (id, token, user_id, expires_at, is_used, created_at, target_url)
			VALUES ($1, $2, $3, $4, FALSE, $5, $6)`,
			row.ID, row.Token, row.UserID, row.ExpiresAt, row.CreatedAt, stringArg(row.TargetURL))
		return err
	})
	if err != nil {
		return nil, err
	}
	return toTokenView(row), nil
}

// ActiveTelegramToken returns a user's live token, or 404 when there is none.
//
// An expired token is treated as absent rather than returned, because handing
// back a link that cannot work is worse than reporting none.
func (s *Service) ActiveTelegramToken(ctx context.Context, userID string) (*TelegramTokenView, error) {
	row, err := s.store.ActiveTelegramToken(ctx, s.pool, userID)
	if err != nil {
		if db.IsNoRows(err) {
			return nil, httpx.NotFound("No active telegram token")
		}
		return nil, err
	}
	return toTokenView(row), nil
}

// DeleteTelegramTokens invalidates every live token for a user.
func (s *Service) DeleteTelegramTokens(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE telegram_tokens SET is_used = TRUE, used_at = now() WHERE user_id = $1 AND is_used = FALSE`, userID)
	return err
}

func toTokenView(row *TelegramToken) *TelegramTokenView {
	expires := row.ExpiresAt
	used := row.IsUsed
	return &TelegramTokenView{
		ID:        row.ID,
		UserID:    row.UserID,
		ExpiresAt: &expires,
		Used:      used,
		TargetURL: row.TargetURL,
		Link:      telegramLinkBase + "?token=" + row.Token,
	}
}

// ActiveTelegramToken returns a user's single live, unexpired token.
func (s *Store) ActiveTelegramToken(ctx context.Context, q db.Querier, userID string) (*TelegramToken, error) {
	var t TelegramToken
	var usedAt pgtype.Timestamp
	err := q.QueryRow(ctx, `
		SELECT id, token, user_id, expires_at, is_used, used_at, created_at, target_url
		FROM telegram_tokens
		WHERE user_id = $1 AND is_used = FALSE AND expires_at > now()
		ORDER BY created_at DESC
		LIMIT 1`, userID).
		Scan(&t.ID, &t.Token, &t.UserID, &t.ExpiresAt, &t.IsUsed, &usedAt, &t.CreatedAt, &t.TargetURL)
	if err != nil {
		return nil, err
	}
	t.UsedAt = nullTime(usedAt)
	return &t, nil
}

// randomSecret returns n bytes of hex-encoded entropy, the store's only secret
// material for magic links.
func randomSecret(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
