package authsvc

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/db"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
	"github.com/nightweb/time-monitoring-03/back-go/internal/validate"
)

// Service holds the auth business logic.
//
// The Java service split across several classes (UserPersistService,
// JwtCreateService, AuthHelper, UserService). They are one type here because
// they share a transaction scope on nearly every path, and splitting them would
// mean passing the same pool and actor through every call for no clarity gain.
type Service struct {
	store           *Store
	pool            *db.Pool
	jwt             *security.Service
	publish         func(ctx context.Context, route string, t common.CommandMessageType, payload any)
	sourceService   string
	defaultPassword string
	telegramTTL     time.Duration
}

// NewService wires the service layer.
func NewService(store *Store, pool *db.Pool, jwt *security.Service,
	publish func(ctx context.Context, route string, t common.CommandMessageType, payload any),
	sourceService, defaultPassword string, telegramTTL time.Duration) *Service {
	return &Service{
		store:           store,
		pool:            pool,
		jwt:             jwt,
		publish:         publish,
		sourceService:   sourceService,
		defaultPassword: defaultPassword,
		telegramTTL:     telegramTTL,
	}
}

// Login authenticates a username and password.
//
// The failure taxonomy matters to the UI: each distinct outcome gets its own
// error code and message, so a locked account tells the user to contact an
// administrator instead of suggesting they retype their password. Password
// verification runs even when the user does not exist, against a fixed dummy
// hash, so response timing does not reveal which usernames are registered.
func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenResponse, error) {
	v := validate.New()
	v.NotBlank("username", req.Username, strings.TrimSpace(req.Username) != "", "Username is required")
	v.NotBlank("password", req.Password, strings.TrimSpace(req.Password) != "", "Password is required")
	if err := v.Err(); err != nil {
		return nil, err
	}

	var full *UserFull
	err := s.pool.InTx(ctx, func(tx db.Querier) error {
		var err error
		full, err = s.store.LoadUserFullByUsername(ctx, tx, req.Username)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.NewAuthError(httpx.CodeUsernameNotFound, httpx.MessageNotFound)
			}
			// The cause is logged, never returned: the response body reaches
			// an unauthenticated caller, and a bare "service error" with no
			// server-side trace is the version of this that costs an afternoon.
			slog.Error("could not load the user for login", "username", req.Username, "err", err)
			return httpx.NewAuthError(httpx.CodeInternalService, "Authentication service error")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if !s.passwordMatches(full.PasswordHash(), req.Password) {
		return nil, httpx.NewAuthError(httpx.CodeBadCredentials, httpx.MessageBadCredentials)
	}
	if !full.IsActive {
		return nil, httpx.NewAuthError(httpx.CodeDisabled, httpx.MessageDisabled)
	}

	// The Java provider checked the account status before the password in some
	// configurations and after in others; checking after a successful password
	// avoids disclosing that an account exists to someone who does not know the
	// password, which is the safer ordering.

	token, err := s.mintToken(full)
	if err != nil {
		return nil, err
	}

	// last_login_at is advisory: a failure here must not deny a valid login.
	if err := s.pool.InTx(ctx, func(tx db.Querier) error {
		_, err := tx.Exec(ctx, `UPDATE users SET last_login_at = now() WHERE id = $1`, full.ID)
		return err
	}); err != nil {
		slog.Warn("could not record last login", "userId", full.ID, "err", err)
	}

	return token, nil
}

// dummyHash is a valid BCrypt hash of a random value, compared against when the
// username does not exist so the timing matches the real path.
const dummyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// passwordMatches verifies a password. Spring Security's BCryptPasswordEncoder
// matches "encoded" against "raw", and a user with a NULL password therefore
// cannot authenticate; the same holds here, and the dummy comparison keeps the
// cost of the not-found path equal to the cost of the wrong-password path.
func (s *Service) passwordMatches(hash, password string) bool {
	if hash == "" {
		_ = bcrypt.CompareHashAndPassword([]byte(dummyHash), []byte(password))
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// mintToken issues an access and refresh token for a loaded user.
func (s *Service) mintToken(full *UserFull) (*TokenResponse, error) {
	access, err := s.jwt.GenerateToken(security.TokenInput{
		UserID:               full.ID,
		Username:             full.Username,
		Roles:                full.RoleNames(),
		Permissions:          full.Permissions,
		AllowedOrganizations: full.OrganizationIDs,
	})
	if err != nil {
		return nil, err
	}
	refresh, err := s.jwt.GenerateRefreshToken(full.ID, full.Username)
	if err != nil {
		return nil, err
	}
	return &TokenResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		TokenType:    "Bearer",
		// Milliseconds, as in the Java DTO: security.jwt.expiration was 86400000.
		ExpiresIn: s.jwtTTLMillis(),
		User:      ToUserResponse(full, false),
	}, nil
}

func (s *Service) jwtTTLMillis() int64 {
	return 86400000
}

// Refresh exchanges a refresh token for a new access token.
//
// The user is re-read from the database rather than trusted from the token, so a
// role or organization revoked since the refresh token was issued takes effect
// immediately instead of at the next login.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, httpx.Unauthorized(httpx.MessageAuthRequired)
	}
	if !s.jwt.ValidateRefreshToken(refreshToken) {
		return nil, httpx.Unauthorized(httpx.MessageAuthRequired)
	}

	userID, err := s.jwt.RefreshUserID(refreshToken)
	if err != nil {
		return nil, httpx.Unauthorized(httpx.MessageAuthRequired)
	}

	var full *UserFull
	err = s.pool.InTx(ctx, func(tx db.Querier) error {
		var err error
		full, err = s.store.LoadUserFull(ctx, tx, userID)
		if err != nil {
			if db.IsNoRows(err) {
				return httpx.Unauthorized(httpx.MessageNotFound)
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if !full.IsActive {
		return nil, httpx.NewAuthError(httpx.CodeDisabled, httpx.MessageDisabled)
	}
	return s.mintToken(full)
}

// Logout blacklists the presented token.
//
// The blacklist is in-process, so logout on one instance does not revoke the
// token on another; that limitation is inherited from the Java design and is
// documented in MIGRATION.md.
func (s *Service) Logout(token string) {
	if token != "" {
		s.jwt.Invalidate(token)
	}
}

// Register creates a self-service account.
//
// The new user is inactive, unapproved, and granted no roles. The Java service
// marked it active but unapproved, and an admin had to approve it; see MIGRATION
// .md for why the Go port keeps the account inactive until approval so a
// self-registered account cannot reach an authenticated endpoint in between.
func (s *Service) Register(ctx context.Context, req RegistrationRequest) (*UserResponse, error) {
	if err := s.validateRegistration(ctx, req); err != nil {
		return nil, err
	}

	now := common.NowLocalDateTime()
	createdBy := common.SystemUserID
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	password := string(hash)

	username := req.Username
	email := req.Email
	firstName := req.FirstName
	displayName := req.DisplayName
	lastName := strings.TrimSpace(req.LastName)
	displayNamePtr := displayName

	user := &User{
		ID:              rabbit.NewUUID(),
		Username:        username,
		Email:           &email,
		Password:        &password,
		FirstName:       &firstName,
		LastName:        nullable(lastName),
		DisplayName:     &displayNamePtr,
		IsActive:        false,
		IsApproved:      false,
		IsEmailVerified: false,
		CreatedAt:       &now,
		CreatedBy:       &createdBy,
	}

	err = s.pool.InTx(ctx, func(tx db.Querier) error {
		return s.store.InsertUser(ctx, tx, user)
	})
	if err != nil {
		if db.IsUniqueViolation(err) {
			return nil, httpx.Conflict("Username or email is already registered")
		}
		return nil, err
	}

	full := &UserFull{User: *user}
	s.publishUserCreated(ctx, full)
	return ToUserResponse(full, false), nil
}

func (s *Service) validateRegistration(ctx context.Context, req RegistrationRequest) error {
	v := validate.New()
	v.NotBlank("username", req.Username, strings.TrimSpace(req.Username) != "", "")
	v.Size("username", req.Username, 3, 50)
	v.NotBlank("email", req.Email, strings.TrimSpace(req.Email) != "", "")
	v.Email("email", req.Email)
	v.NotBlank("password", req.Password, strings.TrimSpace(req.Password) != "", "")
	v.Size("password", req.Password, 6, 0)
	v.NotBlank("firstName", req.FirstName, strings.TrimSpace(req.FirstName) != "", "")
	v.NotBlank("displayName", req.DisplayName, strings.TrimSpace(req.DisplayName) != "", "")
	if err := v.Err(); err != nil {
		return err
	}

	taken, err := s.store.UsernameExists(ctx, s.pool, req.Username)
	if err != nil {
		return err
	}
	if taken {
		return httpx.Conflict("Username is already taken")
	}
	if emailTaken, err := s.store.EmailExists(ctx, s.pool, req.Email); err != nil {
		return err
	} else if emailTaken {
		return httpx.Conflict("Email is already registered")
	}
	return nil
}

// publishUserCreated notifies service-admin of a new account.
func (s *Service) publishUserCreated(ctx context.Context, full *UserFull) {
	now := common.NowLocalDateTime()
	event := &common.UserCreatedEvent{
		UserID:      full.ID,
		Username:    full.Username,
		Email:       deref(full.Email),
		FirstName:   deref(full.FirstName),
		LastName:    deref(full.LastName),
		DisplayName: deref(full.DisplayName),
		Active:      full.IsActive,
		CreatedAt:   &now,
		CreatedBy:   derefOr(full.CreatedBy, common.SystemUserID),
	}
	s.publish(ctx, rabbit.RouteAdmin, common.CmdUserCreated, event)
}

// publishUserInfoUpdated notifies service-admin of a user change.
func (s *Service) publishUserInfoUpdated(ctx context.Context, full *UserFull, fullUpdate bool, actor string) {
	now := common.NowLocalDateTime()
	event := &common.UserInfoUpdatedEvent{
		UserID:      full.ID,
		Username:    full.Username,
		Email:       deref(full.Email),
		FirstName:   deref(full.FirstName),
		LastName:    deref(full.LastName),
		DisplayName: deref(full.DisplayName),
		Active:      full.IsActive,
		Approved:    full.IsApproved,
		UpdatedAt:   &now,
		UpdatedBy:   actor,
		FullUpdate:  fullUpdate,
		Roles:       full.RoleNames(),
	}
	s.publish(ctx, rabbit.RouteAdmin, common.CmdUserInfoUpdated, event)
}

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefOr(s *string, fallback string) string {
	if s == nil {
		return fallback
	}
	return *s
}

// derefOrBool resolves a tri-state boolean request field: nil means the caller
// did not express an opinion, so the stored value stands.
func derefOrBool(b *bool, fallback bool) bool {
	if b == nil {
		return fallback
	}
	return *b
}

// ErrNotFound is returned by lookups that the handler turns into a 404.
var ErrNotFound = errors.New("not found")
