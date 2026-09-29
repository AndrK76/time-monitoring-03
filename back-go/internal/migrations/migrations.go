// Package migrations applies the project's SQL history to a PostgreSQL
// database.
//
// The 28 migration scripts are the originals from the Spring services, byte for
// byte, so a database already migrated by Flyway is adopted rather than
// re-migrated. Two design points make that safe:
//
//   - Applied versions are read from the existing flyway_schema_history table
//     when it is present. Flyway 10 (the version the Java services pinned) names
//     that table flyway_schema_history, so the Java and Go deployments share one
//     history table and one applied set.
//   - Checksums are recorded but never used to reject an already-applied
//     version. Go's hash and Flyway's CRC32 are different algorithms, so
//     comparing them would fail every adopted database on the first boot. The
//     version number is the contract; the checksum is diagnostic only.
//
// A session-level advisory lock serialises concurrent boots.
package migrations

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed sql/auth/*.sql sql/admin/*.sql sql/mon/*.sql
var files embed.FS

// historyTable is Flyway 10's default; shared so Java and Go deployments
// interlock correctly instead of each keeping a private ledger.
const historyTable = "flyway_schema_history"

// advisoryLockKey is an arbitrary but fixed key per schema, derived from the
// schema name so the three services never contend with one another.
func advisoryLockKey(schema string) int64 {
	const (
		fnvOffsetBasis int64 = -3750763034362895579 // 14695981039346656037 as signed
		fnvPrime       int64 = 1099511628211
	)
	h := fnvOffsetBasis
	for i := 0; i < len(schema); i++ {
		h ^= int64(schema[i])
		h *= fnvPrime
	}
	return h
}

var namePattern = regexp.MustCompile(`^V(\d+(?:\.\d+)*)__(.+)\.sql$`)

type migration struct {
	version     string
	description string
	script      string
	body        string
}

func loadMigrations(fsys fs.FS, schema string) ([]migration, error) {
	entries, err := fs.ReadDir(fsys, "sql/"+schema)
	if err != nil {
		return nil, fmt.Errorf("read migrations for schema %q: %w", schema, err)
	}
	out := make([]migration, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := namePattern.FindStringSubmatch(e.Name())
		if m == nil {
			return nil, fmt.Errorf("migration %q does not match V<version>__<description>.sql", e.Name())
		}
		body, err := fs.ReadFile(fsys, "sql/"+schema+"/"+e.Name())
		if err != nil {
			return nil, err
		}
		out = append(out, migration{
			version:     m[1],
			description: strings.ReplaceAll(m[2], "_", " "),
			script:      e.Name(),
			body:        string(body),
		})
	}
	// Numeric-aware version ordering so 01.09 sorts before 01.10.
	sort.Slice(out, func(i, j int) bool {
		return compareVersions(out[i].version, out[j].version) < 0
	})
	return out, nil
}

func compareVersions(a, b string) int {
	as, bs := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < len(as) || i < len(bs); i++ {
		var x, y int
		if i < len(as) {
			x, _ = strconv.Atoi(as[i])
		}
		if i < len(bs) {
			y, _ = strconv.Atoi(bs[i])
		}
		if x != y {
			// Sign only: callers compare the result against zero, and returning
			// the raw difference makes a "want -1" expectation misleading.
			if x < y {
				return -1
			}
			return 1
		}
	}
	return 0
}

// Run brings schema up to date. Safe to call on every boot.
func Run(ctx context.Context, pool *pgxpool.Pool, schema string) error {
	all, err := loadMigrations(files, schema)
	if err != nil {
		return err
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	// Serialise with any other instance booting the same schema.
	key := advisoryLockKey(schema)
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", key); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		if _, err := conn.Exec(context.WithoutCancel(ctx), "SELECT pg_advisory_unlock($1)", key); err != nil {
			slog.Warn("release migration lock failed", "err", err)
		}
	}()

	if err := ensureSchema(ctx, conn.Conn(), schema); err != nil {
		return err
	}
	if err := ensureHistoryTable(ctx, conn.Conn(), schema); err != nil {
		return err
	}

	applied, err := appliedVersions(ctx, conn.Conn(), schema)
	if err != nil {
		return err
	}

	var ran int
	for _, m := range all {
		if applied[m.version] {
			slog.Debug("migration already applied, skipping", "schema", schema, "version", m.version, "script", m.script)
			continue
		}
		start := time.Now()
		// Each script runs in its own transaction: a failure leaves the history
		// ledger and the schema consistent with each other.
		if err := runOne(ctx, conn.Conn(), schema, m); err != nil {
			return fmt.Errorf("apply %s to schema %q: %w", m.script, schema, err)
		}
		elapsed := time.Since(start)
		slog.Info("migration applied",
			"schema", schema, "version", m.version, "script", m.script, "duration", elapsed)
		ran++
	}

	if ran == 0 {
		slog.Info("schema already up to date", "schema", schema, "knownVersions", len(all))
	}
	return nil
}

// ensureSchema makes sure the target schema exists.
//
// Existence is checked first rather than relying on CREATE SCHEMA IF NOT EXISTS.
// Each service connects as the role that owns its schema and does not own the
// database, so an unconditional CREATE would fail with a permission error even
// when the schema is already there — which it always is in the real deployment,
// where docker/postgres/01-init.sh created it. A genuinely missing schema is
// still created, so a bare database bootstraps.
func ensureSchema(ctx context.Context, conn *pgx.Conn, schema string) error {
	var exists bool
	err := conn.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1)`, schema).Scan(&exists)
	if err != nil {
		return fmt.Errorf("look up schema %q: %w", schema, err)
	}
	if exists {
		return nil
	}
	if _, err := conn.Exec(ctx, fmt.Sprintf(`CREATE SCHEMA %s`, quoteIdent(schema))); err != nil {
		return fmt.Errorf("schema %q does not exist and could not be created "+
			"(the connecting role needs CREATE on the database): %w", schema, err)
	}
	slog.Info("schema created", "schema", schema)
	return nil
}

func ensureHistoryTable(ctx context.Context, conn *pgx.Conn, schema string) error {
	_, err := conn.Exec(ctx, fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s.%s (
			installed_rank INT NOT NULL,
			version        VARCHAR(50),
			description    VARCHAR(200) NOT NULL,
			type           VARCHAR(20) NOT NULL,
			script         VARCHAR(1000) NOT NULL,
			checksum       INTEGER,
			installed_by   VARCHAR(100) NOT NULL,
			installed_on   TIMESTAMP NOT NULL DEFAULT now(),
			execution_time INTEGER NOT NULL,
			success        BOOLEAN NOT NULL
		)`, quoteIdent(schema), quoteIdent(historyTable)))
	if err != nil {
		return fmt.Errorf("create history table: %w", err)
	}
	return nil
}

func appliedVersions(ctx context.Context, conn *pgx.Conn, schema string) (map[string]bool, error) {
	rows, err := conn.Query(ctx,
		fmt.Sprintf(`SELECT version FROM %s.%s WHERE success AND version IS NOT NULL`, quoteIdent(schema), quoteIdent(historyTable)))
	if err != nil {
		return nil, fmt.Errorf("read migration history: %w", err)
	}
	defer rows.Close()

	out := make(map[string]bool)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out[v] = true
	}
	return out, rows.Err()
}

func runOne(ctx context.Context, conn *pgx.Conn, schema string, m migration) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL search_path TO %s, public", quoteIdent(schema))); err != nil {
		return err
	}
	start := time.Now()
	if _, err := tx.Exec(ctx, m.body); err != nil {
		return err
	}
	elapsedMs := int(time.Since(start).Milliseconds())

	rank, err := nextRank(ctx, tx, schema)
	if err != nil {
		return err
	}
	insertSQL := fmt.Sprintf(`
		INSERT INTO %s.%s
			(installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
		VALUES ($1, $2, $3, 'SQL', $4, $5, $6, $7, TRUE)`,
		quoteIdent(schema), quoteIdent(historyTable))

	if _, err := tx.Exec(ctx, insertSQL,
		rank, m.version, m.description, m.script, checksum(m.body), currentUser(), elapsedMs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nextRank(ctx context.Context, tx pgx.Tx, schema string) (int, error) {
	var rank int
	err := tx.QueryRow(ctx, fmt.Sprintf(
		`SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM %s.%s`,
		quoteIdent(schema), quoteIdent(historyTable))).Scan(&rank)
	if err != nil {
		return 0, err
	}
	return rank, nil
}

func currentUser() string {
	return "go-migrator"
}

// checksum is FNV-1a. Recorded for diagnostics only, never compared against
// Flyway's CRC32, for the reason documented in the package comment.
func checksum(body string) int {
	var h uint32 = 2166136261
	for i := 0; i < len(body); i++ {
		h ^= uint32(body[i])
		h *= 16777619
	}
	return int(int32(h))
}

func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}
