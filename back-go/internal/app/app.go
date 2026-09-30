// Package app wires the infrastructure every service shares: configuration,
// logging, the database pool, migrations, the JWT service, CORS, the HTTP
// server, and the RabbitMQ client.
//
// Each service builds one App and then registers its own routes, so the three
// binaries differ only in their controllers and service layer.
package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/config"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/migrations"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// Service identifies one of the three services, and supplies the per-service
// defaults that differed in the Java configuration.
type Service string

const (
	ServiceAuth       Service = "service-auth"
	ServiceAdmin      Service = "service-admin"
	ServiceMonitoring Service = "service-monitoring"
)

// Options is the resolved configuration for one service.
type Options struct {
	Service Service
	// Schema is the PostgreSQL schema this service owns.
	Schema string
	// Queue is this service's RabbitMQ queue.
	Queue string
	// Port is the HTTP listen port.
	Port int
	// ReadCookie enables cookie-based authentication. Only service-auth read
	// the auth_token cookie; the other two relied on the Authorization header,
	// because they sat behind a gateway that attached the header.
	ReadCookie bool
	// LoadCookieCookies enables the cookie service even when the cookie is not
	// read for authentication. service-auth both sets and clears the cookie.
	ManageCookies bool
	// DefaultPassword is DEFAULT_PASSWORD from the Java properties, used by the
	// reset flow for accounts that have no password set.
	DefaultPassword string
	// YClientsBaseURL is the external YClients API root.
	YClientsBaseURL string
	// XorSecret masks stored credentials.
	XorSecret string
	// TelegramTokenTTL is the magic-link lifetime.
	TelegramTokenTTL time.Duration
}

// App is the assembled service.
type App struct {
	Options Options
	Props   *config.Properties
	Pool    *db.Pool
	JWT     *security.Service
	Cookies *security.CookieService
	Rabbit  *rabbit.Client
	Cipher  *common.XorCipher
	Mux     *http.ServeMux
	Log     *slog.Logger
}

// New resolves configuration, opens the dependencies, and runs migrations.
//
// Order matters: migrations run before anything queries, and the Rabbit client
// is optional so a service can start without a broker. The Java services also
// required RabbitMQ at boot, but making it hard would make local development
// painful, so a broker failure downgrades to a warning and the publisher
// degrades to a no-op until the connection is established.
func New(ctx context.Context, opts Options) (*App, error) {
	props := config.Load(
		"../.properties",
		".properties",
		string(opts.Service)+"/.properties",
	)

	log := loggingFor(props, string(opts.Service))

	postgresURL := props.Get("POSTGRES_URL", "POSTGRES_URL", "")
	if err := config.MustExist(postgresURL, "POSTGRES_URL"); err != nil {
		return nil, err
	}

	pool, err := db.Open(ctx, db.Options{
		URL:             postgresURL,
		User:            props.Get("PG_USER", "PG_USER", ""),
		Password:        props.Get("PG_PASSWORD", "PG_PASSWORD", ""),
		Schema:          opts.Schema,
		MaxPoolSize:     props.GetInt("PG_POOL_MAX", "PG_POOL_MAX", 10),
		MinIdle:         props.GetInt("PG_POOL_MIN_IDLE", "PG_POOL_MIN_IDLE", 5),
		ConnMaxLifetime: 30 * time.Minute,
		ConnMaxIdleTime: 10 * time.Minute,
		ConnectTimeout:  30 * time.Second,
	})
	if err != nil {
		return nil, err
	}

	if err := migrations.Run(ctx, pool.Pool, opts.Schema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate schema %s: %w", opts.Schema, err)
	}

	jwtSvc, err := security.NewService(security.Config{
		Secret:           props.Get("JWT_SECRET", "JWT_SECRET", "your-256-bit-secret-key-change-in-production"),
		Expiration:       props.GetDurationMS("JWT_EXPIRATION", "JWT_EXPIRATION", 24*time.Hour),
		RefreshExpiraton: props.GetDurationMS("JWT_REFRESH_EXPIRATION", "JWT_REFRESH_EXPIRATION", 7*24*time.Hour),
	})
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("jwt service: %w", err)
	}
	log.Info("jwt configured", "algorithm", jwtSvc.AlgorithmName())

	cookieCfg := security.CookieConfig{
		Domain:     props.Get("COOKIE_DOMAIN", "COOKIE_DOMAIN", "crm.host"),
		Secure:     props.GetBool("COOKIE_SECURE", "COOKIE_SECURE", false),
		ReadCookie: opts.ReadCookie,
	}

	app := &App{
		Options: opts,
		Props:   props,
		Pool:    pool,
		JWT:     jwtSvc,
		Cookies: security.NewCookieService(cookieCfg),
		Cipher:  common.NewXorCipher(),
		Mux:     http.NewServeMux(),
		Log:     log,
	}

	app.Rabbit = app.connectRabbit(props, log)
	return app, nil
}

// connectRabbit dials the broker, tolerating its absence.
func (a *App) connectRabbit(props *config.Properties, log *slog.Logger) *rabbit.Client {
	cfg := rabbit.Config{
		Host:              props.Get("RABBIT_HOST", "RABBIT_HOST", "localhost"),
		Port:              props.GetInt("RABBIT_PORT", "RABBIT_PORT", 5672),
		Username:          props.Get("RABBIT_USER", "RABBIT_USER", "guest"),
		Password:          props.Get("RABBIT_PASSWORD", "RABBIT_PASSWORD", "guest"),
		VHost:             props.Get("RABBIT_VHOST", "RABBIT_VHOST", "/"),
		Queue:             a.Options.Queue,
		RetryAttempts:     props.GetInt("RABBIT_RETRY_ATTEMPTS", "RABBIT_RETRY_ATTEMPTS", 3),
		RetryInitial:      props.GetDurationMS("RABBIT_RETRY_INITIAL_MS", "RABBIT_RETRY_INITIAL_MS", time.Second),
		RetryMax:          props.GetDurationMS("RABBIT_RETRY_MAX_MS", "RABBIT_RETRY_MAX_MS", 10*time.Second),
		RetryMultiplier:   2.0,
		ReconnectInterval: 5 * time.Second,
	}
	client, err := rabbit.NewClient(cfg, string(a.Options.Service))
	if err != nil {
		log.Warn("rabbitmq unavailable, commands will be dropped until it starts",
			"host", cfg.Host, "port", cfg.Port, "err", err)
		return nil
	}
	return client
}

// DefaultPassword returns the configured default password.
func (a *App) DefaultPassword() string {
	return a.Props.Get("DEFAULT_PASSWORD", "DEFAULT_PASSWORD", "")
}

// XorSecret returns the credential-masking key.
func (a *App) XorSecret() string {
	return a.Props.Get("STORE_XOR", "STORE_XOR", "your-256-bit-secret-key-change-in-production")
}

// YClientsBaseURL returns the external YClients API root.
func (a *App) YClientsBaseURL() string {
	return a.Props.Get("YCLIENTS_API_URL", "YCLIENTS_API_URL", "")
}

// TelegramTokenTTL returns the magic-link lifetime, five minutes as configured.
func (a *App) TelegramTokenTTL() time.Duration {
	return a.Props.GetDurationMS("TELEGRAM_TOKEN_TTL_MS", "TELEGRAM_TOKEN_TTL_MS", 5*time.Minute)
}

// JWTAccessTTL returns the access-token lifetime. The auth cookie is issued
// with exactly this duration so the cookie and the token inside it expire
// together; a longer cookie would keep presenting a dead token to the
// authentication filter.
func (a *App) JWTAccessTTL() time.Duration {
	return a.Props.GetDurationMS("JWT_EXPIRATION", "JWT_EXPIRATION", 24*time.Hour)
}

// Handler builds the fully decorated HTTP handler: CORS, authentication, and
// the not-found fallback.
func (a *App) Handler() http.Handler {
	// service-auth accepts the SSO cookie; the other two services read the
	// Authorization header only, as their Java CookieServiceBase did.
	authFilter := httpx.Middleware(a.JWT.Filter(security.FilterOptions{ReadCookie: a.Options.ReadCookie}))

	notFound := httpx.Wrap(func(w http.ResponseWriter, r *http.Request) error {
		return httpx.NotFound("No endpoint " + r.Method + " " + r.URL.Path)
	})

	return httpx.Chain(a.Mux,
		httpx.DefaultCORS().Middleware,
		authFilter,
		// Spring's DispatcherServlet served the whitelabel error page for an
		// unmapped path; the front-end relies on a JSON 404 instead.
		func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if _, pattern := a.Mux.Handler(r); pattern == "" {
					notFound.ServeHTTP(w, r)
					return
				}
				next.ServeHTTP(w, r)
			})
		},
	)
}

// Serve runs the HTTP server and blocks until ctx is cancelled.
func (a *App) Serve(ctx context.Context) error {
	port := a.Options.Port
	if override := a.Props.GetInt("PORT", "PORT", 0); override > 0 {
		port = override
	}
	return httpx.Run(ctx, httpx.ServerConfig{
		Addr:              fmt.Sprintf(":%d", port),
		ReadHeaderTimeout: 15 * time.Second,
		ReadTimeout:       60 * time.Second,
		// The screenshot proxy streams an image fetched from a Macroscop server
		// with a 15s upstream timeout, so the write timeout must exceed it.
		WriteTimeout:    60 * time.Second,
		IdleTimeout:     120 * time.Second,
		ShutdownTimeout: 20 * time.Second,
	}, a.Handler())
}

// Close releases the resources. Safe to call with a nil Rabbit client.
func (a *App) Close() {
	if a.Rabbit != nil {
		a.Rabbit.Close()
	}
	if a.Pool != nil {
		a.Pool.Close()
	}
}

// SweepBlacklist drops logout entries whose token has already expired.
//
// The Java implementation kept an unbounded map, so a long-running process lost
// memory proportional to total logouts ever performed. Trimming entries past
// their expiry is safe: an expired token fails signature verification before the
// blacklist is consulted, so removing it cannot admit a revoked-but-unexpired
// token.
func (a *App) SweepBlacklist() {
	removed := a.JWT.SweepBlacklist()
	if removed > 0 {
		a.Log.Debug("logout blacklist trimmed", "removed", removed)
	}
}

// Publish sends a command, carrying the caller's user context so the receiving
// service can attribute the event. Failures are logged and swallowed, matching
// CommandSender: a broker outage must not roll back a business transaction.
func (a *App) Publish(ctx context.Context, route string, cmdType common.CommandMessageType, payload any) {
	if a.Rabbit == nil {
		a.Log.Warn("command dropped, no rabbitmq connection", "route", route, "commandType", cmdType)
		return
	}
	if err := a.Rabbit.Send(ctx, route, cmdType, payload); err != nil {
		a.Log.Error("command publish failed", "route", route, "commandType", cmdType, "err", err)
	}
}
