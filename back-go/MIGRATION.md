# MIGRATION.md — Java → Go backend

The Go backend lives in `back-go/`. The Java implementation in `back/` is kept
untouched on this branch as the reference for behaviour; it is not built or run
by the Go compose file.

Three services, same ports, same schemas, same queues, same wire format:

| Service | Port | Schema | Queue | HTTP source |
|---|---|---|---|---|
| `service-monitoring` | 8081 | `mon` | `mon3-monitoring-queue` | none (bus only) |
| `service-admin` | 8082 | `admin` | `mon3-admin-queue` | `app-admin` |
| `service-auth` | 8083 | `auth` | `mon3-auth-queue` | `shared-auth` |

No front-end change is required. The Angular apps still call
`http://crm.host:8083/api/v1` and `http://crm.host:8082/api/v1`.

## Running

```bash
cd docker
cp .env.example .env      # if it does not exist yet
docker compose up -d mon3-pg mon3-rabbit

cd ../back-go
POSTGRES_URL='jdbc:...' -> see below
```

Configuration resolution is unchanged in spirit from the Spring setup: optional
`.properties` files are read first (`../.properties`, `./.properties`,
`./<service>/.properties`), then the environment wins.

```bash
export POSTGRES_URL='postgres://mon3:secret@localhost:5432/mon3?sslmode=disable'
export JWT_SECRET='at-least-32-bytes-shared-by-all-three-services'
export STORE_XOR='the-same-store-xor-secret-as-java'
export RABBIT_HOST=localhost
go run ./cmd/service-auth        # :8083
go run ./cmd/service-admin       # :8082
go run ./cmd/service-monitoring  # :8081, no HTTP
```

`JWT_SECRET` must be byte-identical across all three services, or tokens minted
by one will be rejected by the others. `STORE_XOR` likewise: it is the key for
the credential masking, so a mismatch makes stored Macroscop and YClients
credentials unreadable.

## Database

The 28 Flyway migration scripts are copied verbatim into
`back-go/internal/migrations/sql/{auth,admin,mon}/` and embedded into the
binaries. No SQL was rewritten, so the schema, column names, constraints, and
seed data are identical.

The Go runner adopts a database that Flyway already migrated rather than
re-running it. It reads `flyway_schema_history` — Flyway 10's default table name,
the same one the Java services used — and skips any version already recorded.

Two deliberate differences from Flyway:

- **Checksums are recorded but never compared.** Go computes an FNV-1a hash and
  Flyway computes a CRC32; comparing them would fail every adopted database on
  first boot. The version number is the contract, the checksum is diagnostic.
- **Each script runs in its own transaction**, so a failure leaves the history
  ledger and the schema consistent with each other. Flyway by default runs a
  whole migration *file* per transaction too, but not across files.

`admin` schema history has a gap: `V01.13` does not exist in the repository.
Flyway tolerates it, and so does this runner. If `V01.13` ever appears, its
version sorts into the correct position and it will apply then.

## Preserved behaviour

### JWT

Algorithm is chosen from the secret's length the way jjwt does: 64+ bytes HS512,
48+ HS384, otherwise HS256. Tokens minted by the Java services verify here and
vice versa.

Access-token claims: `userId`, `roles[]`, `permissions[]`,
`allowedOrganizations[]`, `sub`, `iat`, `exp`. A permission reachable through two
roles appears twice, because the Java builder did not de-duplicate. Authorisation
is a membership test, so duplicates are harmless; they are kept so the token
bytes stay equivalent.

Refresh-token claims: `userId`, `type="refresh"`, `sub`, `iat`, `exp`.

Access TTL 24h, refresh TTL 7d. No `jti`, no `kid`, no key rotation.

### Token source and cookie

`Authorization: Bearer <t>` first (the prefix match is case-sensitive, as in
Java), then the `auth_token` cookie. The cookie is `HttpOnly`, `path=/`, domain
from `COOKIE_DOMAIN` (default `crm.host`), `secure` from `COOKIE_SECURE` (default
false), `Max-Age` equal to the access-token TTL, and no `SameSite` — leaving the
browser on its Lax default, which is what makes the cross-subdomain SSO work.

Only `service-auth` reads the cookie. It is the only service that issues it; the
admin and monitor front-ends present it to the other two as an `Authorization`
header, which is what their Java `CookieServiceBase` read.

### Error format

Both shapes are reproduced, because the front-end branches on them:

- **Problem document** (`application/problem+json`) for everything except the
  login routes: `type`, `title`, `status`, `detail`, `timestamp`, `instance`.
- **Login envelope** for authentication failures on the login routes:
  `timestamp`, `path`, `username`, `locale`, `status`, `error`, `code`,
  `message`. `code` is the Java exception name minus `Exception`, uppercased,
  which is why some values look truncated: `INTERNALSERVIC` is
  `InternalAuthenticationServiceException` with the last nine characters
  removed. The names are fixed as constants rather than derived from Go type
  names, so the wire contract cannot drift with refactoring.

Localized messages match
`org/springframework/security/messages_ru.properties`, since the front-end
renders `message` directly.

### Crypto and encoding

- Passwords: BCrypt, cost 10, same as `BCryptPasswordEncoder` defaults.
- `Md5Hasher`: MD5 over UTF-8 as lowercase hex. Nil or blank input yields `""`,
  not the digest of the empty string.
- `XorCipher`: repeating-key XOR then standard padded Base64. This is masking,
  not encryption; it is reproduced byte-for-byte so previously stored rows stay
  readable. Decrypt returns its input unchanged on a decode failure rather than
  erroring, matching the Java swallow.
- Timestamps: `LocalDateTime` on the wire, no offset, with the fraction omitted
  when zero and otherwise rendered as exactly 3, 6, or 9 digits. `time.RFC3339`
  is not wire-compatible and is not used.

### Message bus

Exchange `mon3.exchange` (topic, durable), queues `mon3-{auth,admin,monitoring}-queue`
(durable), routing keys `mon3.{auth,admin,mon}`. Command bodies are the same
`CommandMessageDto` envelope, so Java and Go instances can share a broker during
a rolling migration.

`commandId` and `correlationId` are the same random UUID v4, as in Java.

Listener failure handling is faithful by default: a handler that throws is
logged and the message is acknowledged, so the message is consumed even though
the handler failed — which is what the Java listeners did, and which is why the
configured retry never engaged there. Pass `swallowErrors=false` to opt into the
retry policy instead. The retry parameters (3 attempts, exponential backoff) are
read from configuration either way.

### Command publishing

A broker outage does not fail a business transaction. `App.Publish` logs and
returns; a service also starts successfully with no broker, and logs a warning
that commands will be dropped. The Java services required RabbitMQ at boot;
making it hard was a local-development cost with no operational benefit.

## Fixed defects

These were bugs in the Java code. Each is a behaviour change, deliberate, and
listed here so nobody has to reverse-engineer why the two implementations
disagree.

### Removed endpoints

**`POST /api/v1/admin/update-password` is not exposed.** In Java it accepted an
unauthenticated request carrying a username and a new password, and wrote the
password. On any host reachable from the network that is account takeover, and
`superadmin` is a seeded account. If password reset is genuinely needed, add an
endpoint that requires `SUPERUSER` and mails a one-time link.

**The OAuth2 endpoints are not exposed.** `OAuth2Controller` threw
`UnsupportedOperationException` from every method, so those paths always
returned 500.

### Authorization

**`DELETE /users/{id}` refuses self-deletion.** Java let a user delete their own
account, including the last superuser.

**`DELETE /roles/{id}` returns 409 when the role is still assigned.** Java
deleted unconditionally; the join row cascaded and silently stripped permissions
from accounts that were mid-edit.

**`PUT /users/{id}` cannot revoke approval.** The Java code assigned
`isApproved` from the request, so a request with `userApproved: false` stripped
approval. Approval is now one-way: `is_approved = is_approved OR COALESCE($9, FALSE)`.

**`PUT /users/{id}/roles` rejects unknown role names with 400.** Java dropped
them silently, so an administrator could believe a permission had been granted
when it had not.

**`GET /users/{id}/telegram-token` returns the magic link only to its owner.**
For anyone else the response says whether a live token exists, with the secret
stripped. A magic link is a bearer credential.

**`PUT /organizations/{id}/users` requires `SUPERUSER`.** Java had no
authorization check on it at all, so any authenticated caller could rewrite an
organization's membership, including their own, and thereby grant themselves
access to another organization's data.

**A deleted or unknown user returns 404 rather than 500.** Java relied on
`EmptyResultDataAccessException` escaping to the catch-all handler.

### Correctness

**A refresh token cannot authenticate an API call.** The two token kinds share a
signing key and a valid expiry, and a refresh token's claims decode cleanly into
the access-token claim set, so signature and expiry checks alone do not separate
them. The refresh discriminator is now checked explicitly. In Java this was
masked because the token claims were not the source of truth — the user was
re-read from the database on every request — so the gap was not exploitable
there, but it was one refactor away from being so.

**Self-registered accounts start inactive.** Java created them active but
unapproved, so a new account could reach an authenticated endpoint during the
window between registration and approval. Approval now actually gates access.

**Unknown organizations are rejected rather than dereferenced.** In the Java
`EvtManageService` and `ImgManageService`, an `assert org != null` was disabled
by default, so a null organization produced an NPE and a 500.

**Binding an agent publishes the event after the flag is written.** The Java
evt/img `_bindAgent` published the organization event while `eventAgentsSet` was
still `false`, so the consumer's view was stale. See the `service-admin` section
of this file for the same class of fix in the agent services.

**`CrmManageService.deleteAgent` handles a missing `crm_organization_id`.** The
Java version dereferenced a null and produced a 500.

**`AccessModelMapper` returns real values.** It always returned
`approved=false`, `roles=null`, `organizations=null`; the Go version resolves the
actual access state.

**`TelegramTokenService` is reachable.** Java had the service with no endpoint
calling it. The endpoints exist here, and the store and TTL were already in the
schema. Note the issued token is not *redeemable*: there is no Telegram bot in
this port to consume it. It is issued and rotatable, not a working login path.

**`USER_INFO_UPDATED` partial events no longer blank the mirror.** The auth
service publishes a partial event when only some profile fields change; the Java
mapper copied the absent fields as null, so the admin mirror lost the previous
values. Partial events now skip absent fields (`COALESCE` on the upsert).

**Agent and delegate lists sort missing descriptions last.** `Comparator.comparing(...)`
on a null description threw an NPE and the whole list failed to render; the Go
comparator orders nulls after present values.

**`POST /yc/agents/{id}/service-categories` keeps the staff lists.** Java
re-checked `categories.isSuccess()` where it meant `staffs.isSuccess()` (copy
paste), so a failing staffs fetch was reported as a failing categories fetch and
places silently lost their staff filters.

**The YClients organization row records `yc_id`.** The Java
`CrmManageService.updateOrganization` never assigned `yc_id` after creating the
external-organization row, so a renamed company kept the id of the previous one.
The Go upsert writes it.

**DELETE of an unknown agent, config or organization returns 404.** Java called
`deleteById(...)` unconditionally; an unknown id surfaced as a 500 (through
`EmptyResultDataAccessException` or an NPE). The Go paths report a 404 with the
same message shape the corresponding GET uses.

### Robustness

**The logout blacklist is trimmed.** Java kept an unbounded map, so memory grew
with total logouts ever performed. Entries are now dropped once the token would
be rejected anyway.

**The blacklist records the token's expiry**, so the trim above can be exact
rather than guessing a maximum lifetime.

## service-admin wire deviations

These are deliberate differences from the Java service on this branch. The Java
wire format was reconstructed from the controllers and the front-end, and where
a Java detail was clearly accidental it was not reproduced when the front-end
could not depend on it.

**`bindEvtConfig` and `bindImgConfig` return unmasked credentials.** The Java
methods returned the stored XOR-masked credentials back to a client that had
just sent them; anything that reads the response as the server's own state would
have had to unmask again. The Go methods return the plain values. The bind-and-
read flow (`GET` after `PUT`) is unaffected: reads are unmasked in both.

**Organization events are published after the transaction commits.** Java
published inside the transaction, from `_bindAgent`/`_unbindAgent` and the
create/update/delete methods, so a rollback left consumers with an event the
writer never durably stored. Go collects the events and publishes once the
transaction has committed (see "Binding an agent publishes the event after the
flag is written" above for the flag-ordering half of the same fix).

**Events carry the real agent-set flags.** The Java command mapper declared all
three agent flags `@Mapping(ignore = true)`, so every published event carried
`false` and each consumer's copy of the flags was reset to false on every
update. The Go `OrgChangeEvent` carries the organization's current flags, which
is the only value the consumers can converge on.

## service-monitoring

The monitoring service in Go is the same shape as the Java one, trimmed to what
the Java service actually did:

- **No routes.** The Java application had a security chain and actuator but no
  controllers, so every path answered 404 (or actuator's own JSON). The Go
  binary registers no routes and answers the shared JSON 404 on 8081.
- **Bus only.** It consumes `ORGANIZATION_INFO_CHANGED` on `mon3.mon` and keeps
  the `mon.organizations` mirror. Everything it stores is a projection of what
  service-admin publishes; there is no other writer.
- **Faithful mode handling.** The `ADD`/`UPDATE`/`UPDATE_NAME` branch writes
  names and the created or updated group exactly as the Java handler did;
  `DELETE` drops the row (a missing row is not an error, matching Spring Data's
  `deleteById`); each bind mode writes one flag plus the updated group.
- **Errors are logged, not thrown.** The Java handler swallowed every exception
  and the listener acknowledged every message, so a poison message was consumed
  and discarded; the Go consumer does the same (`swallowErrors=true`).

Fixed in the port (see "Fixed defects", "Correctness"):

- **`UPDATE_IMG_BIND` reads the camera flag.** Java wrote
  `eventAgentsSet` into the camera column, so the camera flag followed the
  *event* flag's value whenever the two diverged.
- **A bind event for an unknown organization recreates the row.** Java inserted
  a row whose names were null, hit the NOT NULL constraint, caught the error,
  and dropped the event, so a bind that arrived before its ADD (a service that
  was down on the ADD) was lost forever. The events carry the names, so the Go
  upsert uses them.

## Known limitations, inherited

These are properties of the original design that the port reproduces. They are
not fixed because fixing them is a design change, not a rewrite.

- **The logout blacklist is per-process.** Logout on one instance does not revoke
  a token on another, and the list is lost on restart, so a revoked token is
  accepted again until it expires. A shared store (Redis) is the fix; Redis is
  present in `docker/docker-compose.yml` but commented out everywhere in the
  Java configuration, so nothing currently depends on it.
- **`XorCipher` is not encryption.** It keeps credentials out of plain sight in
  the database and nothing more. Both `JWT_SECRET` and `STORE_XOR` must be strong
  regardless.
- **`SweepBlacklist` needs a single process to run.** Each instance trims its own
  map, which is fine; there is no coordination and none is needed.
- **`V01.13` is missing** from the `admin` migration history. Harmless, but the
  numbering has a hole in it.

## Layout

```
back-go/
  cmd/
    service-auth/         :8083
    service-admin/        :8082
    service-monitoring/   :8081
  internal/
    app/         shared wiring: config, pool, migrations, JWT, CORS, server, publisher
    authsvc/     service-auth domain: users, roles, permissions, organizations
    authhttp/    service-auth routes
    common/      wire types, command envelope, md5, xor, LocalDateTime
    config/      .properties + environment resolution
    db/          pool, transactions, query helpers
    httpx/       problem documents, login envelope, CORS, router, server
    logging/     slog setup
    migrations/  the 28 SQL scripts, embedded, Flyway-compatible runner
    rabbit/      AMQP transport, command envelope, retry policy
    security/    JWT, request context, access rules, cookie
    validate/    the Bean Validation subset the DTOs use
```

`service-admin` and `service-monitoring` follow the same split: domain packages
(`adminsvc`, `monsvc`) plus a route package (`adminhttp`) where routes exist —
the monitoring service has no routes, only a command consumer.

## Tests

```bash
go test ./...
```

Coverage is concentrated where a mistake would be silent and expensive: the JWT
algorithm negotiation and the access-token/refresh-token separation, the
credential masking round trip against rows written by Java, the command
envelope round trip between the three services, and the `LocalDateTime` wire
format, whose difference from `time.RFC3339` is invisible until a client parses
a timestamp.

The end-to-end smoke scripts drive a live stack and are the fastest way to
verify a behaviour claim that the unit tests do not cover:

```bash
# needs mon3-pg on :55432 and mon3-rabbit, plus the three binaries running
./scripts/smoke-auth.sh http://localhost:8083/api/v1
./scripts/smoke-admin.sh http://localhost:8082/api/v1 <superadmin-token>
./scripts/smoke-monitoring.sh http://localhost:8082/api/v1 <superadmin-token>
```
