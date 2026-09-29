// Package httpx holds the HTTP conventions shared by all three services: the
// RFC 9457 problem document, the login-shaped error envelope used by
// service-auth, CORS, and JSON binding.
//
// Reproducing both error formats matters because the Angular front-end branches
// on them: components read problem.detail for inline form errors and the auth
// guard treats a 401 problem document as a session expiry.
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// APIError is an error carrying the HTTP status the client should see.
//
// The Spring services signalled this with ResponseStatusException, which the
// GlobalExceptionHandler rendered as a problem document. Go has no exception
// type, so handlers return an *APIError and the mux turns it into the same
// document.
type APIError struct {
	Status  int
	Detail  string
	Title   string
	TypeURI string
}

func (e *APIError) Error() string { return fmt.Sprintf("%d: %s", e.Status, e.Detail) }

// NewAPIError builds an error with the conventional problem title for a status.
func NewAPIError(status int, detail string) *APIError {
	return &APIError{Status: status, Detail: detail, Title: http.StatusText(status)}
}

// Constructors for the statuses the Java code threw directly.
func BadRequest(detail string) *APIError   { return NewAPIError(http.StatusBadRequest, detail) }
func Unauthorized(detail string) *APIError { return NewAPIError(http.StatusUnauthorized, detail) }
func Forbidden(detail string) *APIError    { return NewAPIError(http.StatusForbidden, detail) }
func NotFound(detail string) *APIError     { return NewAPIError(http.StatusNotFound, detail) }
func Conflict(detail string) *APIError     { return NewAPIError(http.StatusConflict, detail) }
func BadGateway(detail string) *APIError   { return NewAPIError(http.StatusBadGateway, detail) }

// Problem is the RFC 9457 document produced by core-web GlobalExceptionHandler,
// plus the timestamp property the Java handler added.
type Problem struct {
	Type      string `json:"type"`
	Title     string `json:"title"`
	Status    int    `json:"status"`
	Detail    string `json:"detail"`
	Timestamp string `json:"timestamp"`
	Instance  string `json:"instance,omitempty"`
}

// WriteProblem renders an error as a problem document.
//
// statusFor resolves a non-APIError to a status: 400 for malformed input, 401
// for an authentication failure, 500 otherwise, matching the Java handler's
// catch-all of Exception -> 500.
func WriteProblem(w http.ResponseWriter, r *http.Request, err error) {
	apiErr := AsAPIError(err)

	problem := Problem{
		Type:      "about:blank",
		Title:     apiErr.Title,
		Status:    apiErr.Status,
		Detail:    apiErr.Detail,
		Timestamp: time.Now().UTC().Format("2006-01-02T15:04:05.000000"),
		Instance:  r.URL.Path,
	}
	if apiErr.TypeURI != "" {
		problem.Type = apiErr.TypeURI
	}
	if problem.Title == "" {
		problem.Title = http.StatusText(apiErr.Status)
	}

	if apiErr.Status >= 500 {
		slog.Error("request failed", "method", r.Method, "path", r.URL.Path, "status", apiErr.Status, "err", err)
	} else {
		slog.Debug("request rejected", "method", r.Method, "path", r.URL.Path, "status", apiErr.Status, "detail", apiErr.Detail)
	}

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(apiErr.Status)
	if encErr := json.NewEncoder(w).Encode(problem); encErr != nil {
		slog.Warn("write problem failed", "err", encErr)
	}
}

// AsAPIError normalises any error into an APIError.
func AsAPIError(err error) *APIError {
	if err == nil {
		return NewAPIError(http.StatusInternalServerError, "Internal Server Error")
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr
	}
	var validation *ValidationError
	if errors.As(err, &validation) {
		return NewAPIError(http.StatusBadRequest, validation.Error())
	}
	return NewAPIError(http.StatusInternalServerError, err.Error())
}

// ValidationError carries a bean-validation-style message list, which the Java
// services surfaced as a single field-error string on the problem document.
type ValidationError struct {
	Messages []string
}

func (v *ValidationError) Error() string {
	return strings.Join(v.Messages, "; ")
}

// WriteJSON renders a success payload.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	if payload == nil {
		w.WriteHeader(status)
		return
	}
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Warn("write json failed", "err", err)
	}
}

// WriteNoContent renders an empty 204, used by every delete endpoint.
func WriteNoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

// WriteBytes renders a raw binary body, used by the Macroscop screenshot
// proxy which streams an upstream image with its original content type.
func WriteBytes(w http.ResponseWriter, contentType string, body []byte) {
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", fmt.Sprint(len(body)))
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(body); err != nil {
		slog.Warn("write binary failed", "err", err)
	}
}

// DecodeJSON reads a JSON body, rejecting unknown fields the way the Java
// services effectively did for typed DTOs.
func DecodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	if r.Body == nil {
		return BadRequest("Required request body is missing")
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(target); err != nil {
		var syn *json.SyntaxError
		if errors.As(err, &syn) {
			return BadRequest("Malformed JSON request body")
		}
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) {
			return BadRequest(fmt.Sprintf("Field '%s' has an invalid type", typeErr.Field))
		}
		return BadRequest("Malformed JSON request body: " + err.Error())
	}
	return nil
}
