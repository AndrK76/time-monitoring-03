package httpx

import (
	"net/http"
	"slices"
	"strings"
	"time"
)

// CORS mirrors the spring.web.cors block in each Java application.yml:
//
//	allowed-origins: an explicit list, never a wildcard
//	allowed-methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
//	allowed-headers: Authorization,Content-Type,X-Requested-With,Accept,Origin,
//	                 Access-Control-Request-Method,Access-Control-Request-Headers
//	exposed-headers: Authorization,Set-Cookie
//	allow-credentials: true
//	max-age: 3600
//
// The explicit origin list is load-bearing: credentials are allowed, so a "*"
// origin would be rejected by the browser anyway.
type CORS struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           time.Duration
}

// DefaultCORS returns the origin list shared by all three services, taken
// verbatim from the Java configuration.
func DefaultCORS() CORS {
	return CORS{
		AllowedOrigins: []string{
			"http://localhost:4301",
			"http://localhost:4302",
			"http://crm.host:4301",
			"http://admin.crm.host:4302",
			"http://crm.host:8701",
			"http://admin.crm.host:8702",
			"http://crm.host:8888",
			"http://admin.crm.host:8888",
			"http://crm.host:8881",
			"http://admin.crm.host:8882",
			"http://crm.host:4311",
			"http://crm.host:4312",
		},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions, http.MethodPatch},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"},
		ExposedHeaders:   []string{"Authorization", "Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           time.Hour,
	}
}

// Middleware applies the CORS policy, answering preflights itself.
func (c CORS) Middleware(next http.Handler) http.Handler {
	allowedHeaders := strings.Join(c.AllowedHeaders, ",")
	exposedHeaders := strings.Join(c.ExposedHeaders, ",")
	allowedMethods := strings.Join(c.AllowedMethods, ",")
	maxAge := int(c.MaxAge.Seconds())

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(c.AllowedOrigins, origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			// Vary is required so a shared cache does not serve one origin's
			// response to another.
			h.Add("Vary", "Origin")
			if c.AllowCredentials {
				h.Set("Access-Control-Allow-Credentials", "true")
			}
			if exposedHeaders != "" {
				h.Set("Access-Control-Expose-Headers", exposedHeaders)
			}
		}

		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			h := w.Header()
			h.Add("Vary", "Access-Control-Request-Method")
			h.Add("Vary", "Access-Control-Request-Headers")
			h.Set("Access-Control-Allow-Methods", allowedMethods)
			h.Set("Access-Control-Allow-Headers", allowedHeaders)
			h.Set("Access-Control-Max-Age", itoa(maxAge))
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
