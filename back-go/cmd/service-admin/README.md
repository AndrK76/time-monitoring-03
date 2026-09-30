# service-admin

Administration service: the organization dictionary, the access model, the
three agent families (CRM/YClients, events, cameras) and the two external
integrations behind them (YClients and Macroscop). Owns the `admin` PostgreSQL
schema, listens on **8082**.

Every change to an organization is published as `ORGANIZATION_INFO_CHANGED` on
`mon3.auth` and `mon3.mon` — the first keeps service-auth's dictionary and
membership mirror in step, the second feeds service-monitoring's copy. The
agent bind/unbind events carry the dictionary flags and go only to `mon3.mon`.

```bash
POSTGRES_URL='postgres://mon3:secret@localhost:5432/mon3?sslmode=disable' \
JWT_SECRET='at-least-32-bytes-shared-by-all-three-services' \
STORE_XOR='the-same-store-xor-secret-as-java' \
RABBIT_HOST=localhost \
go run ./cmd/service-admin
```

Every route requires a valid `Authorization: Bearer` token; the seeded
`superadmin` exercises the full surface single-handedly, and `scripts/smoke-admin.sh`
drives it end to end.

## Routes (all under `/api/v1`)

### Access and dictionary

| Method | Path | Notes |
|---|---|---|
| GET | `/organizations`, `/organizations/` | List. |
| GET | `/organizations/{id}` | One organization + membership. |
| POST | `/organizations/{id}` | Create. Publishes ADD. |
| PUT | `/organizations/{id}` | Update (access). Publishes UPDATE with membership. |
| DELETE | `/organizations/{id}` | 404 when unknown. Publishes DELETE. |
| GET | `/org`, `/org/` | Dictionary list. |
| GET | `/org/{id}` | Dictionary item. |
| POST | `/org/{id}` | Rename. Publishes UPDATE_NAME. |
| GET | `/users`, `/users/` | Mirrored users (valid only). |

### Agent families — CRM (`/crm`), events (`/evt`), cameras (`/img`)

`{family}` below is one of `crm`, `evt`, `img`.

| Method | Path | Notes |
|---|---|---|
| GET | `/{family}/types`, `/{family}/types/`, also `/types` on all three | Agent types. |
| GET | `/{family}/agents`, `/{family}/agents/` | List. `?org=` filters; `?with_unbounded=` includes unbound. |
| GET/POST/PUT/DELETE | `/{family}/agents/{id}` | Full lifecycle. Create with `organizationId` binds immediately. |
| PUT | `/{family}/agents/{id}/unbind` | Unbind. Publishes UPDATE_*_BIND on mon3.mon. |
| PUT | `/{family}/agents/{id}/bind?org=` | Bind. Publishes UPDATE_*_BIND on mon3.mon. |
| GET | `/{family}/configs/{id}` | Config row (id == agent id). |

CRM-only (`/crm`): the binding is a `crm_organization_id` on the agent row;
`services` and `places` hang off that row.

### YClients (`/yc`)

| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/yc/configs/{id}` | Credentials (partner + user token, XOR-masked at rest, unmasked on read). |
| GET/PUT | `/yc/agents/{id}/organization` | External organization (name, timezone). |
| GET/PUT | `/yc/agents/{id}/service-categories` | Categories, preserving staff lists. |
| GET/POST | `/yc/agents/{id}/services` | Services for the agent. |
| PUT/DELETE | `/yc/agents/{agent}/services/{id}` | One service. |
| GET/POST | `/yc/agents/{id}/places` | Places. |
| PUT/DELETE | `/yc/agents/{agent}/places/{id}` | One place. |
| POST | `/yc/misc/get-token` | Exchange tenant token for partner/user tokens. |
| GET | `/yc/misc/agent/{id}/allowed-orgs` | Companies the credentials can see. |
| GET | `/yc/misc/agent/{id}/org/{org}/service-categories` | Raw upstream categories. |
| GET | `/yc/misc/agent/{id}/services` | Raw upstream services. |
| GET | `/yc/misc/agent/{id}/places` | Raw upstream places. |

### Macroscop (`/macroscop`)

| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/macroscop/evt-configs/{id}` / `/macroscop/img-configs/{id}` | Event/camera config links. |
| PUT | `.../bind?cfg=` | Link. Returns `{config: {…}}` with **unmasked** credentials (Java masked them). |
| PUT | `.../unbind` | Unlink. |
| GET/POST/PUT/DELETE | `/macroscop/configs`, `/macroscop/configs/` , `/macroscop/configs/{id}` | Server registration. |
| GET/PUT | `/macroscop/configs/{id}/channels` | Channel list. |
| GET | `/macroscop/misc/configs/{id}/server-info` | Cached server info. |
| GET | `/macroscop/misc/archive-modes` | Archive mode choices. |
| POST | `/macroscop/misc/server-info` | Probe a server by credentials. |
| GET | `/macroscop/misc/configs/{id}/channels` | Raw channels. |
| GET | `/macroscop/misc/configs/{id}/channels/{channelId}/current-screenshot` / `last-archive-screenshot` | Screenshots. |

### Test routes (permission probes)

`/test/public`, `/test/authenticated`, `/test/deviation/approve`,
`/test/deviation/check`, `/test/admin/system`, `/test/admin/org`,
`/test/dispatcher`, `/test/dispatcher/approve`, `/test/my-permissions`.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8082` | |
| `YCLIENTS_API_URL` | — | Upstream base for `/yc/misc/*`. |
| `YCLIENTS_API_TIMEOUT_MS` | `30000` | |
| `MACROSCOP_API_TIMEOUT_MS` | `15000` | |
| `STORE_XOR` | — | Credential masking key. Must match Java's stored rows. |
| `RABBIT_HOST` / `RABBIT_PORT` | `localhost` / `5672` | |
| `LOG_LEVEL` / `LOG_FORMAT` | `INFO` / `json` | |

Deliberate differences from the Java service are listed in `MIGRATION.md`
(sections "service-admin wire deviations", "Fixed defects").