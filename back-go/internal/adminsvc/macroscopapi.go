package adminsvc

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/nightweb/time-monitoring-03/back-go/internal/common"
)

// MacroscopAPI is the client for the MSCP control API of a Macroscop server, the
// Go port of MacroscopApiClient plus MSCPConfigManageService.
//
// Two endpoints are used. /configex returns the whole server configuration as
// JSON - its identity, its channels and their streams - and is what both the
// server-info probe and the channel picker read. /site returns a single frame
// and is what the screenshot proxy reads. Both authenticate with the login and
// an md5 digest of the password, never the password itself.
type MacroscopAPI struct {
	// serverConfigAPI is the path suffix of the configuration read.
	serverConfigAPI string
	// siteOperationsAPI is the path suffix of the single-frame read.
	siteOperationsAPI string
	// bigResolutionX is the requested frame width.
	bigResolutionX int
	client         *http.Client
	// maxJSON and maxImage bound the response bodies. The Java service used two
	// WebClients with different in-memory limits; the same limits are applied
	// here, because a Macroscop server that answers with a multi-megabyte body
	// for a config request would otherwise be buffered whole.
	maxJSON  int64
	maxImage int64
}

// DefaultMacroscopAPI builds the client with the values the properties class
// defaulted to, which is what the deployment used because the admin service
// carried no macroscop.config.api block.
func DefaultMacroscopAPI(timeout time.Duration) *MacroscopAPI {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &MacroscopAPI{
		serverConfigAPI:   "/configex",
		siteOperationsAPI: "/site",
		bigResolutionX:    1280,
		client:            &http.Client{Timeout: timeout},
		maxJSON:           1 << 20,
		maxImage:          10 << 20,
	}
}

// The MSCP stream names, from MacroscopApiConstants. A channel exposes one or
// both, and the screenshot proxy picks the better of the two.
const (
	StreamMain = "Main"
	StreamAlt  = "Alternative"
)

// ============================================================
// Upstream payload shapes
// ============================================================

// mscpConfig is the /configex payload.
type mscpConfig struct {
	ID            string        `json:"id"`
	Timestamp     string        `json:"timestamp"`
	ServerVersion string        `json:"serverVersion"`
	Channels      []mscpChannel `json:"channels"`
	UseTimeZones  bool          `json:"useTimeZones"`
}

// mscpChannel is one camera in the /configex payload. The upstream booleans are
// nullable, and every one of them is read through Boolean.TRUE.equals, so an
// absent flag means false rather than unknown.
type mscpChannel struct {
	ID               string       `json:"id"`
	Name             string       `json:"name"`
	DeviceInfo       string       `json:"deviceInfo"`
	Disabled         bool         `json:"isDisabled"`
	SoundOn          bool         `json:"isSoundOn"`
	ArchivingEnabled bool         `json:"isArchivingEnabled"`
	AllowedArchive   bool         `json:"allowedArchive"`
	AllowedRealtime  bool         `json:"allowedRealtime"`
	ArchiveMode      string       `json:"archiveMode"`
	TimeZoneOffset   *float64     `json:"timeZoneOffset"`
	Streams          []mscpStream `json:"streams"`
}

// mscpStream is one resolution variant of a channel.
type mscpStream struct {
	StreamType   string `json:"streamType"`
	StreamFormat string `json:"streamFormat"`
}

// ============================================================
// Calls
// ============================================================

// GetServerInfo asks a Macroscop server to describe itself.
//
// The response carries no time zone of its own: the server's notion of "now" is
// whatever it thinks it is, and the channels are the only place a zone offset
// appears. The first channel that declares one is therefore treated as the
// server's, which is what the Java parser did.
func (a *MacroscopAPI) GetServerInfo(ctx context.Context, creds *MacroscopServerCredentials) MacroscopDataResponse[*MacroscopServerInfoDTO] {
	resp, err := a.fetchConfig(ctx, creds)
	if err != nil {
		return networkMacroscopError[*MacroscopServerInfoDTO](err)
	}
	if !resp.Success {
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{
			StatusCode:   resp.StatusCode,
			Success:      false,
			ErrorMessage: resp.ErrorMessage,
		}
	}
	if resp.raw == nil {
		// A 2xx with nothing in it means the server answered but described
		// nothing; that is a failure to the caller, not an empty success.
		return MacroscopDataResponse[*MacroscopServerInfoDTO]{
			StatusCode:   resp.StatusCode,
			Success:      false,
			ErrorMessage: str("Empty response data"),
		}
	}
	zone := extractZoneOffset(resp.raw.Channels)
	offset := secondsOf(zone)
	// The stored zone is what the front-end shows next to the timestamp, so the
	// two have to agree: the timestamp is rendered in the same zone that is
	// reported. When no channel declares one, the server's own UTC clock is used
	// and the zone is reported as null rather than as a fabricated UTC.
	display := offset
	if zone == nil {
		display = 0
	}
	stamp := parseMSCPInstant(resp.raw.Timestamp).In(time.FixedZone("", display))
	return MacroscopDataResponse[*MacroscopServerInfoDTO]{
		StatusCode: resp.StatusCode,
		Success:    true,
		Data: &MacroscopServerInfoDTO{
			ID:           str(resp.raw.ID),
			Version:      str(resp.raw.ServerVersion),
			ResponseDate: &common.OffsetDateTime{Time: stamp},
			TZ:           zone,
			UseTZ:        resp.raw.UseTimeZones,
		},
	}
}

// GetAllowedChannels lists the cameras a Macroscop server offers.
//
// Every channel comes back flagged as existing and in use: they are the
// candidates the front-end may add, and the stored configuration is what decides
// which of them an organization actually has.
func (a *MacroscopAPI) GetAllowedChannels(ctx context.Context, creds *MacroscopServerCredentials) MacroscopDataResponse[[]MacroscopChannelDTO] {
	resp, err := a.fetchConfig(ctx, creds)
	if err != nil {
		return networkMacroscopError[[]MacroscopChannelDTO](err)
	}
	if !resp.Success {
		return MacroscopDataResponse[[]MacroscopChannelDTO]{
			StatusCode:   resp.StatusCode,
			Success:      false,
			ErrorMessage: resp.ErrorMessage,
		}
	}
	if resp.raw == nil || resp.raw.Channels == nil {
		return MacroscopDataResponse[[]MacroscopChannelDTO]{
			StatusCode:   resp.StatusCode,
			Success:      false,
			ErrorMessage: str("Empty channel list"),
		}
	}
	data := make([]MacroscopChannelDTO, 0, len(resp.raw.Channels))
	for i := range resp.raw.Channels {
		c := &resp.raw.Channels[i]
		streams := make([]MacroscopChannelStreamDTO, 0, len(c.Streams))
		for _, st := range c.Streams {
			streams = append(streams, MacroscopChannelStreamDTO{Type: str(st.StreamType), Format: str(st.StreamFormat)})
		}
		data = append(data, MacroscopChannelDTO{
			MacroscopID:      c.ID,
			Name:             str(c.Name),
			Device:           str(c.DeviceInfo),
			Enabled:          !c.Disabled,
			Exists:           true,
			Used:             true,
			ArchivingEnabled: c.ArchivingEnabled,
			ArchiveAllowed:   c.AllowedArchive,
			RealtimeAllowed:  c.AllowedRealtime,
			SoundAllowed:     c.SoundOn,
			ArchiveMode:      ArchiveModeNameByMacroscopID(c.ArchiveMode),
			TZ:               hoursToZoneOffset(c.TimeZoneOffset),
			Streams:          streams,
		})
	}
	return MacroscopDataResponse[[]MacroscopChannelDTO]{
		StatusCode: resp.StatusCode,
		Success:    true,
		Data:       data,
	}
}

// GetCurrentScreenshot fetches a single live frame of a channel.
func (a *MacroscopAPI) GetCurrentScreenshot(ctx context.Context, creds *MacroscopServerCredentials, channelID, streamType string) MacroscopDataResponse[*BinaryContent] {
	params := url.Values{
		"login":       []string{creds.Login},
		"password":    []string{creds.PasswordHash},
		"channelId":   []string{channelID},
		"resolutionx": []string{strconv.Itoa(a.bigResolutionX)},
		"streamtype":  []string{streamType},
	}
	return a.fetchBinary(ctx, creds.Address+a.siteOperationsAPI, params)
}

// GetLastArchiveScreenshot fetches the most recent archived frame of a channel.
//
// The start time is the current instant, and the server interprets it as "the
// last archive at or before this moment", which is why the endpoint needs no
// paging of its own.
func (a *MacroscopAPI) GetLastArchiveScreenshot(ctx context.Context, creds *MacroscopServerCredentials, channelID string) MacroscopDataResponse[*BinaryContent] {
	params := url.Values{
		"login":       []string{creds.Login},
		"password":    []string{creds.PasswordHash},
		"channelId":   []string{channelID},
		"resolutionx": []string{strconv.Itoa(a.bigResolutionX)},
		"mode":        []string{"archive"},
		"starttime":   []string{toMacroscopTime(time.Now())},
	}
	return a.fetchBinary(ctx, creds.Address+a.siteOperationsAPI, params)
}

// ============================================================
// transport
// ============================================================

// mscpRaw is the decoded /configex response plus the envelope fields.
type mscpRaw struct {
	StatusCode   int
	Success      bool
	ErrorMessage *string
	raw          *mscpConfig
}

// fetchConfig performs the /configex read.
//
// The Macroscop server answers with a body that is not always the JSON it
// documents - an authentication failure in particular comes back as an HTML
// page - so a decode failure is reported through the envelope with the
// sanitized body as the message rather than as a transport error.
func (a *MacroscopAPI) fetchConfig(ctx context.Context, creds *MacroscopServerCredentials) (*mscpRaw, error) {
	params := url.Values{
		"login":        []string{creds.Login},
		"password":     []string{creds.PasswordHash},
		"responsetype": []string{"json"},
	}
	body, status, err := a.get(ctx, creds.Address+a.serverConfigAPI, params, a.maxJSON)
	if err != nil {
		return nil, err
	}
	out := &mscpRaw{StatusCode: status, Success: status >= 200 && status < 300}
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		if !out.Success {
			out.ErrorMessage = str("Пустой ответ сервера, статус " + strconv.Itoa(status))
		}
		return out, nil
	}
	var cfg mscpConfig
	if err := json.Unmarshal([]byte(trimmed), &cfg); err != nil {
		out.Success = false
		out.ErrorMessage = str(sanitizeMSCPMessage(trimmed))
		return out, nil
	}
	out.raw = &cfg
	return out, nil
}

// fetchBinary performs a /site read and classifies the answer.
//
// A 2xx that is not an image is a failure, not an empty picture: the server
// answers 200 with a diagnostic page when a camera is offline, and forwarding
// that as an image would leave the front-end with a broken <img>.
func (a *MacroscopAPI) fetchBinary(ctx context.Context, url string, params url.Values) MacroscopDataResponse[*BinaryContent] {
	body, status, contentType, err := a.getTyped(ctx, url, params, a.maxImage)
	if err != nil {
		if strings.Contains(err.Error(), "exceeds") {
			return MacroscopDataResponse[*BinaryContent]{
				StatusCode:   502,
				Success:      false,
				ErrorMessage: str("Ответ Macroscop превышает допустимый размер"),
			}
		}
		return MacroscopDataResponse[*BinaryContent]{
			StatusCode:   503,
			Success:      false,
			ErrorMessage: str("Ошибка сети: " + err.Error()),
		}
	}
	if status < 200 || status >= 300 {
		return MacroscopDataResponse[*BinaryContent]{
			StatusCode:   status,
			Success:      false,
			ErrorMessage: str("Macroscop returned " + strconv.Itoa(status) + ": " + sanitizeMSCPMessage(string(body))),
		}
	}
	if !isBinaryContentType(contentType) {
		msg := sanitizeMSCPMessage(string(body))
		if strings.TrimSpace(msg) == "" {
			msg = "unknown error"
		}
		return MacroscopDataResponse[*BinaryContent]{
			StatusCode:   status,
			Success:      false,
			ErrorMessage: str("Macroscop: " + msg),
		}
	}
	return MacroscopDataResponse[*BinaryContent]{
		StatusCode: status,
		Success:    true,
		Data:       &BinaryContent{ContentType: contentType, Data: body},
	}
}

func (a *MacroscopAPI) get(ctx context.Context, url string, params url.Values, limit int64) ([]byte, int, error) {
	body, status, _, err := a.getTyped(ctx, url, params, limit)
	return body, status, err
}

func (a *MacroscopAPI) getTyped(ctx context.Context, rawURL string, params url.Values, limit int64) ([]byte, int, string, error) {
	if len(params) > 0 {
		rawURL += "?" + params.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, 0, "", err
	}
	req.Header.Set("Accept", "*/*")
	resp, err := a.client.Do(req)
	if err != nil {
		return nil, 0, "", err
	}
	defer resp.Body.Close()
	// One byte past the limit is read so an oversized body is detected rather
	// than silently truncated into a corrupt image.
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, resp.StatusCode, "", err
	}
	if int64(len(body)) > limit {
		return nil, resp.StatusCode, "", fmt.Errorf("response exceeds %d bytes", limit)
	}
	return body, resp.StatusCode, resp.Header.Get("Content-Type"), nil
}

// isBinaryContentType reports whether a content type is one this service will
// forward to the browser as an image.
func isBinaryContentType(contentType string) bool {
	media := strings.ToLower(strings.TrimSpace(strings.SplitN(contentType, ";", 2)[0]))
	if strings.HasPrefix(media, "image/") || strings.HasPrefix(media, "video/") {
		return true
	}
	return media == "application/octet-stream"
}

// networkMacroscopError is the envelope for a request that never produced a
// status code.
func networkMacroscopError[T any](err error) MacroscopDataResponse[T] {
	return MacroscopDataResponse[T]{
		StatusCode:   503,
		Success:      false,
		ErrorMessage: str("Ошибка сети: " + err.Error()),
	}
}

// ============================================================
// parsing helpers
// ============================================================

// extractZoneOffset returns the zone of the first channel that declares one,
// rendered as "Z" or "+HH:MM".
func extractZoneOffset(channels []mscpChannel) *string {
	for i := range channels {
		if channels[i].TimeZoneOffset == nil {
			continue
		}
		return hoursToZoneOffset(channels[i].TimeZoneOffset)
	}
	return nil
}

// hoursToZoneOffset converts Macroscop's decimal-hour offset to the string form
// ZoneOffset#toString produces.
//
// The upstream value is fractional - a site on a half-hour or quarter-hour zone
// reports 5.5 or 5.75 - so it is rounded to whole seconds before being
// rendered, and an offset that lands on a whole hour is rendered without the
// minutes, which is what the Java formatter did.
func hoursToZoneOffset(hours *float64) *string {
	if hours == nil {
		return nil
	}
	total := int(math.Round(*hours * 3600))
	if total == 0 {
		return str("Z")
	}
	sign := "+"
	if total < 0 {
		sign = "-"
		total = -total
	}
	h, m, s := total/3600, (total%3600)/60, total%60
	switch {
	case s != 0:
		return str(fmt.Sprintf("%s%02d:%02d:%02d", sign, h, m, s))
	case m != 0:
		return str(fmt.Sprintf("%s%02d:%02d", sign, h, m))
	default:
		return str(fmt.Sprintf("%s%02d", sign, h))
	}
}

// secondsOf converts a rendered zone offset back to a second count, so the
// timestamp can be displayed in it. An absent or unparsable zone means UTC.
func secondsOf(zone *string) int {
	if zone == nil {
		return 0
	}
	v := *zone
	if v == "Z" {
		return 0
	}
	sign := 1
	switch {
	case strings.HasPrefix(v, "-"):
		sign, v = -1, v[1:]
	case strings.HasPrefix(v, "+"):
		v = v[1:]
	}
	parts := strings.Split(v, ":")
	total := 0
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return 0
		}
		total = total*60 + n
	}
	return sign * total
}

// parseMSCPInstant reads the server's own clock.
//
// The field is an ISO instant; an absent or unparsable value falls back to the
// local clock rather than failing, because the field exists to tell the operator
// whether the server's time is right, and a failed request would tell them
// nothing.
func parseMSCPInstant(timestamp string) time.Time {
	trimmed := strings.TrimSpace(timestamp)
	if trimmed == "" {
		return time.Now()
	}
	if parsed, err := time.Parse(time.RFC3339Nano, trimmed); err == nil {
		return parsed
	}
	return time.Now()
}

// macroscopTimeLayout is the query format Macroscop expects for a start time.
const macroscopTimeLayout = "02.01.2006+15:04:05"

// toMacroscopTime renders an instant the way Macroscop's query parser reads it.
//
// The value is always sent in UTC: the server compares it against its own
// archives, and it has no way to interpret a local time without also being told
// the zone, so the unambiguous form is the only correct one.
func toMacroscopTime(t time.Time) string {
	return t.UTC().Format(macroscopTimeLayout)
}

var multiSpace = regexp.MustCompile(` {2,}`)

// sanitizeMSCPMessage flattens an upstream body into a single readable line.
//
// Macroscop answers an error with an HTML page or a multi-line diagnostic, and
// that text ends up in an errorMessage the operator reads, so the line breaks
// and the byte-order mark are removed.
func sanitizeMSCPMessage(src string) string {
	src = strings.ReplaceAll(src, "\uFEFF", "")
	src = strings.ReplaceAll(src, "\r\n", ". ")
	src = strings.ReplaceAll(src, "\r", " ")
	src = strings.ReplaceAll(src, "\n", " ")
	src = multiSpace.ReplaceAllString(src, " ")
	src = strings.ReplaceAll(src, ". .", ".")
	return strings.TrimSpace(src)
}
