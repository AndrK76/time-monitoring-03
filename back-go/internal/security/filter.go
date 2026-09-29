package security

import (
	"log/slog"
	"net/http"
	"time"
)

// CookieName is the SSO cookie the front-end sends with withCredentials, the
// replacement for carrying a bearer token across subdomains.
const CookieName = "auth_token"

// CookieConfig mirrors the cookie block in service-auth's application.yml.
type CookieConfig struct {
	// Domain is the shared parent domain. Empty means the cookie is host-only.
	Domain string
	// Secure marks the cookie HTTPS-only. The Java default was false.
	Secure bool
	// ReadCookie enables the cookie fallback in ExtractToken.
	ReadCookie bool
}

// CookieService writes and clears the SSO cookie.
type CookieService struct {
	cfg CookieConfig
}

func NewCookieService(cfg CookieConfig) *CookieService { return &CookieService{cfg: cfg} }

// AddAuthCookie sets auth_token for the access token's lifetime.
//
// The attributes mirror what the Java code produced: path "/", HttpOnly true,
// Max-Age derived from the token TTL, and no SameSite attribute, which leaves
// the browser on its Lax default. That default is what makes the cross-subdomain
// SSO work on a top-level navigation while still blocking cross-site subrequests.
func (c *CookieService) AddAuthCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Domain:   c.cfg.Domain,
		Secure:   c.cfg.Secure,
		HttpOnly: true,
		MaxAge:   int(ttl.Seconds()),
	})
}

// RemoveAuthCookie clears auth_token by re-sending the same name, path, domain
// and flags with Max-Age 0, which is the only way a browser will drop a cookie
// whose attributes must match.
func (c *CookieService) RemoveAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		Domain:   c.cfg.Domain,
		Secure:   c.cfg.Secure,
		HttpOnly: true,
		MaxAge:   0,
		Expires:  time.Unix(0, 0),
	})
}

// Middleware is the standard decorator shape, so the filter composes with the
// CORS and not-found wrappers in httpx.Chain.
type Middleware func(http.Handler) http.Handler

// FilterOptions configures the authentication filter.
type FilterOptions struct {
	// ReadCookie enables the cookie fallback. service-auth sets it; the other
	// two services read the Authorization header only, as their Java
	// CookieServiceBase did.
	ReadCookie bool
	// OnUnauthenticated runs when a request carries no usable token. Leaving it
	// nil means the request continues unauthenticated and the route's own
	// authorisation decides the outcome, which is how Spring's filter chain
	// behaved: the filter never rejected, the entry point did.
	OnUnauthenticated func(http.ResponseWriter, *http.Request)
}

// Filter builds the JWT authentication middleware, the port of
// JwtAuthenticationFilter.
//
// A missing or invalid token is not an error here: the Java filter logged and
// passed the request through so that permitAll routes still worked. Routes that
// require authorisation check the context themselves.
func (s *Service) Filter(opts FilterOptions) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := ExtractToken(r, opts.ReadCookie)
			if token == "" {
				if opts.OnUnauthenticated != nil {
					opts.OnUnauthenticated(w, r)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			auth, err := s.authenticate(token)
			if err != nil {
				slog.Debug("token rejected, continuing unauthenticated",
					"path", r.URL.Path, "err", err)
				if opts.OnUnauthenticated != nil {
					opts.OnUnauthenticated(w, r)
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r.WithContext(WithAuth(r.Context(), auth)))
		})
	}
}

// authenticate verifies a token and materialises the request context.
func (s *Service) authenticate(token string) (*Auth, error) {
	if s.blacklist.Contains(token) {
		return nil, ErrTokenMalformed
	}
	claims, err := s.ParseAccessToken(token)
	if err != nil {
		return nil, err
	}
	return &Auth{
		UserID:               claims.UserID,
		Username:             claims.Subject,
		Token:                token,
		Roles:                nonNil(claims.Roles),
		Permissions:          nonNil(claims.Permissions),
		AllowedOrganizations: nonNil(claims.AllowedOrganizations),
	}, nil
}

// nonNil keeps the accessors total: the Java getters returned List.of() rather
// than null for a missing claim.
func nonNil(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}
