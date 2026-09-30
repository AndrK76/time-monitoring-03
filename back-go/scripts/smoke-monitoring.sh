#!/usr/bin/env bash
# smoke-monitoring.sh — end-to-end check of service-monitoring.
#
# service-monitoring has no HTTP surface, so the checks drive service-admin
# (which publishes organization events) and read the mon.organizations mirror
# with psql. One extra event is published by hand through rabbitmqadmin to cover
# the self-healing bind path, which the admin flow never exercises.
#
# Usage:
#   ./scripts/smoke-monitoring.sh [BASE_URL] [SUPERADMIN_TOKEN]
#
# BASE_URL defaults to http://localhost:8082/api/v1 (service-admin).
# The token is required; it is what drives admin to publish events.

set -u
BASE="${1:-http://localhost:8082/api/v1}"
TOKEN="${2:-${TOKEN:-}}"

PSQL=(psql -h localhost -p 55432 -U mon3 -d mon3 -q -t -A)
PGQ() { PGPASSWORD=mon3 "${PSQL[@]}" -c "$1"; }
MON_Q() { PGQ "SELECT $1 FROM mon.organizations WHERE id = '$MON_ORG'"; }

FAIL=0
SUFFIX="$(date +%s)"
reqn() { # reqn METHOD PATH BODY  -> raw curl, no auth (for the hand-rolled event)
	curl -s -o /dev/null -w '%{http_code}' -X "$1" "$BASE$2" ${3:+-d "$3"} -H 'Content-Type: application/json'
}
req() { # req METHOD PATH BODY -> raw body of an authed request
	local body="${3:-}"
	if [[ -n "$body" ]]; then
		curl -s -X "$1" "$BASE$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$body" -w $'\n%{http_code}'
	else
		curl -s -X "$1" "$BASE$2" -H "Authorization: Bearer $TOKEN" -w $'\n%{http_code}'
	fi
}
jq_get() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1],{'d':d,'json':json}))" "$1" <<<"$BODY" 2>/dev/null; }
ok()   { printf 'ok   %-56s %s\n' "$1" "$2"; }
no()   { printf 'FAIL %-56s got %q want %q\n' "$1" "$2" "$3"; FAIL=1; }
check() { if [[ "$2" == "$3" ]]; then ok "$1" "$2"; else no "$1" "$2" "$3"; fi; }

echo "== target: $BASE"

if [[ -z "$TOKEN" ]]; then
	echo "FAIL no superuser token supplied; pass one as \$2 or set TOKEN"
	exit 1
fi

# A fresh organization for this run, so leftover state cannot mask a missed event.
BODY=$(req POST /access/organizations "{\"shortName\":\"mon-smoke-$SUFFIX\",\"fullName\":\"Monitoring smoke $SUFFIX\"}")
CODE=$(tail -1 <<<"$BODY"); BODY=$(sed '$d' <<<"$BODY")
check "create the organization (ADD event)" 201 "$CODE"
MON_ORG="$(jq_get "d['id']")"
check "  the row exists in the mirror"      "t" "$(MON_Q 'true')"
check "  the short name is stored"          "mon-smoke-$SUFFIX" "$(MON_Q 'short_name')"
check "  the full name is stored"           "Monitoring smoke $SUFFIX" "$(MON_Q 'full_name')"
check "  crm flag starts false"             "f" "$(MON_Q 'crm_agent_set')"
check "  event flag starts false"           "f" "$(MON_Q 'events_agents_set')"
check "  camera flag starts false"          "f" "$(MON_Q 'camera_agents_set')"
# The Java services stamped the user id, not the username, into the audit
# columns.
CB="$(MON_Q 'created_by')"
if [[ "$CB" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
	ok "  created_by records the caller's id" "$CB"
else
	no "  created_by records the caller's id" "$CB" "a user uuid"; FAIL=1
fi

# Dictionary rename publishes UPDATE_NAME.
BODY=$(req POST "/dict/org/$MON_ORG" "{\"shortName\":\"mon-renamed-$SUFFIX\",\"fullName\":\"Renamed $SUFFIX\"}")
CODE=$(tail -1 <<<"$BODY")
check "rename via the dictionary (UPDATE_NAME)" 200 "$CODE"
check "  the mirror follows the new name"       "mon-renamed-$SUFFIX" "$(MON_Q 'short_name')"

# A full access update publishes UPDATE with the fresh membership.
BODY=$(req PUT "/access/organizations/$MON_ORG" "{\"shortName\":\"mon-renamed-$SUFFIX\",\"fullName\":\"Updated full $SUFFIX\",\"updatedBy\":\"superadmin\"}")
CODE=$(tail -1 <<<"$BODY")
check "update via access (UPDATE)" 200 "$CODE"
check "  the mirror follows the full name" "Updated full $SUFFIX" "$(MON_Q 'full_name')"

# Bind an event agent: publishes UPDATE_EVT_BIND.
BODY=$(req POST /evt/agents '{"agentType":"Macroscop","name":"mon-evt"}')
CODE=$(tail -1 <<<"$BODY"); BODY=$(sed '$d' <<<"$BODY")
check "create an event agent" 201 "$CODE"
EVT_AGENT="$(jq_get "d['id']")"
req PUT "/evt/agents/$EVT_AGENT/bind?org=$MON_ORG" >/dev/null
check "  evt bind sets the event flag" "t" "$(MON_Q 'events_agents_set')"
req PUT "/evt/agents/$EVT_AGENT/unbind" >/dev/null
check "  evt unbind clears the event flag" "f" "$(MON_Q 'events_agents_set')"

# Bind a camera agent: publishes UPDATE_IMG_BIND. The Java consumer wrote the
# *event* flag into the camera column here; the Go consumer reads the camera
# field, so this is the assertion that would have failed against Java.
BODY=$(req POST /img/agents '{"agentType":"Macroscop","name":"mon-img"}')
CODE=$(tail -1 <<<"$BODY"); BODY=$(sed '$d' <<<"$BODY")
check "create a camera agent" 201 "$CODE"
IMG_AGENT="$(jq_get "d['id']")"
req PUT "/img/agents/$IMG_AGENT/bind?org=$MON_ORG" >/dev/null
check "  img bind sets the camera flag" "t" "$(MON_Q 'camera_agents_set')"
check "  the event flag is untouched by the img event" "f" "$(MON_Q 'events_agents_set')"
req PUT "/img/agents/$IMG_AGENT/unbind" >/dev/null
check "  img unbind clears the camera flag" "f" "$(MON_Q 'camera_agents_set')"

# Hand-rolled bind event for an organization the mirror has never seen: unlike
# Java (NOT NULL violation, event dropped), the row is recreated with names.
UNKNOWN_ORG="11111111-1111-1111-1111-111111111111"
PAYLOAD=$(python3 - <<'PY'
import json
print(json.dumps({
    "commandId": "probe-1",
    "commandType": "ORGANIZATION_INFO_CHANGED",
    "payload": {
        "orgId": "11111111-1111-1111-1111-111111111111",
        "mode": "UPDATE_EVT_BIND",
        "shortName": "self-healed",
        "fullName": "Self-healed org",
        "updatedAt": "2026-09-29T10:00:00",
        "updatedBy": "probe",
        "users": None,
        "crmAgentSet": True,
        "eventAgentsSet": True,
        "cameraAgentsSet": True,
    },
    "userContext": None,
    "timestamp": None,
    "sourceService": "probe",
    "correlationId": "probe-1",
}))
PY
)
docker exec mon3-rabbit rabbitmqadmin -u mon3 -p mon3 publish \
	exchange=mon3.exchange routing_key=mon3.mon payload="$PAYLOAD" >/dev/null
sleep 1
ROW=$(PGQ "SELECT '('||short_name||','||events_agents_set||')' FROM mon.organizations WHERE id='$UNKNOWN_ORG'")
check "  a bind event recreates a missing row" "(self-healed,true)" "$ROW"

# A command the listener does not know must be acknowledged without crashing.
docker exec mon3-rabbit rabbitmqadmin -u mon3 -p mon3 publish \
	exchange=mon3.exchange routing_key=mon3.mon \
	payload='{"commandId":"probe-2","commandType":"SOMETHING_UNKNOWN","payload":{},"sourceService":"probe","correlationId":"probe-2"}' >/dev/null
sleep 1
check "  an unknown command type is ignored" "0" "$(grep -c 'panic\|ERROR' /tmp/mon3-mon.log || true)"

# Delete the organization: the mirror row goes with it.
BODY=$(req DELETE "/access/organizations/$MON_ORG")
CODE=$(tail -1 <<<"$BODY")
check "delete the organization (DELETE event)" 204 "$CODE"
LEFT="$(PGQ "SELECT count(*) FROM mon.organizations WHERE id='$MON_ORG'")"
check "  the mirror row is deleted" "0" "$LEFT"

# Clean up the hand-rolled row and agents.
PGQ "DELETE FROM mon.organizations WHERE id='$UNKNOWN_ORG'" >/dev/null
req DELETE "/evt/agents/$EVT_AGENT" >/dev/null
req DELETE "/img/agents/$IMG_AGENT" >/dev/null

if [[ "$FAIL" == 0 ]]; then
	echo "smoke: all checks passed"
else
	echo "smoke: FAILURES present"
	exit 1
fi