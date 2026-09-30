// Command service-admin runs the administration service.
//
// It owns the `admin` PostgreSQL schema and listens on port 8082. It is the
// single writer for the organization dictionary, the access model, the three
// agent families (CRM, events, cameras) and the two external integrations
// behind them (YClients and Macroscop). Every change to an organization that the
// other two services keep a copy of is published on the message bus from here.
//
// The service has no public surface: every route requires a valid token, and
// most require a role or a permission beyond that.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/nightweb/time-monitoring-03/back-go/internal/adminhttp"
	"github.com/nightweb/time-monitoring-03/back-go/internal/adminsvc"
	"github.com/nightweb/time-monitoring-03/back-go/internal/app"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
)

func main() {
	ctx, stop := httpx.SignalContext(context.Background())
	defer stop()

	a, err := app.New(ctx, app.Options{
		Service:         app.ServiceAdmin,
		Schema:          "admin",
		Queue:           rabbit.QueueAdmin,
		Port:            8082,
		YClientsBaseURL: os.Getenv("YCLIENTS_API_URL"),
	})
	if err != nil {
		slog.Error("startup failed", "err", err)
		os.Exit(1)
	}
	defer a.Close()

	props := a.Props
	ycTimeout := props.GetDurationMS("YCLIENTS_API_TIMEOUT_MS", "YCLIENTS_API_TIMEOUT_MS", 30*time.Second)
	msTimeout := props.GetDurationMS("MACROSCOP_API_TIMEOUT_MS", "MACROSCOP_API_TIMEOUT_MS", 15*time.Second)

	svc := adminsvc.NewService(
		adminsvc.NewStore(a.Pool),
		adminsvc.NewPublisher(a.Publish),
		a.Cipher,
		a.XorSecret(),
		adminsvc.NewYClientsAPI(a.YClientsBaseURL(), ycTimeout),
		adminsvc.DefaultMacroscopAPI(msTimeout),
		a.Log,
	)

	adminhttp.Register(a, svc)

	// service-admin is the only consumer of the user events service-auth
	// publishes. It keeps them in a local mirror so the access screen can list
	// users and their organizations without asking service-auth on every page
	// load, and so a service-auth outage does not take the screen down.
	//
	// swallowErrors is true because the Java listener caught everything inside
	// its handler and logged, so a rejected message never re-queued and never
	// blocked the queue. A poison message therefore disappears instead of
	// stalling every user change behind it; the mirror is a cache of data that is
	// also authoritative elsewhere, so losing one event is recoverable by the
	// next full update.
	if a.Rabbit != nil {
		a.Rabbit.Consume(ctx, svc.HandleCommand, true)
	} else {
		a.Log.Warn("user events not consumed, no rabbitmq connection; the user mirror will stay empty")
	}

	if err := a.Serve(ctx); err != nil && ctx.Err() == nil {
		slog.Error("http server stopped", "err", err)
		os.Exit(1)
	}
}
