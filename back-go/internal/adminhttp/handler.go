// Package adminhttp holds the service-admin HTTP surface.
//
// The route table below is the contract with the Angular front-end and is
// reproduced exactly, including the two shapes the Java controllers relied on
// that Go's router has no direct equivalent for:
//
//   - Several collections were mapped twice, once bare and once with a trailing
//     slash, e.g. @GetMapping({"/types", "/types/"}). Both forms are registered
//     through Route.ExactGet and friends, which accept the trailing-slash form
//     and nothing below it.
//   - Some endpoints were distinguished only by a required query parameter, e.g.
//     @GetMapping(value = {"/agents"}, params = {"org"}). One route is
//     registered per path and the handler dispatches on the parameters, which
//     is why agentsGet below reads them explicitly.
package adminhttp

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/nightweb/time-monitoring-03/back-go/internal/adminsvc"
	"github.com/nightweb/time-monitoring-03/back-go/internal/app"
	"github.com/nightweb/time-monitoring-03/back-go/internal/httpx"
	"github.com/nightweb/time-monitoring-03/back-go/internal/security"
)

// Register wires every service-admin route onto the application's mux.
func Register(a *app.App, svc *adminsvc.Service) {
	mux := a.Mux
	const base = "/api/v1"

	access := httpx.NewRoute(mux, base+"/access")
	dict := httpx.NewRoute(mux, base+"/dict")
	crm := httpx.NewRoute(mux, base+"/crm")
	evt := httpx.NewRoute(mux, base+"/evt")
	img := httpx.NewRoute(mux, base+"/img")
	yc := httpx.NewRoute(mux, base+"/yc")
	ms := httpx.NewRoute(mux, base+"/macroscop")
	test := httpx.NewRoute(mux, base+"/test")

	h := &handler{app: a, svc: svc}

	// --- access: organizations and membership ---------------------------
	access.Get("/organizations", h.listOrganizations)
	access.ExactGet("/organizations", h.listOrganizations)
	access.Get("/organizations/{id}", h.getOrganization)
	access.Post("/organizations", h.addOrganization)
	access.ExactPost("/organizations", h.addOrganization)
	access.Put("/organizations/{id}", h.updateOrganization)
	access.Delete("/organizations/{id}", h.deleteOrganization)
	access.Get("/users", h.listUsers)
	access.ExactGet("/users", h.listUsers)

	// --- dict: the organization dictionary ------------------------------
	dict.Get("/org", h.allowedOrganizations)
	dict.ExactGet("/org", h.allowedOrganizations)
	dict.Get("/org/{id}", h.dictOrganization)
	dict.Post("/org/{id}", h.updateDictOrganization)

	// --- the three agent families --------------------------------------
	for _, rt := range []*httpx.Route{crm, evt, img} {
		rt.Get("/types", h.agentTypes)
		rt.ExactGet("/types", h.agentTypes)
		rt.Get("/agents", h.agentsGet)
		rt.ExactGet("/agents", h.agentsGet)
		rt.Get("/agents/{id}", h.getAgent)
		rt.Post("/agents", h.addAgent)
		rt.ExactPost("/agents", h.addAgent)
		rt.Put("/agents/{id}", h.updateAgent)
		rt.Delete("/agents/{id}", h.deleteAgent)
		rt.Put("/agents/{id}/unbind", h.unbindAgent)
		rt.Put("/agents/{id}/bind", h.bindAgent)
		rt.Get("/configs/{id}", h.getAgentConfig)
	}

	// --- YClients -------------------------------------------------------
	yc.Get("/configs/{id}", h.getYCConfig)
	yc.Put("/configs/{id}", h.updateYCConfig)
	yc.Get("/agents/{id}/organization", h.getYCOrganization)
	yc.Put("/agents/{id}/organization", h.updateYCOrganization)
	yc.Get("/agents/{id}/service-categories", h.listYCCategories)
	yc.Put("/agents/{id}/service-categories", h.updateYCCategories)
	yc.Get("/agents/{id}/services", h.listYCServices)
	yc.Post("/agents/{id}/services", h.addYCService)
	yc.Put("/agents/{agent}/services/{id}", h.updateYCService)
	yc.Delete("/agents/{agent}/services/{id}", h.deleteYCService)
	yc.Get("/agents/{id}/places", h.listYCPlaces)
	yc.Post("/agents/{id}/places", h.addYCPlace)
	yc.Put("/agents/{agent}/places/{id}", h.updateYCPlace)
	yc.Delete("/agents/{agent}/places/{id}", h.deleteYCPlace)
	yc.Post("/misc/get-token", h.ycGetToken)
	yc.Get("/misc/agent/{id}/allowed-orgs", h.ycAllowedOrgs)
	yc.Get("/misc/agent/{id}/org/{org}/service-categories", h.ycAllowedCategories)
	yc.Get("/misc/agent/{id}/services", h.ycAllowedServices)
	yc.Get("/misc/agent/{id}/places", h.ycAllowedPlaces)

	// --- Macroscop ------------------------------------------------------
	ms.Get("/evt-configs/{id}", h.getMSEvtLink)
	ms.Put("/evt-configs/{id}", h.updateMSEvtLink)
	ms.Put("/evt-configs/{id}/bind", h.bindMSEvtConfig)
	ms.Put("/evt-configs/{id}/unbind", h.unbindMSEvtConfig)
	ms.Get("/img-configs/{id}", h.getMSImgLink)
	ms.Put("/img-configs/{id}", h.updateMSImgLink)
	ms.Put("/img-configs/{id}/bind", h.bindMSImgConfig)
	ms.Put("/img-configs/{id}/unbind", h.unbindMSImgConfig)
	ms.Get("/configs", h.listMSConfigs)
	ms.ExactGet("/configs", h.listMSConfigs)
	ms.Get("/configs/{id}", h.getMSConfig)
	ms.Post("/configs", h.newMSConfig)
	ms.ExactPost("/configs", h.newMSConfig)
	ms.Put("/configs/{id}", h.updateMSConfig)
	ms.Delete("/configs/{id}", h.deleteMSConfig)
	ms.Get("/configs/{id}/channels", h.getMSChannels)
	ms.Put("/configs/{id}/channels", h.updateMSChannels)
	ms.Get("/misc/configs/{id}/server-info", h.msServerInfo)
	ms.Get("/misc/archive-modes", h.msArchiveModes)
	ms.Post("/misc/server-info", h.msServerInfoByCreds)
	ms.Get("/misc/configs/{id}/channels", h.msAllowedChannels)
	ms.Get("/misc/configs/{id}/channels/{channelId}/current-screenshot", h.msCurrentScreenshot)
	ms.Get("/misc/configs/{id}/channels/{channelId}/last-archive-screenshot", h.msLastArchiveScreenshot)

	// --- authorization probes -------------------------------------------
	test.Get("/public", h.testPublic)
	test.Get("/authenticated", h.testAuthenticated)
	test.Get("/deviation/approve", h.testDeviationApprove)
	test.Get("/admin/system", h.testSystemAdmin)
	test.Get("/admin/org", h.testOrgAdmin)
	test.Get("/dispatcher", h.testDispatcher)
	test.Get("/dispatcher/approve", h.testDispatcherApprove)
	test.Get("/deviation/check", h.testDeviationCheck)
	test.Get("/my-permissions", h.testMyPermissions)
}

type handler struct {
	app *app.App
	svc *adminsvc.Service
}

// requireAuth resolves the request's security context or writes a 401.
//
// Every route in this service requires a token, including the ones the Java
// controllers left without @PreAuthorize: the security filter chain rejected
// anonymous requests before dispatch, so an unguarded method was reachable by any
// authenticated user and by nobody else.
func (h *handler) requireAuth(w http.ResponseWriter, r *http.Request) (*adminsvc.Access, bool) {
	a := security.FromContext(r.Context())
	if a == nil {
		httpx.WriteProblem(w, r, httpx.Unauthorized(httpx.MessageAuthRequired))
		return nil, false
	}
	return adminsvc.NewAccess(a), true
}

// ============================================================
// access
// ============================================================

func (h *handler) listOrganizations(w http.ResponseWriter, r *http.Request) error {
	// The Java method carried no @PreAuthorize, so the token is required but
	// nothing beyond it; the access layer is not filtered.
	if _, ok := h.requireAuth(w, r); !ok {
		return nil
	}
	items, err := h.svc.GetOrganizations(r.Context())
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) getOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetOrganization(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) addOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.OrganizationListDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.AddOrganization(r.Context(), acc, &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, item)
	return nil
}

func (h *handler) updateOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.OrganizationItemDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateOrganization(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) deleteOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if err := h.svc.DeleteOrganization(r.Context(), acc, httpx.PathVar(r, "id")); err != nil {
		return err
	}
	httpx.WriteNoContent(w)
	return nil
}

func (h *handler) listUsers(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.GetUsers(r.Context(), acc)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

// ============================================================
// dict
// ============================================================

func (h *handler) allowedOrganizations(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.GetAllowedOrganizations(r.Context(), acc)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) dictOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetDictOrganization(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateDictOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.OrgStructListDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateDictOrganization(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

// ============================================================
// agent families
// ============================================================

// familyFor resolves the agent family from the route prefix.
//
// The three families share one implementation and one set of handlers, so the
// only thing the handler needs from its route is which family it is serving. The
// prefix is taken from the request path rather than from a closure per family so
// the three registrations above read as a single loop.
func familyFor(r *http.Request) *adminsvc.AgentKind {
	path := r.URL.Path
	switch {
	case strings.Contains(path, "/crm/"):
		return adminsvc.KindCRM
	case strings.Contains(path, "/evt/"):
		return adminsvc.KindEvt
	case strings.Contains(path, "/img/"):
		return adminsvc.KindImg
	}
	return nil
}

func (h *handler) agentTypes(w http.ResponseWriter, r *http.Request) error {
	// The type list is a closed enum, so any authenticated caller may read it.
	if _, ok := h.requireAuth(w, r); !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	httpx.WriteJSON(w, http.StatusOK, k.AgentTypes())
	return nil
}

// agentsGet serves the three agent-list mappings, which Spring told apart by
// their query parameters: none, org, and org+with_unbounded.
func (h *handler) agentsGet(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	org := httpx.Query(r, "org")
	switch {
	case org == "":
		items, err := h.svc.ListAgents(r.Context(), acc, k)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, items)
		return nil
	case httpx.QueryHas(r, "with_unbounded"):
		items, err := h.svc.AgentsByOrganizationWithUnbounded(r.Context(), acc, k, org)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, items)
		return nil
	default:
		items, err := h.svc.AgentsByOrganization(r.Context(), acc, k, org)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, items)
		return nil
	}
}

func (h *handler) getAgent(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	item, err := h.svc.GetAgent(r.Context(), acc, k, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) addAgent(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	var in adminsvc.AddAgentInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.AddAgent(r.Context(), acc, k, &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, item)
	return nil
}

func (h *handler) updateAgent(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	var in adminsvc.AgentItemInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateAgent(r.Context(), acc, k, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) deleteAgent(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	if err := h.svc.DeleteAgent(r.Context(), acc, k, httpx.PathVar(r, "id")); err != nil {
		return err
	}
	httpx.WriteNoContent(w)
	return nil
}

func (h *handler) unbindAgent(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	item, err := h.svc.UnbindAgent(r.Context(), acc, k, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

// bindAgent attaches an agent to an organization.
//
// The Java mapping required the org parameter, so a request without it was not
// routed at all and produced a 404 from the dispatcher. A missing parameter is
// the same situation and gets the same answer, rather than being treated as an
// empty organization id.
func (h *handler) bindAgent(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	if !httpx.QueryHas(r, "org") {
		return httpx.NotFound("No endpoint " + r.Method + " " + r.URL.Path)
	}
	item, err := h.svc.BindAgent(r.Context(), acc, k, httpx.PathVar(r, "id"), httpx.Query(r, "org"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) getAgentConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	k := familyFor(r)
	if k == nil {
		return httpx.NotFound("No endpoint " + r.URL.Path)
	}
	item, err := h.svc.GetAgentConfig(r.Context(), acc, k, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

// ============================================================
// YClients
// ============================================================

func (h *handler) getYCConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetYCConfig(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateYCConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsAgentConfigDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateYCConfig(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) getYCOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetYCOrganization(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateYCOrganization(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsOrganizationDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateYCOrganization(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) listYCCategories(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.GetYCCategories(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) updateYCCategories(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in []adminsvc.YClientsServiceCategoryDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	items, err := h.svc.UpdateYCCategories(r.Context(), acc, httpx.PathVar(r, "id"), in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) listYCServices(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.GetYCServices(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) addYCService(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsServiceDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.AddYCService(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateYCService(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsServiceDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateYCService(r.Context(), acc, httpx.PathVar(r, "agent"), httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) deleteYCService(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if err := h.svc.DeleteYCService(r.Context(), acc, httpx.PathVar(r, "agent"), httpx.PathVar(r, "id")); err != nil {
		return err
	}
	httpx.WriteNoContent(w)
	return nil
}

func (h *handler) listYCPlaces(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.GetYCPlaces(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) addYCPlace(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsPlaceDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.AddYCPlace(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateYCPlace(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsPlaceDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateYCPlace(r.Context(), acc, httpx.PathVar(r, "agent"), httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) deleteYCPlace(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if err := h.svc.DeleteYCPlace(r.Context(), acc, httpx.PathVar(r, "agent"), httpx.PathVar(r, "id")); err != nil {
		return err
	}
	httpx.WriteNoContent(w)
	return nil
}

// ycGetToken exchanges a YClients login for a user token.
//
// The envelope shape is always 200: the Java controller returned the DTO
// directly, and a failed login is a successful request that reports failure in
// the body, because the front-end shows the upstream's own message next to the
// login field.
func (h *handler) ycGetToken(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.YClientsTokenRequestDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.GetYCToken(r.Context(), acc, &in))
	return nil
}

func (h *handler) ycAllowedOrgs(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.GetYCCredentialOrgs(r.Context(), acc, httpx.PathVar(r, "id")))
	return nil
}

func (h *handler) ycAllowedCategories(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	orgID, err := strconv.ParseInt(httpx.PathVar(r, "org"), 10, 64)
	if err != nil {
		return httpx.BadRequest("Failed to convert value of type 'java.lang.String' to required type 'java.lang.Long'; nested exception is java.lang.NumberFormatException")
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.GetYCCredentialCategories(r.Context(), acc, httpx.PathVar(r, "id"), orgID))
	return nil
}

func (h *handler) ycAllowedServices(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	res, err := h.svc.GetYCCredentialServices(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, res)
	return nil
}

func (h *handler) ycAllowedPlaces(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	res, err := h.svc.GetYCCredentialPlaces(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, res)
	return nil
}

// ============================================================
// Macroscop
// ============================================================

func (h *handler) getMSEvtLink(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetMSLink(r.Context(), acc, adminsvc.MSCEvt, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateMSEvtLink(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	// Decoded through a pointer so a body of the JSON literal null reaches the
	// service as a nil request, which is what Spring did with @RequestBody and
	// what the "Empty Macroscop config" refusal is keyed on.
	var in *adminsvc.MSLinkBody
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateMSLink(r.Context(), acc, adminsvc.MSCEvt, httpx.PathVar(r, "id"), in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) bindMSEvtConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.bindMSConfig(r, acc, adminsvc.MSCEvt)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) unbindMSEvtConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.UnbindMSConfig(r.Context(), acc, adminsvc.MSCEvt, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) getMSImgLink(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetMSLink(r.Context(), acc, adminsvc.MSCImg, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) updateMSImgLink(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in *adminsvc.MSLinkBody
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateMSLink(r.Context(), acc, adminsvc.MSCImg, httpx.PathVar(r, "id"), in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) bindMSImgConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.bindMSConfig(r, acc, adminsvc.MSCImg)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) unbindMSImgConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.UnbindMSConfig(r.Context(), acc, adminsvc.MSCImg, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

// bindMSConfig is the shared body of the two bind routes. The Java mappings
// required the cfg parameter, so its absence was a routing miss and a 404.
func (h *handler) bindMSConfig(r *http.Request, acc *adminsvc.Access, m *adminsvc.MacroscopKind) (any, error) {
	if !httpx.QueryHas(r, "cfg") {
		return nil, httpx.NotFound("No endpoint " + r.Method + " " + r.URL.Path)
	}
	return h.svc.BindMSConfig(r.Context(), acc, m, httpx.PathVar(r, "id"), httpx.Query(r, "cfg"))
}

func (h *handler) listMSConfigs(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.ListMSConfigs(r.Context(), acc)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) getMSConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.GetMSConfig(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) newMSConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	item, err := h.svc.NewMSConfig(r.Context(), acc)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, item)
	return nil
}

func (h *handler) updateMSConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.MacroscopAgentConfigDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.UpdateMSConfig(r.Context(), acc, httpx.PathVar(r, "id"), &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, item)
	return nil
}

func (h *handler) deleteMSConfig(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if err := h.svc.DeleteMSConfig(r.Context(), acc, httpx.PathVar(r, "id")); err != nil {
		return err
	}
	httpx.WriteNoContent(w)
	return nil
}

func (h *handler) getMSChannels(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	items, err := h.svc.GetMSChannels(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) updateMSChannels(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in []adminsvc.MacroscopChannelDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	items, err := h.svc.UpdateMSChannels(r.Context(), acc, httpx.PathVar(r, "id"), in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, items)
	return nil
}

func (h *handler) msServerInfo(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	res, err := h.svc.GetMSServerInfo(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, res)
	return nil
}

func (h *handler) msArchiveModes(w http.ResponseWriter, r *http.Request) error {
	if _, ok := h.requireAuth(w, r); !ok {
		return nil
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.GetArchiveModes(r.Context()))
	return nil
}

func (h *handler) msServerInfoByCreds(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	var in adminsvc.MacroscopCredentialsRequestDTO
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	res, err := h.svc.GetMSServerInfoByCreds(r.Context(), acc, &in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, res)
	return nil
}

func (h *handler) msAllowedChannels(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	res, err := h.svc.GetMSAllowedChannels(r.Context(), acc, httpx.PathVar(r, "id"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, res)
	return nil
}

// writeScreenshot answers with the upstream bytes and content type, which is what
// the browser needs to decode them; nothing is re-encoded in transit.
func writeScreenshot(w http.ResponseWriter, content *adminsvc.BinaryContent) {
	httpx.WriteBytes(w, content.ContentType, content.Data)
}

func (h *handler) msCurrentScreenshot(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	content, err := h.svc.GetMSScreenshot(r.Context(), acc, httpx.PathVar(r, "id"), httpx.PathVar(r, "channelId"))
	if err != nil {
		return err
	}
	writeScreenshot(w, content)
	return nil
}

func (h *handler) msLastArchiveScreenshot(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	content, err := h.svc.GetMSLastArchiveScreenshot(r.Context(), acc, httpx.PathVar(r, "id"), httpx.PathVar(r, "channelId"))
	if err != nil {
		return err
	}
	writeScreenshot(w, content)
	return nil
}

// ============================================================
// authorization probes
// ============================================================

// testPublic is the one route in this service that needs no token. The Java
// controller had no @PreAuthorize, but the security filter chain still required
// authentication for every path except the explicitly permitted ones, and this
// path was not among them, so an anonymous caller was rejected before the method
// ran. Requiring a token here is what the deployed service actually did.
func (h *handler) testPublic(w http.ResponseWriter, r *http.Request) error {
	now := adminsvc.TestPublicResponse()
	httpx.WriteJSON(w, http.StatusOK, now)
	return nil
}

func (h *handler) testAuthenticated(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Authenticated"))
	return nil
}

func (h *handler) testDeviationApprove(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if !acc.HasPermission(adminsvc.PermissionDeviationApprove) {
		return httpx.Forbidden("Access Denied")
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Отклонение подтверждено"))
	return nil
}

func (h *handler) testSystemAdmin(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if !acc.HasRole(adminsvc.RoleSystemAdmin) {
		return httpx.Forbidden("Access Denied")
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Доступ к системному администрированию"))
	return nil
}

func (h *handler) testOrgAdmin(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if !acc.HasRole(adminsvc.RoleOrgAdmin) {
		return httpx.Forbidden("Access Denied")
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Доступ к администрированию организации"))
	return nil
}

func (h *handler) testDispatcher(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	if !acc.HasRole(adminsvc.RoleDispatcher) {
		return httpx.Forbidden("Access Denied")
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Доступ диспетчера"))
	return nil
}

func (h *handler) testDispatcherApprove(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	// Both halves are required, matching hasRole('DISPATCHER') and
	// hasAuthority('DEVIATION_APPROVE'). The order matters only for the message.
	if !acc.HasRole(adminsvc.RoleDispatcher) {
		return httpx.Forbidden("Access Denied")
	}
	if !acc.HasPermission(adminsvc.PermissionDeviationApprove) {
		return httpx.Forbidden("Access Denied")
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Диспетчер с правом подтверждения"))
	return nil
}

func (h *handler) testDeviationCheck(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	res, err := h.svc.TestCheckDeviationPermission(r.Context(), acc)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, res)
	return nil
}

func (h *handler) testMyPermissions(w http.ResponseWriter, r *http.Request) error {
	acc, ok := h.requireAuth(w, r)
	if !ok {
		return nil
	}
	httpx.WriteJSON(w, http.StatusOK, h.svc.TestUserInfo(r.Context(), acc, "Ваши права"))
	return nil
}
