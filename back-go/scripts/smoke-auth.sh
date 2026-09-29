#!/usr/bin/env bash
# Live smoke test for service-auth against the docker stack.
#
# Exercises the routes the Angular front-end depends on, in the order a browser
# would: anonymous probe, register, login, /me, then a management call that
# proves the token's roles and organizations survived the round trip.
#
# Usage: docker/.smoke-auth.sh [base-url]
set -uo pipefail

BASE="${1:-http://localhost:8083/api/v1}"
JAR="$(mktemp)"
FAIL=0

req() { # req METHOD PATH [BODY] -> sets CODE and BODY
	local method="$1" path="$2" body="${3:-}"
	local args=(-s -o "$JAR" -w '%{http_code}' -X "$method" "$BASE$path" -H 'Accept: application/json')
	[[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
	[[ -n "${TOKEN:-}" ]] && args+=(-H "Authorization: Bearer $TOKEN")
	CODE=$(curl "${args[@]}")
	BODY=$(cat "$JAR")
}

check() { # check LABEL EXPECTED ACTUAL
	if [[ "$2" == "$3" ]]; then
		printf 'ok   %-42s %s\n' "$1" "$3"
	else
		printf 'FAIL %-42s got %s want %s\n' "$1" "$3" "$2"
		FAIL=1
	fi
}

jq_get() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1],{'d':d,'json':json}))" "$1" <<<"$BODY" 2>/dev/null; }

echo "== target: $BASE"

# --- unauthenticated -----------------------------------------------------
req GET /auth/anonymous
check "GET /auth/anonymous" 200 "$CODE"
check "  anonymous id" "00000000-0000-0000-0000-000000000000" "$(jq_get "d['id']")"

req GET /auth/me
check "GET /auth/me without token" 401 "$CODE"

req GET /users
check "GET /users without token" 401 "$CODE"

# --- login with the seeded account, which has no password ---------------
req POST /auth/login '{"username":"superadmin","password":""}'
check "POST /auth/login blank password is 400" 400 "$CODE"

# --- register ------------------------------------------------------------
SUFFIX="$$"
req POST /auth/register "{\"username\":\"smoke$SUFFIX\",\"email\":\"smoke$SUFFIX@example.test\",\"password\":\"secret123\",\"firstName\":\"Smoke\",\"displayName\":\"Smoke Test\"}"
check "POST /auth/register" 201 "$CODE"
REGISTERED_ID="$(jq_get "d['id']")"

# A registered account must not be able to log in: it starts inactive.
req POST /auth/login "{\"username\":\"smoke$SUFFIX\",\"password\":\"secret123\"}"
check "POST /auth/login unapproved account is 401" 401 "$CODE"
check "  code" "DISABLED" "$(jq_get "d['code']")"

# A duplicate username must be refused, not silently accepted.
req POST /auth/register "{\"username\":\"smoke$SUFFIX\",\"email\":\"other$SUFFIX@example.test\",\"password\":\"secret123\",\"firstName\":\"Smoke\",\"displayName\":\"Smoke Test\"}"
check "POST /auth/register duplicate" 409 "$CODE"

# --- give the account a working password and activate it, as an admin would.
# The seed creates every account without a password, so the only way to reach a
# logged-in state on a fresh database is to write the hash directly, the way an
# admin's reset-password call would.
# The services each own one schema and connect as that schema's role; the
# superuser session psql gets here has no search_path set, so the schema is
# named explicitly.
PG=(docker exec mon3-pg psql -q -U mon3 -d mon3 -v ON_ERROR_STOP=1)
docker exec mon3-pg psql -q -U mon3 -d mon3 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto" >/dev/null 2>&1
"${PG[@]}" -c "SET search_path TO auth, public;
	UPDATE users SET password = crypt('secret123', gen_salt('bf', 10)), is_active = TRUE
	WHERE username = 'smoke$SUFFIX'" >/dev/null

# --- login for real ------------------------------------------------------
req POST /auth/login "{\"username\":\"smoke$SUFFIX\",\"password\":\"secret123\"}"
check "POST /auth/login active account" 200 "$CODE"
TOKEN="$(jq_get "d['accessToken']")"
REFRESH="$(jq_get "d['refreshToken']")"
check "  expiresIn is milliseconds" "86400000" "$(jq_get "d['expiresIn']")"
check "  starts inactive-suppressed" "False" "$(jq_get "d['user']['superUser']")"

# --- cookie was set ------------------------------------------------------
COOKIE=$(curl -s -o /dev/null -D - -X POST "$BASE/auth/login" \
	-H 'Content-Type: application/json' \
	-d "{\"username\":\"smoke$SUFFIX\",\"password\":\"secret123\"}" | grep -i '^set-cookie: auth_token=' || true)
if [[ -n "$COOKIE" ]]; then
	printf 'ok   %-42s %s\n' "login sets the auth_token cookie" "yes"
else
	printf 'FAIL %-42s missing\n' "login sets the auth_token cookie"
	FAIL=1
fi

# --- authenticated -------------------------------------------------------
req GET /auth/me
check "GET /auth/me" 200 "$CODE"
check "  userId matches" "$REGISTERED_ID" "$(jq_get "d['id']")"

req GET /auth/check
check "GET /auth/check" 200 "$CODE"

req GET /roles
check "GET /roles" 200 "$CODE"
check "  seeded role present" "True" "$(jq_get "'ROLE_SYSTEM_ADMIN' in [r['name'] for r in d]")"

req GET /permissions
check "GET /permissions" 200 "$CODE"

req GET /organizations
check "GET /organizations" 200 "$CODE"

req GET /users
check "GET /users" 200 "$CODE"

# A management call on a user outside the caller's organizations is refused,
# not found and not a 500.
req GET "/users/ffffffff-ffff-ffff-ffff-ffffffffffff"
if [[ "$CODE" == "403" || "$CODE" == "404" ]]; then
	printf 'ok   %-42s %s\n' "GET /users/{unknown} is 403/404" "$CODE"
else
	printf 'FAIL %-42s got %s want 403 or 404\n' "GET /users/{unknown}" "$CODE"
	FAIL=1
fi

# --- token hygiene -------------------------------------------------------
req GET /auth/me -H "Authorization: Bearer $REFRESH" 2>/dev/null
CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/auth/me" -H "Authorization: Bearer $REFRESH")
check "refresh token rejected as a bearer" 401 "$CODE"

CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/auth/me" -H "Authorization: Bearer not.a.token")
check "malformed token rejected" 401 "$CODE"

# alg=none, the classic JWT bypass.
FORGED=$(python3 - <<'PY'
import base64, json
def seg(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b'=').decode()
print(seg({"alg":"none","typ":"JWT"}) + "." + seg({"userId":"x","sub":"superadmin","permissions":["SUPERUSER"]}) + ".")
PY
)
CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/auth/me" -H "Authorization: Bearer $FORGED")
check "alg=none token rejected" 401 "$CODE"

# --- refresh -------------------------------------------------------------
CODE=$(curl -s -o "$JAR" -w '%{http_code}' -X POST "$BASE/auth/refresh" \
	-H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}")
check "POST /auth/refresh" 200 "$CODE"
NEWTOKEN=$(python3 -c "import json;print(json.load(open('$JAR'))['accessToken'])" 2>/dev/null)
CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/auth/me" -H "Authorization: Bearer $NEWTOKEN")
check "  refreshed token authenticates" 200 "$CODE"

# --- logout --------------------------------------------------------------
CODE=$(curl -s -o "$JAR" -w '%{http_code}' -X POST "$BASE/auth/logout" -H "Authorization: Bearer $NEWTOKEN")
check "POST /auth/logout" 204 "$CODE"
CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/auth/me" -H "Authorization: Bearer $NEWTOKEN")
check "  revoked token is rejected" 401 "$CODE"

# --- routes that are deliberately absent ---------------------------------
CODE=$(curl -s -o "$JAR" -w '%{http_code}' -X POST "$BASE/admin/update-password" \
	-H 'Content-Type: application/json' -d '{"username":"superadmin","newPassword":"owned"}')
check "POST /admin/update-password is gone" 404 "$CODE"

# Prove the account above was not taken over by that call.
req POST /auth/login '{"username":"superadmin","password":"owned"}'
check "superadmin password unchanged" 401 "$CODE"

rm -f "$JAR"
echo
if [[ "$FAIL" == 0 ]]; then
	echo "smoke: all checks passed"
else
	echo "smoke: FAILURES present"
fi
exit "$FAIL"
