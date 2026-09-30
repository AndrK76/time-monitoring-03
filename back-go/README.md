# back-go — the Go backend for time-monitoring-03

A faithful reimplementation of the Java services in `back/` (which is kept
untouched as the behavioural reference). Same ports, same `auth`/`admin`/`mon`
schemas, same RabbitMQ queues and command envelope, same JSON wire format —
including the error shapes the Angular front-ends parse. The front-end does not
change.

| Service | Port | Schema | Queue | What it is |
|---|---|---|---|---|
| `service-monitoring` | 8081 | `mon` | `mon3-monitoring-queue` | Bus-only org-dictionary mirror |
| `service-admin` | 8082 | `admin` | `mon3-admin-queue` | Org dictionary, access, agents, YClients + Macroscop |
| `service-auth` | 8083 | `auth` | `mon3-auth-queue` | Users, roles, permissions, JWT, org membership mirror |

## Layout

```
cmd/service-auth/         entrypoint: HTTP on 8083 + bus consumer
cmd/service-admin/        entrypoint: HTTP on 8082 + bus consumer (user events)
cmd/service-monitoring/   entrypoint: bus-only on 8081
internal/app/             shared wiring: config, pool, migrations, JWT, CORS, server, publisher
internal/authsvc|authhttp service-auth (domain, HTTP)
internal/adminsvc|adminhttp  service-admin (domain, HTTP)
internal/monsvc           service-monitoring (bus consumer only)
internal/common/          shared wire types and helpers (LocalDateTime, XOR, MD5, command envelope)
internal/config/          .properties + environment resolution
internal/db/              pgx pool, transactions, nullable-column helpers
internal/httpx/           problem documents, login envelope, CORS, router, server
internal/migrations/      the 28 Flyway SQL files, embedded, Flyway-compatible runner
internal/rabbit/          AMQP transport, command envelope, retry policy
internal/security/        JWT, request context, access rules, cookie
internal/validate/        the Bean Validation subset the DTOs use
```

See `MIGRATION.md` for everything that differs from Java and why: fixed
defects, deliberate deviations, and inherited behaviour worth knowing.

## Running

Requirements: PostgreSQL (the `docker/postgres` image creates the three roles
and schemas — `mon3_admin` cannot create its own schema), RabbitMQ, Go ≥ 1.22.

```bash
cd docker && docker compose up -d mon3-pg mon3-rabbit && cd ..

export POSTGRES_URL='postgres://mon3:secret@localhost:5432/mon3?sslmode=disable'
export JWT_SECRET='at-least-32-bytes-shared-by-all-three-services'
export STORE_XOR='the-same-store-xor-secret-as-java'
export RABBIT_HOST=localhost

go run ./cmd/service-auth         # :8083, issues tokens
go run ./cmd/service-admin        # :8082
go run ./cmd/service-monitoring   # :8081, no HTTP routes
```

`JWT_SECRET` and `STORE_XOR` must be byte-identical across all three services
(and, for `STORE_XOR`, identical to the value the Java services used, or
previously stored credentials are unreadable).

## Verification

```bash
go test ./...                     # unit tests
./scripts/smoke-auth.sh http://localhost:8083/api/v1
./scripts/smoke-admin.sh http://localhost:8082/api/v1 <superadmin-token>
./scripts/smoke-monitoring.sh http://localhost:8082/api/v1 <superadmin-token>
```

The smoke scripts run against a live stack and are the contract check: they
assert exact status codes, JSON shapes and database rows for every route and
every bus event mode. A fresh service-admin install needs the `admin` schema
owned by `mon3_admin` (`CREATE SCHEMA admin AUTHORIZATION mon3_admin;` drops
are not something that role can do).