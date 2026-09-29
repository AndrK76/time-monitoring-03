// Package db owns the PostgreSQL connection pool and the small query helpers
// the repositories share.
//
// The Java services used Hibernate with open-in-view disabled, which forced
// every lazily-loaded collection to be fetched inside a transaction. Rather
// than reproduce an ORM, the Go repositories issue explicit SQL and load whole
// aggregates up front, which is the same discipline without the lazy-loading
// foot-guns.
package db

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Options mirrors the Hikari settings from the Java application.yml files.
type Options struct {
	URL             string
	User            string
	Password        string
	Schema          string
	MaxPoolSize     int
	MinIdle         int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
	ConnectTimeout  time.Duration
}

// Pool wraps pgxpool.Pool with the project's transaction and error helpers.
type Pool struct {
	*pgxpool.Pool
	Schema string
}

// Open builds a pool and verifies connectivity with a ping.
func Open(ctx context.Context, opts Options) (*Pool, error) {
	cfg, err := pgxpool.ParseConfig(opts.URL)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", "database URL", err)
	}
	// Credentials come from the connection string when it carries them, and from
	// the separate options otherwise. Setting password as a runtime parameter
	// would make the server reject it: password is a libpq field, not a GUC.
	if opts.User != "" {
		cfg.ConnConfig.User = opts.User
	}
	if opts.Password != "" {
		cfg.ConnConfig.Password = opts.Password
	}
	if opts.MaxPoolSize > 0 {
		cfg.MaxConns = int32(opts.MaxPoolSize)
	}
	if opts.MinIdle > 0 {
		cfg.MinConns = int32(opts.MinIdle)
	}
	if opts.ConnMaxLifetime > 0 {
		cfg.MaxConnLifetime = opts.ConnMaxLifetime
	}
	if opts.ConnMaxIdleTime > 0 {
		cfg.MaxConnIdleTime = opts.ConnMaxIdleTime
	}
	if opts.ConnectTimeout > 0 {
		cfg.ConnConfig.ConnectTimeout = opts.ConnectTimeout
	}
	// The services each own one schema; pinning search_path keeps every query
	// unqualified, exactly as the per-role search_path the Java deployment set
	// up in postgres/01-init.sh. Setting it here too means the service works
	// against a database where that ALTER ROLE was never run.
	if opts.Schema != "" {
		if cfg.ConnConfig.RuntimeParams == nil {
			cfg.ConnConfig.RuntimeParams = make(map[string]string)
		}
		cfg.ConnConfig.RuntimeParams["search_path"] = opts.Schema + ",public"
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &Pool{Pool: pool, Schema: opts.Schema}, nil
}

// Tx runs fn inside a transaction, rolling back on error or panic.
//
// The Java services annotated service methods with @Transactional; the same
// boundaries are reproduced here, including the read-only ones where they
// matter for correctness of a multi-step read followed by a decision.
func (p *Pool) Tx(ctx context.Context, readOnly bool, fn func(pgx.Tx) error) error {
	tx, err := p.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(context.WithoutCancel(ctx))
		}
	}()

	if readOnly {
		if _, err := tx.Exec(ctx, "SET TRANSACTION READ ONLY"); err != nil {
			return fmt.Errorf("set read only: %w", err)
		}
	}
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	committed = true
	return nil
}

// Querier is satisfied by both *pgxpool.Pool and pgx.Tx, so a repository method
// can run inside or outside a transaction without duplicating itself.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// IsNoRows reports whether err signals an empty result.
func IsNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

// IsUniqueViolation reports whether err is a PostgreSQL 23505.
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// IsForeignKeyViolation reports whether err is a PostgreSQL 23503.
func IsForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

// Qualified prefixes a table name with the pool schema. The repositories build
// SQL as "FROM " + Qualified("users"), which keeps the queries readable and
// immune to search_path differences between a pool and a transaction.
func (p *Pool) Qualified(table string) string {
	if p.Schema == "" {
		return table
	}
	return `"` + p.Schema + `".` + table
}

// InTx runs fn on a write transaction from the pool, committing on success.
func (p *Pool) InTx(ctx context.Context, fn func(Querier) error) error {
	return p.Tx(ctx, false, func(tx pgx.Tx) error { return fn(tx) })
}

// InReadTx runs fn on a read-only transaction from the pool.
func (p *Pool) InReadTx(ctx context.Context, fn func(Querier) error) error {
	return p.Tx(ctx, true, func(tx pgx.Tx) error { return fn(tx) })
}

// BuildPlaceholders renders ",$3,$4,..." for an IN (...) list, so callers can
// splice a parameterised list into SQL without string-concatenating values.
func BuildPlaceholders(start int, n int) string {
	if n <= 0 {
		return ""
	}
	parts := make([]string, n)
	for i := 0; i < n; i++ {
		parts[i] = fmt.Sprintf("$%d", start+i)
	}
	return strings.Join(parts, ",")
}
