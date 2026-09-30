package common

import (
	"bytes"
	"encoding/json"
	"fmt"
	"time"
)

// LocalDateTime is a Java-compatible LocalDateTime on the JSON wire.
//
// Jackson with JavaTimeModule and WRITE_DATES_AS_TIMESTAMPS disabled renders a
// java.time.LocalDateTime as an ISO-8601 string with NO offset, and the fraction
// is omitted entirely when it is zero, otherwise emitted as exactly 3, 6, or 9
// digits (trailing zeros trimmed). time.RFC3339Nano would append a zone and trim
// to 0-9 digits freely, so it is not wire-compatible; this type reproduces the
// Java rendering exactly.
type LocalDateTime struct {
	time.Time
}

// NewLocalDateTime truncates to microseconds, matching what the Java services
// write to their TIMESTAMP columns.
func NewLocalDateTime(t time.Time) LocalDateTime {
	return LocalDateTime{Time: t.UTC().Truncate(time.Microsecond)}
}

// NowLocalDateTime returns the current time in UTC, truncated to microseconds.
func NowLocalDateTime() LocalDateTime { return NewLocalDateTime(time.Now()) }

// Ptr returns a pointer to a copy, for nullable columns.
func (l LocalDateTime) Ptr() *LocalDateTime {
	c := l
	return &c
}

func (l LocalDateTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + l.String() + `"`), nil
}

func (l *LocalDateTime) UnmarshalJSON(data []byte) error {
	if l == nil {
		return fmt.Errorf("common.LocalDateTime: UnmarshalJSON on nil pointer")
	}
	if bytes.Equal(data, []byte("null")) {
		l.Time = time.Time{}
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	if s == "" {
		l.Time = time.Time{}
		return nil
	}
	// This type only ever renders a bare LocalDateTime, but input may come from
	// a client, another language's serializer, or a database adapter that
	// appends a zone, so offset-bearing forms are accepted and converted to UTC.
	for _, layout := range []string{
		"2006-01-02T15:04:05.999999999Z07:00",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			l.Time = t.UTC()
			return nil
		}
	}
	return fmt.Errorf("common.LocalDateTime: cannot parse %q", s)
}

func (l LocalDateTime) String() string {
	nano := l.Time.Nanosecond()
	switch {
	case nano == 0:
		return l.Time.Format("2006-01-02T15:04:05")
	case nano%1_000_000 == 0:
		return l.Time.Format("2006-01-02T15:04:05.000")
	case nano%1_000 == 0:
		return l.Time.Format("2006-01-02T15:04:05.000000")
	default:
		return l.Time.Format("2006-01-02T15:04:05.000000000")
	}
}

// IsZero reports whether the value is unset, for nullable column handling.
func (l LocalDateTime) IsZero() bool { return l.Time.IsZero() }
