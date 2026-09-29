// Package httpx router helpers: a middleware chain and a handler adapter that
// removes the error-returning boilerplate from every endpoint.
package httpx

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

// Middleware is the standard decorator shape.
type Middleware func(http.Handler) http.Handler

// Chain applies middleware left to right, so Chain(a, b)(h) runs a then b,
// matching Spring's filter ordering.
func Chain(h http.Handler, middleware ...Middleware) http.Handler {
	for i := len(middleware) - 1; i >= 0; i-- {
		h = middleware[i](h)
	}
	return h
}

// HandlerFunc is an http.HandlerFunc that may fail. The adapter renders any
// error through WriteProblem, which is the single place the RFC 9457 document
// is produced.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// Wrap adapts a HandlerFunc to http.Handler.
func Wrap(fn HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			WriteProblem(w, r, err)
		}
	})
}

// Route registers a group of routes sharing a path prefix, so a controller's
// endpoints read as a unit rather than as a wall of string concatenation.
type Route struct {
	mux    *http.ServeMux
	prefix string
}

// NewRoute creates a route group.
//
// A trailing slash on prefix is significant and is preserved: a pattern like
// "/{id}" concatenates to "/api/v1/users/{id}", and a collection is registered
// as prefix itself, which ServeMux then matches exactly. Trimming the slash
// would produce "/api/v1/users{id}", which is not a valid pattern.
func NewRoute(mux *http.ServeMux, prefix string) *Route {
	return &Route{mux: mux, prefix: prefix}
}

// join builds a full pattern, treating an empty or slash-only sub-pattern as the
// collection itself.
func (rt *Route) join(pattern string) string {
	if pattern == "" || pattern == "/" {
		if rt.prefix == "" {
			return "/"
		}
		return rt.prefix
	}
	// Normalise the boundary between prefix and pattern to exactly one slash, so
	// both a prefix ending in "/" and a pattern starting with "/" are accepted.
	return strings.TrimRight(rt.prefix, "/") + "/" + strings.TrimLeft(pattern, "/")
}

func (rt *Route) handle(method, pattern string, fn HandlerFunc) {
	rt.mux.Handle(method+" "+rt.join(pattern), Wrap(fn))
}

func (rt *Route) Get(pattern string, fn HandlerFunc)    { rt.handle(http.MethodGet, pattern, fn) }
func (rt *Route) Post(pattern string, fn HandlerFunc)   { rt.handle(http.MethodPost, pattern, fn) }
func (rt *Route) Put(pattern string, fn HandlerFunc)    { rt.handle(http.MethodPut, pattern, fn) }
func (rt *Route) Delete(pattern string, fn HandlerFunc) { rt.handle(http.MethodDelete, pattern, fn) }

// RawGet and friends register a handler that writes its own response and cannot
// fail. Endpoints that need to pick between two error envelopes, such as the
// login routes which mix problem documents with the login-shaped envelope, use
// these instead of the error-returning variants.
func (rt *Route) RawGet(pattern string, fn http.HandlerFunc) { rt.raw(http.MethodGet, pattern, fn) }
func (rt *Route) RawPost(pattern string, fn http.HandlerFunc) {
	rt.raw(http.MethodPost, pattern, fn)
}
func (rt *Route) RawPut(pattern string, fn http.HandlerFunc) { rt.raw(http.MethodPut, pattern, fn) }
func (rt *Route) RawDelete(pattern string, fn http.HandlerFunc) {
	rt.raw(http.MethodDelete, pattern, fn)
}

func (rt *Route) raw(method, pattern string, fn http.HandlerFunc) {
	rt.mux.Handle(method+" "+rt.join(pattern), fn)
}

// PathVar reads a path variable captured by the Go 1.22 ServeMux pattern
// syntax, the replacement for Spring's @PathVariable.
func PathVar(r *http.Request, name string) string {
	return r.PathValue(name)
}

// Query reads a query parameter.
func Query(r *http.Request, name string) string {
	return r.URL.Query().Get(name)
}

// QueryHas reports whether a parameter is present, ignoring its value. The Java
// routes used a params condition, so ?with_unbounded=false selected the same
// handler as a bare flag; this preserves that.
func QueryHas(r *http.Request, name string) bool {
	_, ok := r.URL.Query()[name]
	return ok
}

// ServerConfig holds the listen settings for a service.
type ServerConfig struct {
	Addr              string
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	ShutdownTimeout   time.Duration
}

// Run serves until the context is cancelled, then drains in-flight requests.
//
// The Java services ran embedded Tomcat with a graceful shutdown; the same
// behaviour is needed here because a Rabbit consumer and in-flight HTTP handlers
// must not be cut off mid-transaction.
func Run(ctx context.Context, cfg ServerConfig, handler http.Handler) error {
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		ErrorLog:          nil,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("http server listening", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("http server shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return <-errCh
	}
}

// SignalContext returns a context cancelled on SIGINT or SIGTERM, for
// translating a container stop into a graceful drain.
func SignalContext(parent context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(parent)
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt, syscall.SIGTERM)
	go func() {
		select {
		case <-ch:
			cancel()
		case <-ctx.Done():
		}
		signal.Stop(ch)
	}()
	return ctx, cancel
}

// IsConnectionClosed reports whether err is a client hang-up, which is routine
// and must not be logged as a server error.
func IsConnectionClosed(err error) bool {
	if err == nil {
		return false
	}
	if err == context.Canceled {
		return true
	}
	var netErr net.Error
	if ok := asNetError(err, &netErr); ok && netErr.Timeout() {
		return false
	}
	return err == http.ErrHandlerTimeout || err == context.DeadlineExceeded
}

func asNetError(err error, target *net.Error) bool {
	if ne, ok := err.(net.Error); ok {
		*target = ne
		return true
	}
	return false
}
