package common

import (
	"encoding/base64"
	"log/slog"
	"strings"
)

// XorCipher mirrors ru.igorit.monitoring.common.util.XorCipher.
//
// This is deliberately NOT encryption: it is a repeating-key XOR followed by
// standard Base64. It only keeps credentials out of plain sight in the
// database, so the Java implementation is reproduced byte-for-byte to keep
// previously stored rows readable after the migration.
//
// encrypt: nil/empty passes through; otherwise XOR over the UTF-8 bytes against
// the repeated key, then standard padded Base64.
// decrypt: nil/empty passes through; otherwise Base64-decode, then the same XOR.
// A decode failure is logged and the input is returned unchanged, which is what
// the Java code does (it swallows the exception). Callers therefore never see an
// error from decrypt.
type XorCipher struct{}

func NewXorCipher() *XorCipher { return &XorCipher{} }

func (c *XorCipher) Encrypt(value *string, secret string) *string {
	if value == nil || *value == "" {
		return value
	}
	key := []byte(secret)
	if len(key) == 0 {
		// Java throws on key.length == 0 (division by zero). There is no
		// sensible Go equivalent, so fail closed with a nil result.
		return nil
	}
	data := []byte(*value)
	out := make([]byte, len(data))
	for i, b := range data {
		out[i] = b ^ key[i%len(key)]
	}
	encoded := base64.StdEncoding.EncodeToString(out)
	return &encoded
}

func (c *XorCipher) Decrypt(masked *string, secret string) *string {
	if masked == nil || *masked == "" {
		return masked
	}
	key := []byte(secret)
	if len(key) == 0 {
		return masked
	}
	data, err := base64.StdEncoding.DecodeString(*masked)
	if err != nil {
		slog.Warn("xor decrypt: base64 decode failed, returning input unchanged", "err", err)
		return masked
	}
	out := make([]byte, len(data))
	for i, b := range data {
		out[i] = b ^ key[i%len(key)]
	}
	plain := string(out)
	return &plain
}

// IsBlank reports whether s is nil, empty, or only whitespace. Used in place of
// the Java String#isBlank checks that guard credential handling.
func IsBlank(s *string) bool {
	return s == nil || strings.TrimSpace(*s) == ""
}
