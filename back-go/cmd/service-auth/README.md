# service-auth

Authentication, users, roles, permissions, organizations. Owns the `auth`
PostgreSQL schema, listens on **8083**.

Publishes `USER_CREATED`, `USER_INFO_UPDATED` and `ORGANIZATION_INFO_CHANGED` to
`mon3.admin`. Declares `mon3-auth-queue` but attaches no consumer: the
organization dictionary is owned by `service-admin` and mirrored into the `mon`
schema, so there is nothing for this service to apply.

```bash
POSTGRES_URL='postgres://mon3:secret@localhost:5432/mon3?sslmode=disable' \
JWT_SECRET='at-least-32-bytes-shared-by-all-three-services' \
STORE_XOR='the-same-store-xor-secret-as-java' \
RABBIT_HOST=localhost \
go run ./cmd/service-auth
```

## Routes

All under `/api/v1`. Every route except the four marked public requires a valid
`Authorization: Bearer` token or a valid `auth_token` cookie.

### Authentication

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | public. Sets the `auth_token` cookie. |
| POST | `/auth/register` | public. Creates an **inactive, unapproved** account. |
| POST | `/auth/refresh` | public. Accepts the token in the body or the cookie. |
| POST | `/auth/logout` | public. Blacklists the token, clears the cookie. |
| GET | `/auth/check` | Cheap validity probe. |
| GET | `/auth/me` | Current user. Reports `superUser`. |
| GET | `/auth/anonymous` | The anonymous placeholder. 409 if authenticated. |

`/auth/login`, `/auth/register` and `/auth/refresh` answer failures with the
login envelope (`code`, `message`, `locale`, …) rather than a problem document,
because the login form renders `message` directly. Everything else uses RFC 9457.

### Current user

| Method | Path | Notes |
|---|---|---|
| PUT | `/users/me` | Personal fields only. Roles and flags in the body are ignored. |
| POST | `/users/me/change-password` | Requires the current password. |
| GET | `/users/me/telegram-token` | The caller's own magic link. |
| POST | `/users/me/telegram-token` | Mints a new one, invalidating any previous. |
| DELETE | `/users/me/telegram-token` | Invalidates all live tokens. |

### Users

| Method | Path | Notes |
|---|---|---|
| GET | `/users` | Scoped to the caller's organizations. |
| POST | `/users` | `SUPERUSER` only. |
| GET | `/users/{id}` | Scoped. |
| PUT | `/users/{id}` | Scoped. Approval cannot be revoked. |
| DELETE | `/users/{id}` | Scoped. Refuses self-deletion. |
| PUT | `/users/{id}/reset-password` | Scoped. Empty body uses `DEFAULT_PASSWORD`. |
| PUT | `/users/{id}/roles` | Scoped. 400 on an unknown role name. |
| GET | `/users/{id}/telegram-token` | Scoped. Link only for the owner. |

### Roles, permissions, organizations

| Method | Path | Notes |
|---|---|---|
| GET | `/roles` | |
| GET | `/roles/with-permissions` | |
| GET | `/roles/{id}` | |
| POST | `/roles` | `SUPERUSER` only. |
| PUT | `/roles/{id}` | `SUPERUSER` only. |
| DELETE | `/roles/{id}` | `SUPERUSER` only. 409 while assigned. |
| GET | `/permissions` | |
| GET | `/organizations` | Scoped. |
| GET | `/organizations/{id}` | Scoped. |
| PUT | `/organizations/{id}/users` | `SUPERUSER` only. |

## Not exposed

Two Java endpoints are deliberately absent. Both are in MIGRATION.md under
"Removed endpoints".

- `POST /admin/update-password` — an unauthenticated password write.
- The OAuth2 paths — they always threw `UnsupportedOperationException`.

## Access model

`isSuperUser` is the `SUPERUSER` permission, not a role name.
`isAllowedAllOrganizations` is `ANY_ORG_ALLOW` or `SUPERUSER`.
`isAllowedAllActions` is `ANY_ACTION_ALLOW` or `SUPERUSER`.

A user-management operation requires the caller to share an organization with
the target, and a non-superuser may not edit a superuser. `ANY_ORG_ALLOW` and
`ANY_ACTION_ALLOW` are seeded as special permissions but not granted to any role
by the migrations, so out of the box no account has them; only the seeded
`superadmin` holds `SUPERUSER`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_URL` | — | Required. |
| `JWT_SECRET` | dev placeholder | Shared by all three services. Determines the algorithm by length. |
| `JWT_EXPIRATION` | `86400000` (ms) | Access-token TTL, and the cookie's `Max-Age`. |
| `JWT_REFRESH_EXPIRATION` | `604800000` (ms) | Refresh-token TTL. |
| `COOKIE_DOMAIN` | `crm.host` | |
| `COOKIE_SECURE` | `false` | |
| `RABBIT_HOST` / `RABBIT_PORT` | `localhost` / `5672` | |
| `DEFAULT_PASSWORD` | — | Used by `PUT /users/{id}/reset-password` with an empty body. |
| `TELEGRAM_TOKEN_TTL_MS` | `300000` | Magic-link lifetime. |
| `LOG_LEVEL` / `LOG_FORMAT` | `INFO` / `json` | |
