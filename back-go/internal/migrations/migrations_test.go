package migrations

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func load(t *testing.T, schema string) []migration {
	t.Helper()
	all, err := loadMigrations(files, schema)
	if err != nil {
		t.Fatalf("loadMigrations(%s): %v", schema, err)
	}
	return all
}

// TestEveryEmbeddedScriptLoads guards the embed pattern and the file naming
// convention. A file that does not match V<version>__<description>.sql would
// otherwise be discovered only at boot, on the machine that needs it least.
func TestEveryEmbeddedScriptLoads(t *testing.T) {
	for _, schema := range []string{"auth", "admin", "mon"} {
		t.Run(schema, func(t *testing.T) {
			all := load(t, schema)
			if len(all) == 0 {
				t.Fatal("no migrations found")
			}
			for _, m := range all {
				if m.body == "" {
					t.Errorf("%s has an empty body", m.script)
				}
				if m.description == "" {
					t.Errorf("%s has no description", m.script)
				}
			}
		})
	}
}

// TestMigrationCounts pins the expected number of scripts per schema. The count
// is a proxy for "nothing was silently dropped during the copy from back/".
func TestMigrationCounts(t *testing.T) {
	want := map[string]int{"auth": 6, "admin": 19, "mon": 3}
	for schema, expected := range want {
		if got := len(load(t, schema)); got != expected {
			t.Errorf("schema %s has %d migrations, want %d", schema, got, expected)
		}
	}
}

// TestVersionsAreOrderedAndUnique checks the numeric-aware sort. A lexicographic
// sort would put 01.10 before 01.09, which would apply migrations out of order on
// a fresh database.
func TestVersionsAreOrderedAndUnique(t *testing.T) {
	for _, schema := range []string{"auth", "admin", "mon"} {
		t.Run(schema, func(t *testing.T) {
			all := load(t, schema)
			seen := make(map[string]bool, len(all))
			prev := ""
			for _, m := range all {
				if seen[m.version] {
					t.Errorf("duplicate version %s", m.version)
				}
				seen[m.version] = true
				if prev != "" && compareVersions(prev, m.version) > 0 {
					t.Errorf("version %s sorts before %s", m.version, prev)
				}
				prev = m.version
			}
		})
	}
}

func TestCompareVersionsIsNumeric(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"01.01", "01.02", -1},
		{"01.09", "01.10", -1},
		{"01.10", "01.09", 1},
		{"01.10", "01.10", 0},
		{"01.10", "01.10.1", -1},
		{"2", "10", -1},
	}
	for _, tc := range cases {
		if got := compareVersions(tc.a, tc.b); got != tc.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

// TestMigratedSchemasOwnTheExpectedObjects spot-checks that the scripts create
// the tables the services read, using the SQL text rather than a live database
// so the test needs no server.
func TestMigratedSchemasOwnTheExpectedObjects(t *testing.T) {
	cases := []struct {
		schema string
		table  string
	}{
		{"auth", "users"},
		{"auth", "roles"},
		{"auth", "permissions"},
		{"auth", "user_roles"},
		{"auth", "role_permissions"},
		{"auth", "user_organizations"},
		{"auth", "telegram_tokens"},
		{"admin", "macroscop_agent_configs"},
		{"admin", "macroscop_evt_agent_configs"},
		{"admin", "macroscop_img_agent_configs"},
		{"admin", "macroscop_agent_channels"},
		{"admin", "crm_agents"},
		{"admin", "evt_agents"},
		{"admin", "img_agents"},
		{"admin", "yc_agent_configs"},
		{"mon", "organizations"},
	}
	for _, tc := range cases {
		t.Run(tc.schema+"."+tc.table, func(t *testing.T) {
			body := strings.Join(bodies(load(t, tc.schema)), "\n")
			if !strings.Contains(body, "CREATE TABLE") {
				t.Fatal("no CREATE TABLE in the migration set")
			}
			if !strings.Contains(body, tc.table) {
				t.Fatalf("no migration mentions %s", tc.table)
			}
		})
	}
}

func bodies(all []migration) []string {
	out := make([]string, 0, len(all))
	for _, m := range all {
		out = append(out, m.body)
	}
	return out
}

func TestQuoteIdentEscapesQuotes(t *testing.T) {
	if got := quoteIdent("we\"ird"); got != `"we""ird"` {
		t.Fatalf("quoteIdent = %s, want a doubled quote", got)
	}
}

// TestChecksumIsStable pins that the recorded checksum does not change between
// runs. It is diagnostic only, but a checksum that moved would make a diff of
// the history table meaningless.
func TestChecksumIsStable(t *testing.T) {
	body := "SELECT 1;"
	if checksum(body) != checksum(body) {
		t.Fatal("checksum is not deterministic")
	}
	if checksum("SELECT 1;") == checksum("SELECT 2;") {
		t.Fatal("different bodies produced the same checksum")
	}
}

func TestFNVAdvisoryLockKeysAreStableAndDistinct(t *testing.T) {
	if advisoryLockKey("auth") != advisoryLockKey("auth") {
		t.Error("lock key is not stable")
	}
	if advisoryLockKey("auth") == advisoryLockKey("admin") {
		t.Error("auth and admin share a lock key, so the services would contend")
	}
	if advisoryLockKey("mon") == advisoryLockKey("admin") {
		t.Error("mon and admin share a lock key")
	}
}

// TestNoCredentialsInMigrationFiles is a guard against committing a real secret
// into the schema history. The scripts are embedded in the binaries, so anything
// here ships.
func TestNoCredentialsInMigrationFiles(t *testing.T) {
	suspicious := []string{"password '", "secret '", "api_key '", "token '"}
	for _, schema := range []string{"auth", "admin", "mon"} {
		for _, m := range load(t, schema) {
			lower := strings.ToLower(m.body)
			for _, s := range suspicious {
				if strings.Contains(lower, s) {
					t.Errorf("%s contains what looks like a literal credential", m.script)
				}
			}
		}
	}
}

var _ = os.Getenv
var _ = context.Background
var _ pgx.Row
