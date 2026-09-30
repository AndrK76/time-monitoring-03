package adminsvc

import (
	"encoding/json"
	"strings"
)

// Small shared helpers. Java's String#isBlank treats whitespace-only as empty,
// and String#equalsIgnoreCase is locale-independent ASCII case folding for the
// identifiers in this schema, so these mirror both.

func isBlank(s *string) bool {
	return s == nil || strings.TrimSpace(*s) == ""
}

func blank(s string) bool { return strings.TrimSpace(s) == "" }

func str(s string) *string { return &s }

// equalFoldIgnoreCase is ASCII case-insensitive comparison, which is what
// String#equalsIgnoreCase does for the identifier-shaped values compared here.
func equalFoldIgnoreCase(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if 'A' <= ca && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if 'A' <= cb && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}

// deref reads a possibly-absent string, mapping NULL and the empty string onto
// the same Go value the Java null-or-empty checks treated alike.
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// derefInt64 is deref for the int64 columns the YClients rows use for external
// ids. A missing external id is reported as zero, which is how the Java mapper
// read a null Long field into a primitive long.
func derefInt64(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

// firstNonBlank returns a when it carries something, b otherwise. It is the
// "name = dto.name ?: dto.ycName" pattern the Java service repeated for services
// and places: a service or employee that the user renamed locally keeps the
// local name, and one that was registered straight from a YClients listing has
// none, so the upstream title is used.
func firstNonBlank(a, b string) string {
	if blank(a) {
		return b
	}
	return a
}

// jsonUnmarshal is json.Unmarshal with the error dropped. It is used only for
// upstream payloads already known to be well formed, where a decode failure must
// degrade to an empty list rather than fail the request: a partner whose
// response changed shape should produce an empty screen, not a 500.
func jsonUnmarshal(raw []byte, target any) error { return json.Unmarshal(raw, target) }

// metaRaw wraps a message in a one-key meta block, so a failure produced from a
// Go error rather than an upstream response still renders in the envelope shape
// the front-end parses.
func metaRaw(message *string) json.RawMessage {
	if message == nil {
		return nil
	}
	encoded, err := json.Marshal(map[string]string{"message": *message})
	if err != nil {
		return nil
	}
	return encoded
}
