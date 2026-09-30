package authsvc

import (
	"context"
	"log/slog"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
)

// BootstrapPassword gives a passwordless seeded account a working password at
// start-up.
//
// Why this exists: the migrations create `superadmin` with a NULL password, and
// the only endpoint that could set one (PUT /users/{id}/reset-password) requires
// a SUPERUSER token, which requires a login. The Java deployment closed that
// loop with POST /admin/update-password, an unauthenticated password write on
// any reachable host. That endpoint is not ported; see MIGRATION.md. This is
// the replacement: the only caller is the process's own start-up, the only
// account it will touch is the one named by BOOTSTRAP_ADMIN_USERNAME, and it
// refuses to overwrite a password that already exists.
//
// The properties are:
//
//	BOOTSTRAP_ADMIN_USERNAME  account to seed, default "superadmin"
//	BOOTSTRAP_ADMIN_PASSWORD  password to set; empty or unset disables this
//
// After the first successful run the password is no longer NULL, so the
// subsequent runs are no-ops even if the variable is left in the environment.
// Setting the variable on a system whose superadmin already has a password is
// therefore harmless, but it should be removed from the environment once the
// account has been used, so the secret is not sitting in a process listing.
func (s *Service) BootstrapPassword(ctx context.Context, username, password string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		username = "superadmin"
	}
	if strings.TrimSpace(password) == "" {
		return nil
	}

	user, err := s.store.FindUserByUsername(ctx, s.pool, username)
	if err != nil {
		if db.IsNoRows(err) {
			// Nothing to bootstrap. Not an error: a deployment that never
			// seeded the account has its own provisioning path.
			slog.Info("bootstrap account not present, nothing to do", "username", username)
			return nil
		}
		return err
	}
	if user.PasswordHash() != "" {
		slog.Info("bootstrap account already has a password, leaving it alone",
			"username", username)
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.pool.InTx(ctx, func(q db.Querier) error {
		// The guard repeats the check in the UPDATE, so a concurrent start-up
		// on another instance cannot have the second writer win a race and
		// silently replace a password an operator has since changed.
		_, err := q.Exec(ctx, `
			UPDATE users
			SET password = $2, is_active = TRUE, is_approved = TRUE,
			    updated_at = now(), updated_by = $3
			WHERE username = $1 AND password IS NULL`,
			username, string(hash), common.SystemUserID)
		return err
	}); err != nil {
		return err
	}

	slog.Warn("bootstrapped a password for a passwordless account; "+
		"remove BOOTSTRAP_ADMIN_PASSWORD from the environment once you have signed in",
		"username", username)
	return nil
}
