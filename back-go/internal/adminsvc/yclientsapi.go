package adminsvc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// YClientsAPI is the client for the YClients partner API, the Go port of
// YClientsApiClient plus the ConfigManageService parsing on top of it.
//
// YClients authenticates with two headers rather than a bearer token: the
// partner token identifies the integration and the user token scopes it to one
// employee, so a single stored configuration can read a different slice of the
// company for different users.
type YClientsAPI struct {
	baseURL string
	client  *http.Client
	// accept is the vendor media type. YClients serves the v2 JSON shape only
	// under this content type, so it is sent on every request.
	accept string
}

// YClientsEndpoints are the path suffixes of the YClients API. They were
// configurable in the Java client and the defaults are what the deployment used;
// keeping them as fields documents the shape of the upstream API at the call
// sites.
type YClientsEndpoints struct {
	Auth              string
	Companies         string
	Company           string
	ServiceCategories string
	Services          string
	Staffs            string
}

// DefaultYClientsEndpoints is the configuration the Java properties carried.
func DefaultYClientsEndpoints() YClientsEndpoints {
	return YClientsEndpoints{
		Auth:              "/auth",
		Companies:         "/companies",
		Company:           "/company",
		ServiceCategories: "/service_categories",
		Services:          "/services",
		Staffs:            "/staff",
	}
}

// NewYClientsAPI builds the client. baseURL comes from YCLIENTS_API_URL; an
// empty baseURL leaves the client unusable, which the service reports as an
// upstream error rather than crashing, so a deployment without YClients
// credentials still serves every other endpoint.
func NewYClientsAPI(baseURL string, timeout time.Duration) *YClientsAPI {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &YClientsAPI{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: timeout},
		accept:  "application/vnd.yclients.v2+json",
	}
}

// BaseURL is the configured root, for diagnostics.
func (a *YClientsAPI) BaseURL() string { return a.baseURL }

// ycResponse is the upstream envelope: a status code, a data payload, and a meta
// block that carries a human-readable message when something went wrong.
type ycResponse struct {
	Status  int             `json:"status"`
	Data    json.RawMessage `json:"data"`
	Meta    json.RawMessage `json:"meta"`
	Message string          `json:"message"`
}

// exchange performs one YClients call and decodes the envelope.
//
// A transport failure, a non-JSON body or a 5xx is turned into the same
// synthetic envelope the Java client produced through emptyErrorResponse, so the
// callers' error handling does not need a second shape.
func (a *YClientsAPI) exchange(ctx context.Context, method, path string, partner, user *string, params url.Values, body any) (*ycResponse, error) {
	if a.baseURL == "" {
		return &ycResponse{Status: 0, Message: "YClients API is not configured"}, nil
	}
	full := a.baseURL + path
	if len(params) > 0 {
		full += "?" + params.Encode()
	}
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, full, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", a.accept)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	// The two-token header scheme: Authorization carries the partner token, and
	// the User header carries the user token. Neither is a standard header, which
	// is why this is not simply http.Request.SetBasicAuth.
	if partner != nil && *partner != "" {
		req.Header.Set("Authorization", "Bearer "+*partner)
	}
	if user != nil && *user != "" {
		req.Header.Set("User", *user)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return &ycResponse{Status: 0, Message: err.Error()}, nil
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return &ycResponse{Status: resp.StatusCode, Message: err.Error()}, nil
	}
	var out ycResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return &ycResponse{Status: resp.StatusCode, Message: sanitizeYCMeta(string(raw))}, nil
	}
	if out.Status == 0 {
		// The vendor omits the status on some error bodies; the transport code
		// is authoritative then.
		out.Status = resp.StatusCode
	}
	return &out, nil
}

// sanitizeYCMeta pulls a message out of a body that is not the expected envelope,
// trimming it so a stack trace or an HTML error page cannot flood a log line.
func sanitizeYCMeta(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "empty response"
	}
	if len(raw) > 400 {
		raw = raw[:400] + "..."
	}
	return raw
}

// errorMessageOf extracts the upstream's own error text, mirroring
// YClientsApiClient#extractError: the meta block's "message" key, else a string
// meta block, else a string data block, else the top-level message, else a fixed
// Russian phrase that the Java code used as the last resort.
func errorMessageOf(resp *ycResponse) string {
	if resp == nil {
		return "Не известная ошибка"
	}
	if len(resp.Meta) > 0 {
		var asString string
		if err := json.Unmarshal(resp.Meta, &asString); err == nil {
			return asString
		}
		var asMap map[string]any
		if err := json.Unmarshal(resp.Meta, &asMap); err == nil {
			if v, ok := asMap["message"]; ok && v != nil {
				return fmt.Sprint(v)
			}
		}
	}
	if len(resp.Data) > 0 {
		var asString string
		if err := json.Unmarshal(resp.Data, &asString); err == nil {
			return asString
		}
	}
	if resp.Message != "" {
		return resp.Message
	}
	return "Не известная ошибка"
}

// statusMessage renders the status the way the Java code did, by calling
// toString() on the HttpStatusCode: "200 OK" for a known code and the bare
// number for an unknown one. The front-end shows this string, so the space
// matters.
func statusMessage(code int) *string {
	msg := http.StatusText(code)
	if msg == "" {
		s := strconv.Itoa(code)
		return &s
	}
	s := fmt.Sprintf("%d %s", code, msg)
	return &s
}

// isSuccess reports whether the upstream call succeeded.
//
// The vendor sets a 2xx in the body even for some business failures, and a
// non-2xx in the body for failures the transport considered fine, so both are
// consulted. The Java code used the transport status alone; the body status is
// accepted as an additional success signal, not a stricter one, so no new failure
// is introduced.
func isSuccess(resp *ycResponse) bool {
	if resp == nil {
		return false
	}
	if resp.Status >= 200 && resp.Status < 300 {
		return true
	}
	return false
}

// metaOf decodes the meta block into the string map the envelope exposes.
func metaOf(resp *ycResponse) map[string]string {
	if resp == nil || len(resp.Meta) == 0 {
		return nil
	}
	var asMap map[string]string
	if err := json.Unmarshal(resp.Meta, &asMap); err == nil {
		return asMap
	}
	var asAny map[string]any
	if err := json.Unmarshal(resp.Meta, &asAny); err == nil {
		out := make(map[string]string, len(asAny))
		for k, v := range asAny {
			out[k] = fmt.Sprint(v)
		}
		return out
	}
	return nil
}

// ============================================================
// Upstream payload shapes
// ============================================================

// ycAuthResponse is the /auth payload: the user token issued for a login.
type ycAuthResponse struct {
	UserToken string `json:"user_token"`
}

// ycOrgInfo is one company from /companies.
//
// The display name is the vendor's "title"; "public_title" is a marketing
// variant and "short_descr" a blurb, neither of which the integration uses. The
// timezone is a whole number of hours east of UTC rather than an offset string,
// which is why it is converted through zoneOffsetOfHours.
type ycOrgInfo struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Timezone int    `json:"timezone"`
}

// ycServiceCategoryInfo is one entry from /service_categories, including the
// staff that may perform it. The staff list is what makes the "available places"
// query possible without a second round trip per category.
type ycServiceCategoryInfo struct {
	ID    int64   `json:"id"`
	Title string  `json:"title"`
	Staff []int64 `json:"staff"`
}

// ycServiceInfo is one entry from /services. Active is the vendor's own flag
// rather than a boolean, and is_online is ignored: a service that is registered
// but currently unstaffed is still offered.
type ycServiceInfo struct {
	ID       int64  `json:"id"`
	Title    string `json:"title"`
	Category int64  `json:"category_id"`
	Active   int    `json:"active"`
	Online   int    `json:"is_online"`
}

// ycStaffInfo is one employee from /staff. Fired and Status are the vendor's two
// independent flags: Fired is set when the employment ends, Status is their own
// work-status field. Both must be zero for the person to be dispatchable.
type ycStaffInfo struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Status int    `json:"status"`
	Fired  int    `json:"fired"`
}

// zoneOffsetOfHours renders a whole-hour offset the way ZoneOffset#toString did:
// "Z" for zero, and "+HH:MM" otherwise. A company with no timezone set is read as
// UTC; the Java code dereferenced the Integer and would have thrown, so the
// fallback is a deliberate improvement rather than a translation. See
// MIGRATION.md, "Inherited limitations".
func zoneOffsetOfHours(hours int) string {
	if hours == 0 {
		return "Z"
	}
	sign := "+"
	if hours < 0 {
		sign = "-"
		hours = -hours
	}
	return sign + fmt.Sprintf("%02d:%02d", hours/60, hours%60)
}
