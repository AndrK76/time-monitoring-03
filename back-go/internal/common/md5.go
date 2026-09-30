package common

import (
	"crypto/md5"
	"encoding/hex"
	"strings"
)

// Md5HashUtf mirrors ru.igorit.monitoring.common.util.Md5Hasher#md5HashUtf.
//
// A nil or blank input yields "", not the digest of the empty string. Any other
// input is hashed over its UTF-8 bytes and rendered as 32 lowercase hex chars.
func Md5HashUtf(src *string) string {
	if src == nil {
		return ""
	}
	if strings.TrimSpace(*src) == "" {
		return ""
	}
	sum := md5.Sum([]byte(*src))
	return hex.EncodeToString(sum[:])
}

// Md5String is the convenience form of Md5HashUtf for a plain string.
func Md5String(src string) string {
	return Md5HashUtf(&src)
}
