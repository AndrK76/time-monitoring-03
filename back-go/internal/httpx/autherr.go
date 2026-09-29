package httpx

import (
	"net/http"
	"strings"
	"time"
)

// AuthErrorCode is the `code` field of the login-shaped error envelope.
//
// The Java helper derived it from the exception's simple class name with the
// "Exception" suffix stripped and the rest upper-cased, which is why a few
// values look truncated (INTERNALSERVIC is InternalAuthenticationServiceException
// with the last nine characters removed). The names are fixed here rather than
// derived from type names, which keeps the wire contract stable regardless of
// how the Go code is organised.
type AuthErrorCode string

const (
	CodeBadCredentials   AuthErrorCode = "BADCREDENTIALS"
	CodeUsernameNotFound AuthErrorCode = "USERNAMENOTFOUND"
	CodeLocked           AuthErrorCode = "LOCKED"
	CodeDisabled         AuthErrorCode = "DISABLED"
	CodeInternalService  AuthErrorCode = "INTERNALSERVIC"
	CodeAuthentication   AuthErrorCode = "AUTHENTICATION"
)

// AuthError is an authentication failure rendered in the envelope the
// service-auth login form expects, not as a problem document.
type AuthError struct {
	Code     AuthErrorCode
	Status   int
	Message  string
	Username string
}

func (e *AuthError) Error() string { return string(e.Code) + ": " + e.Message }

// NewAuthError builds an auth failure with the conventional status.
func NewAuthError(code AuthErrorCode, message string) *AuthError {
	return &AuthError{Code: code, Status: authStatusFor(code), Message: message}
}

// authStatusFor reproduces AuthErrorHelper#getHttpStatus. The Java method tested
// the exception's type, and its fallthrough was:
//
//	LockedException                     -> 403
//	BadCredentialsException             -> 401
//	UsernameNotFoundException           -> 401
//	any other AuthenticationException   -> 401
//	anything else                       -> 500
//
// DisabledException is an AuthenticationException, so it is 401 — the Java code
// hit the third branch for it, not the last.
func authStatusFor(code AuthErrorCode) int {
	switch code {
	case CodeLocked:
		return http.StatusForbidden
	case CodeBadCredentials, CodeUsernameNotFound, CodeDisabled,
		CodeInternalService, CodeAuthentication:
		return http.StatusUnauthorized
	default:
		return http.StatusInternalServerError
	}
}

// Localized authentication messages, from
// org/springframework/security/messages_ru.properties. The front-end renders
// `message` directly, so the Russian text is part of the contract.
const (
	MessageBadCredentials = "Неверный логин или пароль."
	MessageDisabled       = "Учетная запись отключена."
	MessageLocked         = "Учетная запись заблокирована. Обратитесь к администратору."
	MessageNotFound       = "Пользователь не найден."
	MessageAuthRequired   = "Необходима аутентификация"
)

// WriteAuthError renders the login error envelope.
//
// Field order matches the Java LinkedHashMap, because some clients snapshot the
// raw body in tests.
func WriteAuthError(w http.ResponseWriter, r *http.Request, err *AuthError) {
	locale := localeFromRequest(r)

	// The envelope is an anonymous object, so a fixed key order is guaranteed
	// here by writing the JSON explicitly rather than marshalling a map.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Status)
	_, _ = w.Write([]byte(`{` +
		`"timestamp":` + jsonString(time.Now().Format("2006-01-02T15:04:05.000000")) + `,` +
		`"path":` + jsonString(r.URL.Path) + `,` +
		`"username":` + jsonString(err.Username) + `,` +
		`"locale":` + jsonString(locale) + `,` +
		`"status":` + itoa(err.Status) + `,` +
		`"error":` + jsonString(http.StatusText(err.Status)) + `,` +
		`"code":` + jsonString(string(err.Code)) + `,` +
		`"message":` + jsonString(err.Message) +
		`}`))
}

func jsonString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				continue
			}
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
	return b.String()
}

// localeFromRequest mirrors LocaleHelper: the Accept-Language header's primary
// subtag, else the request locale, else English.
func localeFromRequest(r *http.Request) string {
	accept := r.Header.Get("Accept-Language")
	if accept != "" {
		tag := strings.TrimSpace(strings.Split(accept, ",")[0])
		if idx := strings.IndexAny(tag, ";"); idx >= 0 {
			tag = strings.TrimSpace(tag[:idx])
		}
		if tag != "" && tag != "*" {
			if base, _, _ := strings.Cut(tag, "-"); base != "" {
				return strings.ToLower(base)
			}
			return strings.ToLower(tag)
		}
	}
	return "en"
}
