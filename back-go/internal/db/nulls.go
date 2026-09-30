package db

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// The helpers below convert pgx's nullable wrappers into the wire types the
// services use, and back again.
//
// They exist because pgx will scan a NULL into a pointer-to-pointer, but a bare
// *string or *time.Time destination is treated as a non-nullable target and the
// scan fails with "cannot scan NULL into *string". Every nullable column in the
// schema goes through these two pairs rather than a hand-rolled nil check per
// call site.

// NullString converts a nullable text column into a *string, nil for SQL NULL.
func NullString(v pgtype.Text) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

// StringValue converts a *string into a nullable text value, nil for a nil
// pointer.
func StringValue(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

// NullTime converts a nullable TIMESTAMP WITHOUT TIME ZONE column.
func NullTime(v pgtype.Timestamp) *common.LocalDateTime {
	if !v.Valid {
		return nil
	}
	t := common.NewLocalDateTime(v.Time)
	return &t
}

// LocalTimeValue converts a *LocalDateTime into a TIMESTAMP WITHOUT TIME ZONE
// argument, nil for a nil pointer.
func LocalTimeValue(v *common.LocalDateTime) any {
	if v == nil {
		return nil
	}
	return v.Time
}

// NullOffsetTime converts a nullable TIMESTAMP WITH TIME ZONE column.
func NullOffsetTime(v pgtype.Timestamptz) *common.OffsetDateTime {
	if !v.Valid {
		return nil
	}
	t := common.NewOffsetDateTime(v.Time)
	return &t
}

// OffsetTimeValue converts an *OffsetDateTime into a TIMESTAMP WITH TIME ZONE
// argument, nil for a nil pointer.
func OffsetTimeValue(v *common.OffsetDateTime) any {
	if v == nil {
		return nil
	}
	return v.Time
}

// NullTimeValue converts a nullable TIMESTAMP column into a *time.Time for the
// few call sites that only need the instant.
func NullTimeValue(v pgtype.Timestamp) *time.Time {
	if !v.Valid {
		return nil
	}
	t := v.Time
	return &t
}

// NullInt64 converts a nullable bigint column into a *int64, nil for SQL NULL.
func NullInt64(v pgtype.Int8) *int64 {
	if !v.Valid {
		return nil
	}
	n := v.Int64
	return &n
}

// Int64Value converts a *int64 into a bigint argument, nil for a nil pointer.
func Int64Value(v *int64) any {
	if v == nil {
		return nil
	}
	return *v
}

// NullBool converts a nullable boolean column into a *bool, nil for SQL NULL.
func NullBool(v pgtype.Bool) *bool {
	if !v.Valid {
		return nil
	}
	b := v.Bool
	return &b
}

// BoolValue converts a *bool into a boolean argument, nil for a nil pointer.
func BoolValue(v *bool) any {
	if v == nil {
		return nil
	}
	return *v
}
