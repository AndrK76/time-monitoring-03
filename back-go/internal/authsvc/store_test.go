package authsvc

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// TestNullHelpersMapInvalidToNil covers the conversion helpers every scan in
// the store uses. The bug they exist to prevent: a bare *string or *time.Time
// passed to Scan is a non-nullable target in pgx, so a NULL column aborts the
// whole query with "cannot scan NULL into ...". Every seeded row has a NULL
// last_login_at, updated_at and created_by, so that failure made the login path
// return 401 for accounts that existed.
func TestNullHelpersMapInvalidToNil(t *testing.T) {
	if got := nullTime(pgtype.Timestamp{}); got != nil {
		t.Errorf("nullTime(invalid) = %v, want nil", got)
	}
	if got := nullString(pgtype.Text{}); got != nil {
		t.Errorf("nullString(invalid) = %v, want nil", got)
	}
}

// TestNullHelpersConvertValidValues is the other half: a value that is present
// must come through unchanged, not be dropped as falsy. An empty string is a
// present value and must stay one.
func TestNullHelpersConvertValidValues(t *testing.T) {
	ts := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	got := nullTime(pgtype.Timestamp{Time: ts, Valid: true})
	if got == nil {
		t.Fatal("nullTime(valid) = nil, want a value")
	}
	if !got.Time.Equal(ts) {
		t.Errorf("nullTime(valid) = %v, want %v", got.Time, ts)
	}

	empty := nullString(pgtype.Text{String: "", Valid: true})
	if empty == nil {
		t.Error("a present empty string must not be reported as NULL")
	} else if *empty != "" {
		t.Errorf("nullString(valid empty) = %q", *empty)
	}

	// And the type the response actually carries, to catch a future refactor
	// that swaps the helper's argument for something nullable-incompatible.
	var _ *common.LocalDateTime = got
}

// TestStringArgMarshalsNilAsSQLNull pins the argument side of the same
// problem: a nil optional field must reach the database as NULL, not as the
// string "<nil>" or an empty string that would overwrite a stored value.
func TestStringArgMarshalsNilAsSQLNull(t *testing.T) {
	if got := stringArg(nil); got != nil {
		t.Errorf("stringArg(nil) = %v, want nil", got)
	}
	s := "value"
	if got := stringArg(&s); got != "value" {
		t.Errorf("stringArg(&s) = %v, want value", got)
	}
	// A pointer to an empty string is a deliberate empty value, not an absence.
	empty := ""
	if got := stringArg(&empty); got != "" {
		t.Errorf("stringArg(&empty) = %v, want an empty string", got)
	}
}

// TestPasswordHashTreatsNilAsUnusable models the Spring behaviour the login
// path depends on: an account with a NULL password cannot authenticate, because
// there is nothing to compare against.
func TestPasswordHashTreatsNilAsUnusable(t *testing.T) {
	if (&User{}).PasswordHash() != "" {
		t.Error("a user with no password column should hash to the empty string")
	}
	hash := "$2a$10$notarealhash"
	if (&User{Password: &hash}).PasswordHash() != hash {
		t.Error("a stored hash must be returned unchanged")
	}
}
