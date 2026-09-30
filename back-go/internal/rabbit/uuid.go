package rabbit

import "crypto/rand"

// newUUID returns a random RFC 4122 version 4 identifier.
//
// The Java code used UUID.randomUUID() for both the command id and the
// correlation id, and set the two to the same value.
func newUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand does not fail in practice; a zero-filled id is worse than
		// a panic because it would silently collide across commands.
		panic("rabbit: crypto/rand unavailable: " + err.Error())
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	const hex = "0123456789abcdef"
	out := make([]byte, 36)
	pos := 0
	for i, c := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			out[pos] = '-'
			pos++
		}
		out[pos] = hex[c>>4]
		out[pos+1] = hex[c&0x0f]
		pos += 2
	}
	return string(out)
}

// NewUUID is the exported form, for identifiers generated outside this package.
func NewUUID() string { return newUUID() }
