package security

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-that-is-at-least-32-bytes-long"

func newTestService(t *testing.T, secret string) *Service {
	t.Helper()
	s, err := NewService(Config{
		Secret:           secret,
		Expiration:       time.Hour,
		RefreshExpiraton: 24 * time.Hour,
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return s
}

func TestAlgorithmSelectedBySecretLength(t *testing.T) {
	cases := []struct {
		name   string
		secret string
		want   string
	}{
		// jjwt's DefaultJwtSignatureAlgorithm: 64+ bytes HS512, 48+ HS384,
		// else HS256. Preserved so tokens stay verifiable across a rolling
		// Java-to-Go migration.
		{"32 bytes is HS256", "12345678901234567890123456789012", "HS256"},
		{"48 bytes is HS384", "123456789012345678901234567890123456789012345678", "HS384"},
		{"64 bytes is HS512", "1234567890123456789012345678901234567890123456789012345678901234", "HS512"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := newTestService(t, tc.secret)
			if got := s.AlgorithmName(); got != tc.want {
				t.Fatalf("algorithm = %s, want %s", got, tc.want)
			}
		})
	}
}

func TestNewServiceRejectsShortSecret(t *testing.T) {
	if _, err := NewService(Config{Secret: "tooshort"}); err == nil {
		t.Fatal("expected an error for a secret below the HS256 minimum")
	}
}

func TestAccessTokenRoundTrip(t *testing.T) {
	s := newTestService(t, testSecret)
	want := TokenInput{
		UserID:               "user-1",
		Username:             "alice",
		Roles:                []string{"ROLE_ORG_ADMIN"},
		Permissions:          []string{"USER_READ", "USER_WRITE"},
		AllowedOrganizations: []string{"org-a", "org-b"},
	}
	token, err := s.GenerateToken(want)
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	claims, err := s.ParseAccessToken(token)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if claims.UserID != want.UserID {
		t.Errorf("userId = %q, want %q", claims.UserID, want.UserID)
	}
	if claims.Subject != want.Username {
		t.Errorf("sub = %q, want %q", claims.Subject, want.Username)
	}
	if len(claims.Permissions) != 2 || claims.Permissions[0] != "USER_READ" {
		t.Errorf("permissions = %v, want %v", claims.Permissions, want.Permissions)
	}
}

func TestTokenSignedWithAnotherSecretIsRejected(t *testing.T) {
	minted := newTestService(t, testSecret)
	verifier := newTestService(t, "a-completely-different-secret-of-32-bytes")
	token, err := minted.GenerateToken(TokenInput{UserID: "u", Username: "u"})
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if _, err := verifier.ParseAccessToken(token); err == nil {
		t.Fatal("expected signature verification to fail across differing secrets")
	}
}

func TestExpiredTokenRejected(t *testing.T) {
	s, err := NewService(Config{Secret: testSecret, Expiration: -time.Minute, RefreshExpiraton: time.Hour})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	token, err := s.GenerateToken(TokenInput{UserID: "u", Username: "u"})
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if _, err := s.ParseAccessToken(token); err == nil {
		t.Fatal("expected an expired token to be rejected")
	}
}

func TestRefreshTokenIsDistinctFromAccessToken(t *testing.T) {
	s := newTestService(t, testSecret)
	refresh, err := s.GenerateRefreshToken("user-1", "alice")
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}
	// A refresh token must not pass as an access token, or a stolen refresh
	// token would authenticate API calls for its full seven-day life.
	if _, err := s.ParseAccessToken(refresh); err == nil {
		t.Fatal("refresh token was accepted as an access token")
	}
	if !s.ValidateRefreshToken(refresh) {
		t.Fatal("refresh token failed its own validation")
	}
	id, err := s.RefreshUserID(refresh)
	if err != nil {
		t.Fatalf("RefreshUserID: %v", err)
	}
	if id != "user-1" {
		t.Fatalf("RefreshUserID = %q, want user-1", id)
	}
}

func TestAccessTokenIsNotAValidRefreshToken(t *testing.T) {
	s := newTestService(t, testSecret)
	access, err := s.GenerateToken(TokenInput{UserID: "u", Username: "u"})
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if s.ValidateRefreshToken(access) {
		t.Fatal("access token was accepted as a refresh token")
	}
}

func TestBlacklistRevokesAndSweeps(t *testing.T) {
	s := newTestService(t, testSecret)
	token, err := s.GenerateToken(TokenInput{UserID: "u", Username: "u"})
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if !s.IsTokenValid(token) {
		t.Fatal("fresh token should be valid")
	}
	s.Invalidate(token)
	if s.IsTokenValid(token) {
		t.Fatal("revoked token should be invalid")
	}

	// Nothing is expired yet, so a sweep must not drop the entry.
	if removed := s.SweepBlacklist(); removed != 0 {
		t.Fatalf("sweep removed %d live entries, want 0", removed)
	}
	if !s.blacklist.Contains(token) {
		t.Fatal("entry dropped before its token expired")
	}

	// Manually expiring the entry models the passage of time; the sweep must
	// then reclaim it.
	s.blacklist.Add(token, time.Now().Add(-time.Second))
	if removed := s.SweepBlacklist(); removed != 1 {
		t.Fatalf("sweep removed %d entries, want 1", removed)
	}
	if s.blacklist.Len() != 0 {
		t.Fatalf("blacklist still holds %d entries after sweep", s.blacklist.Len())
	}
}

func TestUnsignedTokenRejected(t *testing.T) {
	s := newTestService(t, testSecret)
	// alg=none is the classic JWT bypass; WithValidMethods must refuse it.
	claims := Claims{UserID: "admin", RegisteredClaims: jwt.RegisteredClaims{Subject: "admin"}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodNone, claims).
		SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("build unsigned token: %v", err)
	}
	if _, err := s.ParseAccessToken(token); err == nil {
		t.Fatal("an alg=none token was accepted")
	}
}

func TestAccessRules(t *testing.T) {
	cases := []struct {
		name             string
		auth             *Auth
		superUser        bool
		allActions       bool
		allOrganizations bool
		orgAllowed       bool
	}{
		{"nil auth denies everything", nil, false, false, false, false},
		{"plain user", &Auth{AllowedOrganizations: []string{"org-a"}},
			false, false, false, true},
		{"superuser", &Auth{Permissions: []string{PermissionSuperUser}},
			true, true, true, true},
		{"any action allow", &Auth{Permissions: []string{PermissionAnyActionAllow}},
			false, true, false, false},
		{"any org allow", &Auth{Permissions: []string{PermissionAnyOrgAllow}},
			false, false, true, true},
		{"user with no orgs", &Auth{}, false, false, false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := securityAccess{tc.auth}
			if got := a.superUser(); got != tc.superUser {
				t.Errorf("isSuperUser = %v, want %v", got, tc.superUser)
			}
			if got := a.allActions(); got != tc.allActions {
				t.Errorf("isAllowedAllActions = %v, want %v", got, tc.allActions)
			}
			if got := a.allOrgs(); got != tc.allOrganizations {
				t.Errorf("isAllowedAllOrganizations = %v, want %v", got, tc.allOrganizations)
			}
			if got := a.orgAllowed("org-a"); got != tc.orgAllowed {
				t.Errorf("isAllowedOrganization(org-a) = %v, want %v", got, tc.orgAllowed)
			}
		})
	}
}

// securityAccess exposes the rule set for the table test above.
type securityAccess struct{ a *Auth }

func (s securityAccess) superUser() bool           { return Default.IsSuperUser(s.a) }
func (s securityAccess) allActions() bool          { return Default.IsAllowedAllActions(s.a) }
func (s securityAccess) allOrgs() bool             { return Default.IsAllowedAllOrganizations(s.a) }
func (s securityAccess) orgAllowed(id string) bool { return Default.IsAllowedOrganization(s.a, id) }

func TestInSomeOrganization(t *testing.T) {
	superuser := &Auth{Permissions: []string{PermissionSuperUser}}
	if !Default.InSomeOrganization(superuser, nil) {
		t.Error("superuser should pass even with no candidate organizations")
	}
	member := &Auth{AllowedOrganizations: []string{"org-a"}}
	if !Default.InSomeOrganization(member, []string{"org-b", "org-a"}) {
		t.Error("a shared organization should pass")
	}
	if Default.InSomeOrganization(member, []string{"org-b"}) {
		t.Error("no shared organization should fail")
	}
	// A user with no organizations must match nothing, otherwise an
	// unassigned account would gain access to every organization.
	if Default.InSomeOrganization(&Auth{}, []string{"org-a"}) {
		t.Error("a user with no organizations must not match any")
	}
}
