// Command service-monitoring runs the monitoring service.
//
// It owns the `mon` PostgreSQL schema and has no public surface: it is a
// message-bus consumer only. The organization dictionary is owned by
// service-admin; every change is broadcast on `mon3.mon` and mirrored into
// mon.organizations here, so the monitoring data this service will one day write
// can be labelled with the organization name and agent flags as of the event.
//
// The Java service still started a web container on 8081 (for actuator), so the
// Go binary listens on 8081 too; with no routes registered, every path answers
// the JSON 404 the shared handler produces.
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/nightweb/time-monitoring-03/back-go/internal/app"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/monsvc"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
)

func main() {
	ctx, stop := httpx.SignalContext(context.Background())
	defer stop()

	a, err := app.New(ctx, app.Options{
		Service: app.ServiceMonitoring,
		Schema:  "mon",
		Queue:   rabbit.QueueMonitoring,
		Port:    8081,
	})
	if err != nil {
		slog.Error("startup failed", "err", err)
		os.Exit(1)
	}
	defer a.Close()

	svc := monsvc.NewService(monsvc.NewStore(a.Pool), a.Log)

	// swallowErrors is true because the Java listener caught everything inside
	// its handler and logged, and the acknowledgement left the queue moving
	// even when the event was dropped. Reproduced here: a poison message is
	// consumed and discarded rather than re-queued forever, and the mirror can
	// rebuild itself from the next full-update event.
	if a.Rabbit != nil {
		a.Rabbit.Consume(ctx, svc.HandleCommand, true)
	} else {
		a.Log.Warn("organization events not consumed, no rabbitmq connection; the mirror will stay empty")
	}

	if err := a.Serve(ctx); err != nil && ctx.Err() == nil {
		slog.Error("http server stopped", "err", err)
		os.Exit(1)
	}
}
