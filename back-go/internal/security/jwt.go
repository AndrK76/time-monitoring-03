// Package security ports the JWT and authorisation layer from core-security.
//
// Two details are contracts with the running system rather than implementation
// choices, and are preserved exactly:
//
//   - The signing algorithm is selected from the secret's length, the way jjwt
//     does it, because tokens minted by the Java services must keep verifying
//     here and vice versa during a rolling migration. A 32-byte secret is HS256,
//     48 is HS384, 64 or more is HS512.
//   - The claim set is the one service-admin and the front-end read: sub,
//     userId, roles, permissions, allowedOrganizations, iat, exp.
package security

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Permission names, from SecurityAccessUtils.
const (
	PermissionSuperUser      = "SUPERUSER"
	PermissionAnyOrgAllow    = "ANY_ORG_ALLOW"
	PermissionAnyActionAllow = "ANY_ACTION_ALLOW"
)

// Errors returned by Validate. The callers all collapse them into "not
// authenticated", matching the Java filter, which logged and continued the chain
// rather than rejecting the request itself.
var (
	ErrTokenMalformed   = errors.New("token is malformed")
	ErrTokenSignature   = errors.New("token signature is invalid")
	ErrTokenExpired     = errors.New("token has expired")
	ErrTokenUnsupported = errors.New("token uses an unsupported algorithm")
)

// Claims is the access-token payload. The map-based jwt.RegisteredClaims are
// embedded for sub/iat/exp.
type Claims struct {
	UserID               string   `json:"userId"`
	Roles                []string `json:"roles,omitempty"`
	Permissions          []string `json:"permissions,omitempty"`
	AllowedOrganizations []string `json:"allowedOrganizations,omitempty"`
	// Type is the refresh discriminator. An access token omits it. Parsing an
	// access token must reject a refresh token, otherwise a stolen refresh
	// token authenticates API calls for its full seven-day life with whatever
	// roles it was issued for. The Java code did not check this, because it
	// re-read the user from the database on every request and ignored the token
	// claims; see MIGRATION.md.
	Type string `json:"type,omitempty"`
	jwt.RegisteredClaims
}

// RefreshClaims is the refresh-token payload. It deliberately carries no roles
// or permissions: the Java implementation only used it to recover the user id
// and then re-read the user from the database.
type RefreshClaims struct {
	UserID string `json:"userId"`
	Type   string `json:"type"`
	jwt.RegisteredClaims
}

// RefreshTokenType is the discriminator claim.
const RefreshTokenType = "refresh"

// Config carries the JWT settings from the Java application.yml.
type Config struct {
	Secret           string
	Expiration       time.Duration
	RefreshExpiraton time.Duration
}

// Service mints and verifies tokens and holds the logout blacklist.
type Service struct {
	cfg       Config
	algorithm jwt.SigningMethod
	blacklist *Blacklist
}

// NewService builds a JWT service. It fails when the secret is too short for
// HS256, the same condition under which jjwt raised WeakKeyException.
func NewService(cfg Config) (*Service, error) {
	if strings.TrimSpace(cfg.Secret) == "" {
		return nil, errors.New("jwt secret is not configured")
	}
	if len(cfg.Secret) < 32 {
		return nil, fmt.Errorf("jwt secret must be at least 32 bytes for HS256, got %d", len(cfg.Secret))
	}
	alg := algorithmForSecret(cfg.Secret)
	return &Service{
		cfg:       cfg,
		algorithm: alg,
		blacklist: NewBlacklist(),
	}, nil
}

// algorithmForSecret mirrors jjwt's DefaultJwtSignatureAlgorithm derivation:
// 64+ bytes HS512, 48+ HS384, otherwise HS256.
func algorithmForSecret(secret string) jwt.SigningMethod {
	bits := len(secret) * 8
	switch {
	case bits >= 512:
		return jwt.SigningMethodHS512
	case bits >= 384:
		return jwt.SigningMethodHS384
	default:
		return jwt.SigningMethodHS256
	}
}

// AlgorithmName exposes the negotiated algorithm, for logging and for the
// startup banner so a mismatched JWT_SECRET is obvious in the logs.
func (s *Service) AlgorithmName() string { return s.algorithm.Alg() }

func (s *Service) key() []byte { return []byte(s.cfg.Secret) }

// TokenInput is the identity material encoded into an access token.
type TokenInput struct {
	UserID               string
	Username             string
	Roles                []string
	Permissions          []string
	AllowedOrganizations []string
}

// GenerateToken mints an access token.
//
// The Java builder left the array claims unfiltered, so a permission reachable
// through two roles appears twice in the claim. Authorisation checks are
// membership tests, so duplicates are harmless; they are preserved to keep the
// token bytes equivalent.
func (s *Service) GenerateToken(in TokenInput) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:               in.UserID,
		Roles:                in.Roles,
		Permissions:          in.Permissions,
		AllowedOrganizations: in.AllowedOrganizations,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   in.Username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.Expiration)),
		},
	}
	return jwt.NewWithClaims(s.algorithm, claims).SignedString(s.key())
}

// GenerateRefreshToken mints a refresh token.
func (s *Service) GenerateRefreshToken(userID, username string) (string, error) {
	now := time.Now()
	claims := RefreshClaims{
		UserID: userID,
		Type:   RefreshTokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.RefreshExpiraton)),
		},
	}
	return jwt.NewWithClaims(s.algorithm, claims).SignedString(s.key())
}

// ParseAccessToken verifies the signature and expiry and returns the claims.
//
// A refresh token is rejected even though it is signed with the same key and
// carries a valid expiry: its claim set decodes cleanly into Claims, so only an
// explicit type check separates the two token kinds.
func (s *Service) ParseAccessToken(token string) (*Claims, error) {
	var claims Claims
	_, err := jwt.ParseWithClaims(token, &claims, s.keyFunc(),
		jwt.WithValidMethods([]string{s.algorithm.Alg()}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, classify(err)
	}
	if claims.Type == RefreshTokenType {
		return nil, ErrTokenMalformed
	}
	return &claims, nil
}

// ValidateRefreshToken reports whether a refresh token is well-formed,
// unexpired, and of the refresh type. Mirrors JwtCreateService#validateRefreshToken.
func (s *Service) ValidateRefreshToken(token string) bool {
	var claims RefreshClaims
	_, err := jwt.ParseWithClaims(token, &claims, s.keyFunc(),
		jwt.WithValidMethods([]string{s.algorithm.Alg()}),
	)
	if err != nil {
		return false
	}
	return claims.Type == RefreshTokenType
}

func (s *Service) keyFunc() jwt.Keyfunc {
	return func(*jwt.Token) (any, error) { return s.key(), nil }
}

// RefreshUserID recovers the user id from a refresh token's subject-independent
// userId claim. The Java code read it with a raw claim lookup; here the claims
// are decoded through the same verification path, so an unsigned or tampered
// token cannot supply the id.
func (s *Service) RefreshUserID(token string) (string, error) {
	var claims RefreshClaims
	if _, err := jwt.ParseWithClaims(token, &claims, s.keyFunc(),
		jwt.WithValidMethods([]string{s.algorithm.Alg()}),
	); err != nil {
		return "", err
	}
	if claims.Type != RefreshTokenType || claims.UserID == "" {
		return "", ErrTokenMalformed
	}
	return claims.UserID, nil
}

func classify(err error) error {
	// jwt/v5 joins sentinel errors with %w, so errors.Is covers the whole set
	// including the "token has expired" wrapping that used to be a distinct type.
	switch {
	case errors.Is(err, jwt.ErrTokenExpired):
		return ErrTokenExpired
	case errors.Is(err, jwt.ErrTokenSignatureInvalid), errors.Is(err, jwt.ErrTokenUnverifiable):
		return ErrTokenSignature
	case errors.Is(err, jwt.ErrTokenMalformed), errors.Is(err, jwt.ErrTokenInvalidClaims):
		return ErrTokenMalformed
	}
	return err
}

// IsTokenValid combines the blacklist check with signature and expiry
// verification, matching JwtService#isTokenValid.
func (s *Service) IsTokenValid(token string) bool {
	if token == "" {
		return false
	}
	if s.blacklist.Contains(token) {
		return false
	}
	_, err := s.ParseAccessToken(token)
	return err == nil
}

// Invalidate adds a token to the logout blacklist.
//
// The token's own expiry is recorded alongside it so the entry can be trimmed
// once the token would have been rejected regardless. A token that cannot be
// parsed is still blacklisted, with a fallback expiry of the configured access
// TTL, so an unparseable token can never stay in memory forever.
func (s *Service) Invalidate(token string) {
	if token == "" {
		return
	}
	expiry := time.Now().Add(s.cfg.Expiration)
	if claims, err := s.ParseAccessToken(token); err == nil && claims.ExpiresAt != nil {
		expiry = claims.ExpiresAt.Time
	}
	s.blacklist.Add(token, expiry)
}

// SweepBlacklist removes entries whose tokens have expired and reports how many
// were dropped. Safe to call at any time.
func (s *Service) SweepBlacklist() int {
	return s.blacklist.Sweep(time.Now())
}

// Blacklist is the in-memory logout list.
//
// The Java version kept an unbounded ConcurrentHashMap keyed by the raw token
// in a single JVM's heap. Entries only accumulate and are lost on restart, so a
// revoked token becomes valid again until it expires. Two properties are
// inherited and are called out in MIGRATION.md as limitations of the original
// design rather than of the port: the list is per-process, so a logout on one
// instance does not revoke a token on another, and it is lost on restart, so a
// revoked token is accepted again until it expires.
type Blacklist struct {
	mu      sync.RWMutex
	entries map[string]time.Time
}

func NewBlacklist() *Blacklist {
	return &Blacklist{entries: make(map[string]time.Time)}
}

// Add records a revoked token together with the instant it stops mattering.
func (b *Blacklist) Add(token string, expiry time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.entries[token] = expiry
}

// Sweep drops entries that expired at or before now and returns the count
// removed. An expired token is already rejected by signature verification, so
// dropping its entry cannot make a revoked credential usable.
func (b *Blacklist) Sweep(now time.Time) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	removed := 0
	for token, expiry := range b.entries {
		if !expiry.After(now) {
			delete(b.entries, token)
			removed++
		}
	}
	return removed
}

func (b *Blacklist) Contains(token string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	_, ok := b.entries[token]
	return ok
}

// Len reports the current size, for the startup banner and tests.
func (b *Blacklist) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.entries)
}
