package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestProblemDocumentShape pins the RFC 9457 body the front-end parses. The
// Java handler set status, detail, timestamp and optionally path; the Go
// document uses instance for the path, which is the RFC field for the same
// thing, and keeps a timestamp because clients read it.
func TestProblemDocumentShape(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/x", nil)

	WriteProblem(rec, req, Forbidden("User not available: x"))

	if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Errorf("Content-Type = %q, want application/problem+json", ct)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
	var p Problem
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	if p.Status != http.StatusForbidden {
		t.Errorf("problem.status = %d, want 403", p.Status)
	}
	if p.Detail != "User not available: x" {
		t.Errorf("problem.detail = %q", p.Detail)
	}
	if p.Title != http.StatusText(http.StatusForbidden) {
		t.Errorf("problem.title = %q", p.Title)
	}
	if p.Timestamp == "" {
		t.Error("problem.timestamp is empty")
	}
	if p.Instance != "/api/v1/users/x" {
		t.Errorf("problem.instance = %q, want the request path", p.Instance)
	}
}

// TestValidationErrorBecomes400 checks that a constraint violation surfaces as a
// 400 with the messages joined, matching the Java field-error rendering.
func TestValidationErrorBecomes400(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)

	WriteProblem(rec, req, &ValidationError{Messages: []string{"username: must not be blank", "password: size must be between 6 and 0"}})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "must not be blank") {
		t.Errorf("body lost the validation messages: %s", rec.Body.String())
	}
}

// TestUnknownErrorBecomes500 checks the catch-all, which is what the Java
// handler did with a bare Exception.
func TestUnknownErrorBecomes500(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)

	WriteProblem(rec, req, errString("NullPointerException"))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

type errString string

func (e errString) Error() string { return string(e) }

// TestAuthErrorStatusMapping pins the login error taxonomy: a locked account is
// 403 and everything else is 401, because the UI treats 403 as "ask an admin"
// and 401 as "retry the credentials".
func TestAuthErrorStatusMapping(t *testing.T) {
	cases := []struct {
		code AuthErrorCode
		want int
	}{
		{CodeLocked, http.StatusForbidden},
		{CodeBadCredentials, http.StatusUnauthorized},
		{CodeUsernameNotFound, http.StatusUnauthorized},
		{CodeDisabled, http.StatusUnauthorized},
		{CodeInternalService, http.StatusUnauthorized},
	}
	for _, tc := range cases {
		err := NewAuthError(tc.code, "message")
		if err.Status != tc.want {
			t.Errorf("%s: status = %d, want %d", tc.code, err.Status, tc.want)
		}
	}
}

// TestAuthErrorEnvelopeShape pins the login error body, field by field, since the
// login form reads code and message directly.
func TestAuthErrorEnvelopeShape(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9")

	WriteAuthError(rec, req, NewAuthError(CodeBadCredentials, MessageBadCredentials))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	for _, key := range []string{"timestamp", "path", "username", "locale", "status", "error", "code", "message"} {
		if _, ok := body[key]; !ok {
			t.Errorf("envelope is missing %q", key)
		}
	}
	if body["code"] != string(CodeBadCredentials) {
		t.Errorf("code = %v", body["code"])
	}
	if body["message"] != MessageBadCredentials {
		t.Errorf("message = %v", body["message"])
	}
	if body["locale"] != "ru" {
		t.Errorf("locale = %v, want the Accept-Language primary subtag", body["locale"])
	}
	if body["path"] != "/api/v1/auth/login" {
		t.Errorf("path = %v", body["path"])
	}
}

func TestLocaleFallsBackToEnglish(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	if got := localeFromRequest(req); got != "en" {
		t.Errorf("locale = %q, want en", got)
	}
	req.Header.Set("Accept-Language", "*")
	if got := localeFromRequest(req); got != "en" {
		t.Errorf("locale for a wildcard = %q, want en", got)
	}
}

// TestCORSPreflight pins the preflight answer, including that the allowed origin
// echoes the request origin rather than a wildcard: credentials are enabled, so a
// wildcard would be rejected by the browser anyway.
func TestCORSPreflight(t *testing.T) {
	cors := DefaultCORS()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", "http://crm.host:4301")
	req.Header.Set("Access-Control-Request-Method", "POST")

	cors.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("preflight reached the handler instead of being answered")
	})).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://crm.host:4301" {
		t.Errorf("allow-origin = %q, want the request origin echoed", got)
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("allow-credentials must be true for cookie auth to work")
	}
	if rec.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Error("allow-methods is empty")
	}
	if got := rec.Header().Get("Vary"); !strings.Contains(got, "Origin") {
		t.Errorf("Vary = %q, want it to include Origin so a cache does not cross origins", got)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	cors := DefaultCORS()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Origin", "https://evil.example")

	cors.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("allow-origin = %q, want empty for an unlisted origin", got)
	}
}

func TestCORSAllowsSimpleRequestFromListedOrigin(t *testing.T) {
	cors := DefaultCORS()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Origin", "http://localhost:4301")

	cors.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:4301" {
		t.Errorf("allow-origin = %q", got)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("the request did not reach the handler: status = %d", rec.Code)
	}
}

// TestDecodeJSONRejectsMalformedBody checks that a syntax error becomes a 400
// with a stable message rather than escaping to a 500.
func TestDecodeJSONRejectsMalformedBody(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader("{not json"))
	var target struct{}

	err := DecodeJSON(rec, req, &target)
	if err == nil {
		t.Fatal("expected an error for a malformed body")
	}
	apiErr := AsAPIError(err)
	if apiErr.Status != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", apiErr.Status)
	}
}

func TestDecodeJSONRejectsWrongFieldType(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(`{"username": 42}`))
	var target struct {
		Username string `json:"username"`
	}

	err := DecodeJSON(rec, req, &target)
	if err == nil {
		t.Fatal("expected an error for a wrong field type")
	}
	if AsAPIError(err).Status != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", AsAPIError(err).Status)
	}
}

// TestRoutePathVariables checks the Go 1.22 pattern capture, the replacement for
// Spring's @PathVariable.
func TestRoutePathVariables(t *testing.T) {
	mux := http.NewServeMux()
	rt := NewRoute(mux, "/api/v1/users/")
	rt.Get("{id}", func(w http.ResponseWriter, r *http.Request) error {
		WriteJSON(w, http.StatusOK, map[string]string{"id": PathVar(r, "id")})
		return nil
	})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/users/abc-123", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["id"] != "abc-123" {
		t.Errorf("id = %q, want abc-123", body["id"])
	}
}

// TestQueryHasIgnoresValue pins the difference from Query(). The Java routes used
// a params condition, so ?with_unbounded=false selected the same handler as a
// bare flag; only presence matters.
func TestQueryHasIgnoresValue(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/x?with_unbounded=false", nil)
	if !QueryHas(req, "with_unbounded") {
		t.Error("a present parameter with a false value should still count as present")
	}
	if QueryHas(req, "absent") {
		t.Error("an absent parameter counted as present")
	}
	if got := Query(req, "with_unbounded"); got != "false" {
		t.Errorf("Query = %q, want the raw value", got)
	}
}

// TestChainOrder verifies middleware runs left to right, matching Spring's filter
// ordering, so CORS headers are present even on a rejected request.
func TestChainOrder(t *testing.T) {
	var order []string
	mk := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		order = append(order, "handler")
		w.WriteHeader(http.StatusOK)
	})

	Chain(inner, mk("first"), mk("second")).ServeHTTP(
		httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	want := []string{"first", "second", "handler"}
	if len(order) != len(want) {
		t.Fatalf("order = %v, want %v", order, want)
	}
	for i := range want {
		if order[i] != want[i] {
			t.Fatalf("order = %v, want %v", order, want)
		}
	}
}
