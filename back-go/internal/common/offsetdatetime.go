package common

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// OffsetDateTime is a Java-compatible java.time.OffsetDateTime / ZonedDateTime
// on the JSON wire.
//
// The Macroscop DTOs are the only place these appear: MacroscopServerInfoDto
// carries the server's own UTC offset, and MacroscopChannelDto carries a
// bare ZoneOffset. Jackson renders both with java.time.format.DateTimeFormatter,
// and time.RFC3339Nano is not byte-compatible with it:
//
//   - ISO_OFFSET_DATE_TIME writes the fraction as 3, 6, or 9 digits and omits it
//     entirely when the nanosecond field is zero. RFC3339Nano trims to whatever
//     remains, so 100000 ns renders as ".0000001" in Go and ".000000" in Java.
//   - The offset is "+HH:MM", extended to "+HH:MM:SS" only when the seconds
//     field is non-zero, and "Z" for zero. Go's "-07:00" never emits seconds.
//
// Zone offsets are always whole minutes for the real zones involved, but the
// formatter follows the spec so an exotic offset round-trips.
//
// A ZonedDateTime whose zone is the same ZoneOffset as its offset - which is
// the case everywhere here, because TimeUtils builds them with ZoneOffset.of -
// is formatted as an offset date-time with no bracketed zone id, so this type
// covers both Java types.
type OffsetDateTime struct {
	time.Time
}

// NewOffsetDateTime keeps the instant, truncating to nanoseconds.
func NewOffsetDateTime(t time.Time) OffsetDateTime { return OffsetDateTime{Time: t} }

// NowOffsetDateTime returns the current instant.
func NowOffsetDateTime() OffsetDateTime { return OffsetDateTime{Time: time.Now().UTC()} }

// Ptr returns a pointer to a copy, for nullable columns.
func (o OffsetDateTime) Ptr() *OffsetDateTime {
	c := o
	return &c
}

func (o OffsetDateTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + o.String() + "`"), nil
}

// String renders the value the way java.time's ISO_OFFSET_DATE_TIME does.
func (o OffsetDateTime) String() string {
	if o.IsZero() {
		return ""
	}
	_, offset := o.Zone()
	return o.In(offsetLocation(offset)).Format("2006-01-02T15:04:05") + formatNanos(o.Nanosecond()) + formatOffset(offset)
}

func (o *OffsetDateTime) UnmarshalJSON(data []byte) error {
	if o == nil {
		return fmt.Errorf("common.OffsetDateTime: UnmarshalJSON on nil pointer")
	}
	if bytes.Equal(data, []byte("null")) {
		o.Time = time.Time{}
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	if s == "" {
		o.Time = time.Time{}
		return nil
	}
	parsed, err := ParseOffsetDateTime(s)
	if err != nil {
		return err
	}
	o.Time = parsed
	return nil
}

// ParseOffsetDateTime accepts what Jackson accepts for the Macroscop DTOs:
// ISO_OFFSET_DATE_TIME, with or without a bracketed zone id, and a bare local
// date-time, which is read as UTC.
func ParseOffsetDateTime(s string) (time.Time, error) {
	if i := strings.IndexByte(s, '['); i >= 0 {
		if !strings.HasSuffix(s, "]") {
			return time.Time{}, fmt.Errorf("malformed zone id in %q", s)
		}
		s = s[:i]
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	for _, layout := range []string{
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse %q as an offset date-time", s)
}

// formatNanos renders the fractional second the way java.time does: omitted when
// zero, otherwise exactly 3, 6, or 9 digits, keeping the Java grouping so a
// microsecond-precision timestamp does not gain a spurious nanosecond group.
func formatNanos(n int) string {
	switch {
	case n == 0:
		return ""
	case n%1_000_000 == 0:
		return fmt.Sprintf(".%03d", n/1_000_000)
	case n%1_000 == 0:
		return fmt.Sprintf(".%06d", n/1_000)
	default:
		return fmt.Sprintf(".%09d", n)
	}
}

// formatOffset renders a zone offset as "Z", "+HH:MM", or "+HH:MM:SS".
func formatOffset(offset int) string {
	if offset == 0 {
		return "Z"
	}
	sign := "+"
	if offset < 0 {
		sign = "-"
		offset = -offset
	}
	hours := offset / 3600
	minutes := (offset % 3600) / 60
	seconds := offset % 60
	if seconds == 0 {
		return fmt.Sprintf("%s%02d:%02d", sign, hours, minutes)
	}
	return fmt.Sprintf("%s%02d:%02d:%02d", sign, hours, minutes, seconds)
}

// offsetLocation turns a numeric zone offset into a *time.Location so the
// formatter above can render it.
func offsetLocation(offset int) *time.Location {
	name := formatOffset(offset)
	if name == "Z" {
		return time.UTC
	}
	return time.FixedZone(name, offset)
}

// FormatZoneOffset renders a ZoneOffset the way Jackson does, which is what
// MacroscopChannelDto.tz and MacroscopServerInfoDto.tz carry. A negative offset
// of less than an hour renders as "-01:00" and the zero offset as "Z", matching
// ZoneOffset.getId().
func FormatZoneOffset(offset int) string { return formatOffset(offset) }

// ParseZoneOffset mirrors TimeUtils.stringToZoneOffset: a blank or unparseable
// string yields no offset rather than an error, and the boolean reports which.
func ParseZoneOffset(s string) (int, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	if s == "Z" || s == "UTC" {
		return 0, true
	}
	neg := false
	switch s[0] {
	case '+':
	case '-':
		neg = true
	default:
		// "Z" handled above; anything else, including a bare hour count, is
		// accepted by ZoneOffset.of as a total-hour offset.
	}
	body := s
	if s[0] == '+' || s[0] == '-' {
		body = s[1:]
	}
	parts := strings.Split(body, ":")
	if len(parts) > 3 {
		return 0, false
	}
	fields := make([]int, 3)
	for i, p := range parts {
		if p == "" || len(p) > 2 {
			return 0, false
		}
		n := 0
		for _, c := range p {
			if c < '0' || c > '9' {
				return 0, false
			}
			n = n*10 + int(c-'0')
		}
		fields[i] = n
	}
	// ZoneOffset.of accepts "+HH", "+HH:MM" and "+HH:MM:SS", so the fields are
	// hours, minutes and seconds from the left.
	total := fields[0]*3600 + fields[1]*60 + fields[2]
	if neg {
		total = -total
	}
	return total, true
}
