package common

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"testing"
)

// TestMd5MatchesJavaContract pins the odd corners of the Java Md5Hasher: a nil
// or blank input yields "", not the digest of the empty string, and every other
// input is hashed over its UTF-8 bytes as lowercase hex.
func TestMd5MatchesJavaContract(t *testing.T) {
	blank := "   "
	cases := []struct {
		name string
		in   *string
		want string
	}{
		{"nil", nil, ""},
		{"empty", strptr(""), ""},
		{"whitespace only", &blank, ""},
		{"ascii", strptr("abc"), "900150983cd24fb0d6963f7d28e17f72"},
		{"empty digest check", strptr(""), ""},
		{"cyrillic is hashed as utf8", strptr("привет"), md5Of([]byte("привет"))},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := Md5HashUtf(tc.in); got != tc.want {
				t.Fatalf("Md5HashUtf = %q, want %q", got, tc.want)
			}
		})
	}
}

// TestXorRoundTrip checks the masking cipher preserves values, which is what
// matters for reading credentials already stored by the Java services.
func TestXorRoundTrip(t *testing.T) {
	c := NewXorCipher()
	secret := "store-xor-secret"
	values := []string{"", "s3cret", "пароль с пробелами", strings.Repeat("x", 200)}
	for _, v := range values {
		masked := c.Encrypt(&v, secret)
		if masked == nil {
			t.Fatalf("Encrypt returned nil for %q", v)
		}
		back := c.Decrypt(masked, secret)
		if *back != v {
			t.Fatalf("round trip of %q produced %q", v, *back)
		}
	}
}

// TestXorIsNotStableAcrossSecrets documents that the cipher is key-dependent:
// a value masked with one key does not unmask with another. This is why
// STORE_XOR must be identical across all three services.
func TestXorIsNotStableAcrossSecrets(t *testing.T) {
	c := NewXorCipher()
	value := "shared-secret"
	masked := c.Encrypt(&value, "key-a")
	back := c.Decrypt(masked, "key-b")
	if *back == value {
		t.Fatal("expected a different key to produce a different plaintext")
	}
}

// TestXorDecryptPassesThroughUndecodableInput reproduces the Java behaviour of
// returning the input unchanged when Base64 decoding fails, rather than
// throwing. A row written by a different scheme therefore reads back as itself
// instead of failing the whole request.
func TestXorDecryptPassesThroughUndecodableInput(t *testing.T) {
	c := NewXorCipher()
	garbage := "not valid base64 !!!"
	got := c.Decrypt(&garbage, "key")
	if got == nil || *got != garbage {
		t.Fatalf("Decrypt = %v, want the input unchanged", got)
	}
}

// TestXorEncryptPassesThroughNilAndEmpty matches the Java guard, so an unset
// credential stays NULL rather than becoming an empty masked value.
func TestXorEncryptPassesThroughNilAndEmpty(t *testing.T) {
	c := NewXorCipher()
	if got := c.Encrypt(nil, "key"); got != nil {
		t.Errorf("Encrypt(nil) = %v, want nil", got)
	}
	empty := ""
	got := c.Encrypt(&empty, "key")
	if got == nil || *got != "" {
		t.Errorf("Encrypt(empty) = %v, want the empty value unchanged", got)
	}
}

// TestXorOutputIsPaddedBase64 checks the encoding is standard padded Base64, so
// rows written by the Java XorCipher stay decodable here.
func TestXorOutputIsPaddedBase64(t *testing.T) {
	c := NewXorCipher()
	value := "a"
	masked := c.Encrypt(&value, "key")
	if _, err := base64.StdEncoding.DecodeString(*masked); err != nil {
		t.Fatalf("masked value is not standard Base64: %v", err)
	}
}

// TestLocalDateTimeRendering pins the Java LocalDateTime JSON shape: no offset,
// and the fraction omitted entirely or rendered as exactly 3, 6, or 9 digits.
// time.RFC3339Nano would append a zone and vary the digit count, so this is a
// wire contract rather than a formatting preference.
func TestLocalDateTimeRendering(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"no fraction", "2026-09-29T12:34:56Z", "2026-09-29T12:34:56"},
		{"milliseconds", "2026-09-29T12:34:56.123Z", "2026-09-29T12:34:56.123"},
		{"microseconds", "2026-09-29T12:34:56.123456Z", "2026-09-29T12:34:56.123456"},
		{"nanoseconds", "2026-09-29T12:34:56.123456789Z", "2026-09-29T12:34:56.123456789"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var l LocalDateTime
			if err := l.UnmarshalJSON([]byte(`"` + tc.in + `"`)); err != nil {
				t.Fatalf("UnmarshalJSON: %v", err)
			}
			if got := l.String(); got != tc.want {
				t.Fatalf("String() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestLocalDateTimeMarshalsWithoutOffset(t *testing.T) {
	var l LocalDateTime
	if err := l.UnmarshalJSON([]byte(`"2026-09-29T12:34:56.500000Z"`)); err != nil {
		t.Fatalf("UnmarshalJSON: %v", err)
	}
	data, err := l.MarshalJSON()
	if err != nil {
		t.Fatalf("MarshalJSON: %v", err)
	}
	// A microsecond value that happens to be a whole millisecond renders as
	// three digits, which is what java.time.LocalDateTime.toString does.
	if string(data) != `"2026-09-29T12:34:56.500"` {
		t.Fatalf("MarshalJSON = %s, want no zone designator", data)
	}
	if bytes.Contains(data, []byte("Z")) || bytes.Contains(data, []byte("+")) {
		t.Fatalf("MarshalJSON = %s, must not carry an offset", data)
	}
}

func TestLocalDateTimeNullRoundTrips(t *testing.T) {
	var l LocalDateTime
	if err := l.UnmarshalJSON([]byte(`null`)); err != nil {
		t.Fatalf("UnmarshalJSON(null): %v", err)
	}
	if !l.IsZero() {
		t.Fatal("null should decode to the zero time")
	}
}

// TestSplitListMatchesJavaSplit guards the comma-split used for the user context
// wire format: a blank string yields an empty slice, never a slice holding one
// empty element, and surrounding whitespace is trimmed.
func TestSplitListMatchesJavaSplit(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"", []string{}},
		{"   ", []string{}},
		{"a", []string{"a"}},
		{"a,b", []string{"a", "b"}},
		{"a, b ,c", []string{"a", "b", "c"}},
		{"a,,b", []string{"a", "b"}},
	}
	for _, tc := range cases {
		got := SplitList(tc.in)
		if len(got) != len(tc.want) {
			t.Fatalf("SplitList(%q) = %v, want %v", tc.in, got, tc.want)
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Fatalf("SplitList(%q) = %v, want %v", tc.in, got, tc.want)
			}
		}
	}
}

func TestUserContextHelpers(t *testing.T) {
	uc := &UserContext{
		UserID:               "u1",
		Roles:                "ROLE_A,ROLE_B",
		Permissions:          "USER_READ,USER_WRITE",
		AllowedOrganizations: "org-a,org-b",
	}
	if !uc.HasRole("ROLE_A") || !uc.HasRole("ROLE_B") {
		t.Error("expected both roles to be present")
	}
	if uc.HasRole("ROLE_C") {
		t.Error("unexpected role matched")
	}
	if !uc.HasPermission("USER_WRITE") {
		t.Error("expected USER_WRITE to be present")
	}
	if !uc.IsAllowedOrganization("org-b") {
		t.Error("expected org-b to be allowed")
	}
	if uc.IsAllowedOrganization("org-z") {
		t.Error("unexpected organization matched")
	}
}

func TestSystemAndAnonymousContexts(t *testing.T) {
	sys := SystemUserContext()
	if sys.UserID != SystemUserID || sys.Username != SystemUser || !sys.Authenticated {
		t.Errorf("system context = %+v", sys)
	}
	anon := AnonymousUserContext()
	if anon.UserID != AnonymousUserID || anon.Authenticated {
		t.Errorf("anonymous context = %+v", anon)
	}
}

func strptr(s string) *string { return &s }

// md5Of is a local helper so the test can state the expected digest without
// reimplementing the production path it is checking.
func md5Of(b []byte) string {
	sum := md5.Sum(b)
	return hex.EncodeToString(sum[:])
}
