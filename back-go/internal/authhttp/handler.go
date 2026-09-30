// Package authhttp holds the service-auth HTTP surface: the login/registration
// endpoints, the current-user endpoints, the user/role/permission/organization
// management endpoints, and the Telegram token store.
//
// The route table below is the contract with the Angular front-end
// (front/projects/shared-auth and app-admin) and is reproduced exactly. Three
// departures from the Java controller are deliberate and listed in
// MIGRATION.md:
//
//   - POST /api/v1/admin/update-password, an unauthenticated password reset,
//     is not exposed. See adminHandler.UpdatePassword below.
//   - The OAuth2 endpoints, which in Java always threw
//     UnsupportedOperationException, are not exposed either.
//   - GET /users/{id}/telegram-token is exposed read-only; the Java
//     implementation had a service class with no controller method reaching it.
package authhttp

import (
	"net/http"
	"strings"
	"time"

	"github.com/nightweb/time-monitoring-03/back-go/internal/app"
	"github.com/nightweb/time-monitoring-03/back-go/internal/authsvc"
	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/rabbit"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// Register wires every service-auth route onto the application's mux.
func Register(a *app.App, svc *authsvc.Service) {
	mux := a.Mux
	const base = "/api/v1"

	auth := httpx.NewRoute(mux, base+"/auth")
	users := httpx.NewRoute(mux, base+"/users")
	roles := httpx.NewRoute(mux, base+"/roles")
	perms := httpx.NewRoute(mux, base+"/permissions")
	orgs := httpx.NewRoute(mux, base+"/organizations")
	admin := httpx.NewRoute(mux, base+"/admin")

	h := &handler{app: a, svc: svc}

	// --- authentication ------------------------------------------------
	auth.RawPost("/login", h.login)
	auth.RawPost("/register", h.register)
	auth.RawPost("/refresh", h.refresh)
	auth.RawPost("/logout", h.logout)
	auth.RawGet("/check", h.check)
	auth.RawGet("/me", h.me)
	auth.RawGet("/anonymous", h.anonymous)

	// --- current user --------------------------------------------------
	users.RawPut("/me", h.updateSelf)
	users.RawPost("/me/change-password", h.changePassword)
	users.RawGet("/me/telegram-token", h.ownTelegramToken)
	users.RawPost("/me/telegram-token", h.createOwnTelegramToken)
	users.RawDelete("/me/telegram-token", h.deleteOwnTelegramToken)

	// --- user management -----------------------------------------------
	users.RawGet("", h.listUsers)
	users.RawPost("", h.createUser)
	users.RawGet("/{id}", h.getUser)
	users.RawPut("/{id}", h.updateUser)
	users.RawDelete("/{id}", h.deleteUser)
	users.RawPut("/{id}/reset-password", h.resetPassword)
	users.RawPut("/{id}/roles", h.setUserRoles)
	users.RawGet("/{id}/telegram-token", h.userTelegramToken)

	// --- roles and permissions ------------------------------------------
	roles.RawGet("", h.listRoles)
	roles.RawPost("", h.createRole)
	roles.RawGet("/with-permissions", h.listRolesWithPermissions)
	roles.RawGet("/{id}", h.getRole)
	roles.RawPut("/{id}", h.updateRole)
	roles.RawDelete("/{id}", h.deleteRole)

	perms.RawGet("", h.listPermissions)

	// --- organizations ---------------------------------------------------
	orgs.RawGet("", h.listOrganizations)
	orgs.RawGet("/{id}", h.getOrganization)
	orgs.RawPut("/{id}/users", h.setOrganizationMembers)

	// --- admin ------------------------------------------------------------
	// POST /admin/update-password is intentionally absent. In the Java service
	// it accepted an unauthenticated username plus a new password and wrote it,
	// which is an account-takeover primitive on any host reachable from the
	// network. If a password reset is genuinely needed, add an authenticated
	// endpoint that requires SUPERUSER and sends a one-time link. See
	// MIGRATION.md, "Removed endpoints".
	_ = admin
}

type handler struct {
	app *app.App
	svc *authsvc.Service
}

// requireAuth resolves the request's security context or writes a 401.
func (h *handler) requireAuth(w http.ResponseWriter, r *http.Request) (*security.Auth, bool) {
	a := security.FromContext(r.Context())
	if a == nil {
		httpx.WriteProblem(w, r, httpx.Unauthorized(httpx.MessageAuthRequired))
		return nil, false
	}
	return a, true
}

// decodeAuthError renders a login-shaped error rather than a problem document,
// for the endpoints the Java service handled with AuthErrorHelper.
func decodeAuthError(w http.ResponseWriter, r *http.Request, err error) bool {
	if authErr, ok := err.(*httpx.AuthError); ok {
		if u := r.FormValue("username"); u != "" {
			authErr.Username = u
		}
		httpx.WriteAuthError(w, r, authErr)
		return true
	}
	return false
}

func (h *handler) login(w http.ResponseWriter, r *http.Request) {
	var req authsvc.LoginRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	resp, err := h.svc.Login(r.Context(), req)
	if err != nil {
		if decodeAuthError(w, r, err) {
			return
		}
		httpx.WriteProblem(w, r, err)
		return
	}
	// The SSO cookie is what lets the admin and monitor front-ends share a
	// session with the auth app across subdomains, so it is set on login in
	// addition to returning the token in the body.
	h.app.Cookies.AddAuthCookie(w, resp.AccessToken, h.jwtAccessTTL())
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) register(w http.ResponseWriter, r *http.Request) {
	var req authsvc.RegistrationRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	resp, err := h.svc.Register(r.Context(), req)
	if err != nil {
		if decodeAuthError(w, r, err) {
			return
		}
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, resp)
}

func (h *handler) refresh(w http.ResponseWriter, r *http.Request) {
	// The refresh token arrives either in the body or in the cookie, because the
	// browser client only ever had the cookie.
	token := refreshTokenFrom(r)
	resp, err := h.svc.Refresh(r.Context(), token)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	h.app.Cookies.AddAuthCookie(w, resp.AccessToken, h.jwtAccessTTL())
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func refreshTokenFrom(r *http.Request) string {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if r.Body != nil {
		// A malformed body is not fatal here: the cookie may still carry the
		// token, and the service layer rejects an empty one with a 401.
		_ = httpx.DecodeJSON(discardWriter{}, r, &body)
	}
	if strings.TrimSpace(body.RefreshToken) != "" {
		return body.RefreshToken
	}
	if cookie, err := r.Cookie(security.CookieName + "_refresh"); err == nil {
		return cookie.Value
	}
	return ""
}

func (h *handler) logout(w http.ResponseWriter, r *http.Request) {
	// The cookie and the bearer token are both revoked, so a client that holds
	// either one is logged out.
	if a := security.FromContext(r.Context()); a != nil {
		h.svc.Logout(a.Token)
	}
	h.app.Cookies.RemoveAuthCookie(w)
	httpx.WriteNoContent(w)
}

func (h *handler) check(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	if err := h.svc.CheckToken(r.Context(), a); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"valid": true})
}

func (h *handler) me(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.CurrentUser(r.Context(), a)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) anonymous(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.Anonymous(security.FromContext(r.Context()))
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) updateSelf(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.UpdateUserRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	resp, err := h.svc.UpdateSelf(r.Context(), a, req)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) changePassword(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.ChangePasswordRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	if err := h.svc.ChangePassword(r.Context(), a, req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.ResetPasswordRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	if err := h.svc.ResetPassword(r.Context(), a, httpx.PathVar(r, "id"), req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *handler) listUsers(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	items, err := h.svc.ListUsers(r.Context(), a)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *handler) getUser(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	resp, err := h.svc.GetUser(r.Context(), a, httpx.PathVar(r, "id"))
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) createUser(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.UpdateUserRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	resp, err := h.svc.CreateUser(r.Context(), a, req)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, resp)
}

func (h *handler) updateUser(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.UpdateUserRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	resp, err := h.svc.UpdateUser(r.Context(), a, httpx.PathVar(r, "id"), req)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *handler) deleteUser(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteUser(r.Context(), a, httpx.PathVar(r, "id")); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *handler) setUserRoles(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req struct {
		Roles []string `json:"roles"`
	}
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	names, err := h.svc.SetUserRoles(r.Context(), a, httpx.PathVar(r, "id"), req.Roles)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, names)
}

func (h *handler) listRoles(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAuth(w, r); !ok {
		return
	}
	items, err := h.svc.ListRoles(r.Context())
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *handler) listRolesWithPermissions(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAuth(w, r); !ok {
		return
	}
	items, err := h.svc.ListRolesWithPermissions(r.Context())
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *handler) getRole(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAuth(w, r); !ok {
		return
	}
	item, err := h.svc.GetRole(r.Context(), httpx.PathVar(r, "id"))
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, item)
}

func (h *handler) createRole(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.UpdateRoleRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	item, err := h.svc.CreateRole(r.Context(), a, req)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, item)
}

func (h *handler) updateRole(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req authsvc.UpdateRoleRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	item, err := h.svc.UpdateRole(r.Context(), a, httpx.PathVar(r, "id"), req)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, item)
}

func (h *handler) deleteRole(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteRole(r.Context(), a, httpx.PathVar(r, "id")); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *handler) listPermissions(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAuth(w, r); !ok {
		return
	}
	items, err := h.svc.ListPermissions(r.Context())
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *handler) listOrganizations(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	items, err := h.svc.ListOrganizations(r.Context(), a)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *handler) getOrganization(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	item, err := h.svc.GetOrganization(r.Context(), a, httpx.PathVar(r, "id"))
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, item)
}

func (h *handler) setOrganizationMembers(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req struct {
		UserIDs []string `json:"userIds"`
	}
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	members, err := h.svc.UpdateOrganizationMembership(r.Context(), a, httpx.PathVar(r, "id"), req.UserIDs)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, members)
}

// --- Telegram magic-link tokens ------------------------------------------------

func (h *handler) ownTelegramToken(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	token, err := h.svc.ActiveTelegramToken(r.Context(), a.UserID)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, token)
}

func (h *handler) createOwnTelegramToken(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	var req struct {
		TargetURL string `json:"targetUrl"`
	}
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	token, err := h.svc.CreateTelegramToken(r.Context(), a.UserID, req.TargetURL)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, token)
}

func (h *handler) deleteOwnTelegramToken(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteTelegramTokens(r.Context(), a.UserID); err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

// userTelegramToken serves GET /users/{id}/telegram-token.
//
// The link is only returned to the token's owner. For anyone else the response
// says whether a live token exists, with the secret stripped, because a magic
// link is a bearer credential and a superuser listing tokens would otherwise be
// a way to impersonate any account.
func (h *handler) userTelegramToken(w http.ResponseWriter, r *http.Request) {
	a, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	target := httpx.PathVar(r, "id")
	token, err := h.svc.ActiveTelegramToken(r.Context(), target)
	if err != nil {
		httpx.WriteProblem(w, r, err)
		return
	}
	if target != a.UserID {
		token.Link = ""
	}
	httpx.WriteJSON(w, http.StatusOK, token)
}

// --- helpers ---------------------------------------------------------------------

// jwtAccessTTL is the cookie lifetime, taken from the JWT access-token TTL so
// the two cannot drift.
func (h *handler) jwtAccessTTL() time.Duration {
	return h.app.JWTAccessTTL()
}

// discardWriter swallows the body while refreshTokenFrom probes for a JSON
// payload, so a subsequent read of the body is not disturbed. The Java service
// took the refresh token from a request parameter instead, so this decode is the
// only body read on that route and r.Body is not needed afterwards.
type discardWriter struct{}

func (discardWriter) Header() http.Header         { return http.Header{} }
func (discardWriter) Write(p []byte) (int, error) { return len(p), nil }
func (discardWriter) WriteHeader(int)             {}

var _ = common.AnonymousUserID
var _ = rabbit.RouteAuth
