// Command service-auth runs the authentication and user-management service.
//
// It owns the `auth` PostgreSQL schema, listens on port 8083, issues and
// validates JWTs, sets the cross-subdomain SSO cookie, and publishes user
// lifecycle events onto the message bus for service-admin to consume.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/nightweb/time-monitoring-03/back-go/internal/app"
	"github.com/nightweb/time-monitoring-03/back-go/internal/authhttp"
	"github.com/nightweb/time-monitoring-03/back-go/internal/authsvc"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
)

func main() {
	ctx, stop := httpx.SignalContext(context.Background())
	defer stop()

	a, err := app.New(ctx, app.Options{
		Service: app.ServiceAuth,
		Schema:  "auth",
		Queue:   rabbit.QueueAuth,
		Port:    8083,
		// service-auth is the only service that reads the SSO cookie: it is
		// where the cookie is issued, and the admin and monitor front-ends
		// present it to the other two services as an Authorization header.
		ReadCookie:    true,
		ManageCookies: true,
	})
	if err != nil {
		slog.Error("startup failed", "err", err)
		os.Exit(1)
	}
	defer a.Close()

	svc := authsvc.NewService(
		authsvc.NewStore(a.Pool),
		a.Pool,
		a.JWT,
		a.Publish,
		string(app.ServiceAuth),
		a.DefaultPassword(),
		a.TelegramTokenTTL(),
	)

	authhttp.Register(a, svc)

	// The queue's routing key mon3.auth carries the ORGANIZATION_INFO_CHANGED
	// events service-admin publishes. This service mirrors them: auth.organizations
	// is the read-side copy of the dictionary and user_organizations feeds login
	// membership, so both must track the admin service's edits.
	if a.Rabbit != nil {
		a.Rabbit.Consume(ctx, svc.HandleCommand, true)
	} else {
		a.Log.Warn("organization events not consumed, no rabbitmq connection; the organization mirror will stay empty")
	}

	// The migrations seed superadmin without a password and the only endpoint
	// that could set one needs a superuser token, so a fresh database has no
	// way in until an operator supplies BOOTSTRAP_ADMIN_PASSWORD. The Java
	// deployment used the unauthenticated /admin/update-password endpoint for
	// this, which is not ported; see MIGRATION.md.
	if err := svc.BootstrapPassword(ctx,
		a.Props.Get("BOOTSTRAP_ADMIN_USERNAME", "BOOTSTRAP_ADMIN_USERNAME", "superadmin"),
		a.Props.Get("BOOTSTRAP_ADMIN_PASSWORD", "BOOTSTRAP_ADMIN_PASSWORD", ""),
	); err != nil {
		a.Log.Error("could not bootstrap the administrator password", "err", err)
		os.Exit(1)
	}

	// The auth queue receives organization events, which the auth service does
	// not act on: the organization dictionary is owned by service-admin and
	// mirrored into the monitoring schema. The queue is declared so the
	// topology is complete, but no consumer is started, because a consumer
	// would only drain messages into a no-op.
	if a.Rabbit != nil {
		a.Log.Info("auth queue declared, no consumer attached",
			"queue", rabbit.QueueAuth, "route", rabbit.RouteAuth)
	}

	// Expired tokens accumulate in the logout blacklist. The Java service had
	// the same unbounded map; a sweep that drops entries past their expiry
	// bounds the memory without changing behaviour, since an expired token is
	// rejected by signature verification anyway.
	stopBlacklistSweep(ctx, a)

	if err := a.Serve(ctx); err != nil {
		a.Log.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

// stopBlacklistSweep runs the periodic blacklist trim.
func stopBlacklistSweep(ctx context.Context, a *app.App) {
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				a.SweepBlacklist()
			}
		}
	}()
}
