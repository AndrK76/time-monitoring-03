// Package validate reproduces the subset of Jakarta Bean Validation the request
// DTOs actually use, with the same messages.
//
// Spring rendered a constraint violation as a 400 whose problem detail lists the
// failing field messages. Rather than a reflection-based tag library, each DTO
// is validated by an explicit function, which keeps the rules and their messages
// visible at the call site and impossible to drift out of sync.
package validate

import (
	"fmt"
	"net/mail"
	"strings"
	"unicode/utf8"

	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
)

// Error accumulates constraint violations in declaration order, which is the
// order Spring reported them in.
type Error struct {
	Messages []string
}

func (e *Error) Error() string { return strings.Join(e.Messages, "; ") }

// AsError converts the accumulated violations into the 400 the client sees.
func (e *Error) AsError() error {
	return &httpx.ValidationError{Messages: e.Messages}
}

// V accumulates violations.
type V struct{ err *Error }

func New() *V { return &V{} }

// NotBlank rejects nil, empty, and whitespace-only values.
//
// message is the explicit text where the Java DTO supplied one
// (@NotBlank("Username is required")); otherwise the conventional
// "must not be blank" is used.
func (v *V) NotBlank(field, value string, ok bool, message string) *V {
	if ok {
		return v
	}
	if message == "" {
		message = fmt.Sprintf("%s: must not be blank", field)
	}
	v.err = v.add(message)
	return v
}

// NotNil rejects a missing required value, for pointer and numeric fields that
// the Java code annotated with @NotNull.
func (v *V) NotNil(field string, present bool, message string) *V {
	if present {
		return v
	}
	if message == "" {
		message = fmt.Sprintf("%s: must not be null", field)
	}
	v.err = v.add(message)
	return v
}

// Size enforces a minimum length, and optionally a maximum, in characters.
// Spring's @Size counts Java chars, so this counts runes.
func (v *V) Size(field, value string, min, max int) *V {
	length := utf8.RuneCountInString(value)
	if length < min || (max > 0 && length > max) {
		v.err = v.add(fmt.Sprintf("%s: size must be between %d and %d", field, min, max))
	}
	return v
}

// Email rejects values net/mail rejects. The Java code used
// @Email, which is a lenient regex; net/mail is stricter, so a hand-rolled
// check is used instead to keep the same tolerance.
func (v *V) Email(field, value string) *V {
	if value == "" {
		return v
	}
	if !looksLikeEmail(value) {
		v.err = v.add(fmt.Sprintf("%s: must be a well-formed email address", field))
	}
	return v
}

func (v *V) add(msg string) *Error {
	if v.err == nil {
		v.err = &Error{}
	}
	v.err.Messages = append(v.err.Messages, msg)
	return v.err
}

// OK reports whether anything failed.
func (v *V) OK() bool { return v.err == nil }

// Err returns the violation error, or nil.
func (v *V) Err() error {
	if v.err == nil {
		return nil
	}
	return v.err.AsError()
}

// looksLikeEmail mirrors Hibernate's @Email behaviour closely enough: one "@"
// with non-empty, non-whitespace-free local and domain parts, and a dot in the
// domain.
func looksLikeEmail(s string) bool {
	if strings.Count(s, "@") != 1 {
		return false
	}
	local, domain, _ := strings.Cut(s, "@")
	if local == "" || domain == "" {
		return false
	}
	if strings.ContainsAny(local, " \t") || strings.ContainsAny(domain, " \t") {
		return false
	}
	if !strings.Contains(domain, ".") {
		return false
	}
	if strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return false
	}
	// A well-formed address must also parse; this rejects stray punctuation
	// without rejecting anything net/mail accepts.
	_, err := mail.ParseAddress(s)
	return err == nil
}
