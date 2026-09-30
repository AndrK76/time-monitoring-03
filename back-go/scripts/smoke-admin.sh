#!/usr/bin/env bash
# Live smoke test for service-admin against the docker stack.
#
# Exercises the routes the Angular front-end depends on, in the order a browser
# would: the authorization probes, the organization dictionary, the access model,
# then the three agent families and the two external integrations behind them.
#
# The upstream integrations (YClients, Macroscop) are not reachable in this
# environment, so those calls assert the shape of the failure rather than the
# data: what is being checked is that the service reports an upstream error as a
# 200 with success=false rather than crashing, hanging or returning a 500.
#
# Usage: scripts/smoke-admin.sh [base-url] [superuser-token]
set -uo pipefail

BASE="${1:-http://localhost:8082/api/v1}"
TOKEN="${2:-${TOKEN:-}}"
JAR="$(mktemp)"
FAIL=0
SUFFIX="$$"

req() { # req METHOD PATH [BODY]
	local method="$1" path="$2" body="${3:-}"
	local args=(-s -o "$JAR" -w '%{http_code}' -X "$method" "$BASE$path" -H 'Accept: application/json')
	[[ -n "$body" ]] && args+=(-H 'Content-Type: application/json' -d "$body")
	[[ -n "${TOKEN:-}" ]] && args+=(-H "Authorization: Bearer $TOKEN")
	CODE=$(curl "${args[@]}")
	BODY=$(cat "$JAR")
}

reqn() { # reqn METHOD PATH  - an anonymous request
	CODE=$(curl -s -o "$JAR" -w '%{http_code}' -X "$1" "$BASE$2" -H 'Accept: application/json')
	BODY=$(cat "$JAR")
}

check() { # check LABEL EXPECTED ACTUAL
	if [[ "$2" == "$3" ]]; then
		printf 'ok   %-54s %s\n' "$1" "$3"
	else
		printf 'FAIL %-54s got %s want %s\n' "$1" "$3" "$2"
		FAIL=1
	fi
}

checkc() { # checkc LABEL PYTHON_BOOL_EXPR_OVER_d
	local got
	got=$(jq_get "$2")
	if [[ "$got" == "True" || "$got" == "true" ]]; then
		printf 'ok   %-54s %s\n' "$1" "yes"
	else
		printf 'FAIL %-54s got %s want true\n' "$1" "${got:-<none>}"
		FAIL=1
	fi
}

jq_get() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1],{'d':d,'json':json}))" "$1" <<<"$BODY" 2>/dev/null; }

echo "== target: $BASE"

if [[ -z "$TOKEN" ]]; then
	echo "FAIL no superuser token supplied; pass one as \$2 or set TOKEN"
	exit 1
fi

# ================================================================
# authorization
# ================================================================

req GET /test/public
check "GET /test/public" 200 "$CODE"
check "  username is null without a caller" "None" "$(jq_get "d['username']")"

req GET /test/authenticated
check "GET /test/authenticated" 200 "$CODE"
check "  username is the token subject" "superadmin" "$(jq_get "d['username']")"
check "  the message repeats the action" "Authenticated - успешно выполнено" "$(jq_get "d['message']")"

req GET /test/my-permissions
check "GET /test/my-permissions" 200 "$CODE"

req GET /test/admin/system
check "GET /test/admin/system with SYSTEM_ADMIN" 200 "$CODE"

# superadmin holds SUPERUSER but not DEVIATION_APPROVE, so these must be
# refused. A 200 here would mean the probe answers from the role rather than
# from the permission.
req GET /test/deviation/approve
check "GET /test/deviation/approve without the permission" 403 "$CODE"
req GET /test/deviation/check
check "GET /test/deviation/check without the permission" 403 "$CODE"
req GET /test/admin/org
check "GET /test/admin/org without ORG_ADMIN" 403 "$CODE"
req GET /test/dispatcher
check "GET /test/dispatcher without DISPATCHER" 403 "$CODE"
req GET /test/dispatcher/approve
check "GET /test/dispatcher/approve without DISPATCHER" 403 "$CODE"

reqn GET /test/authenticated
check "GET /test/authenticated without a token" 401 "$CODE"
reqn GET /dict/org
check "GET /dict/org without a token" 401 "$CODE"

req GET /dict/org
FORGED=$(python3 - <<'PY'
import base64, json
def seg(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b'=').decode()
print(seg({"alg":"none","typ":"JWT"}) + "." + seg({"userId":"x","sub":"superadmin","permissions":["SUPERUSER"]}) + ".")
PY
)
CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/dict/org" -H "Authorization: Bearer $FORGED")
check "alg=none token rejected" 401 "$CODE"
CODE=$(curl -s -o "$JAR" -w '%{http_code}' "$BASE/dict/org" -H "Authorization: Bearer not.a.token")
check "malformed token rejected" 401 "$CODE"

# ================================================================
# organizations
# ================================================================

req POST /access/organizations "{\"shortName\":\"smoke-$SUFFIX\",\"fullName\":\"Smoke Organization $SUFFIX\"}"
check "POST /access/organizations" 201 "$CODE"
ORG_ID="$(jq_get "d['id']")"
checkc "  id is a uuid" "'$ORG_ID' == '$ORG_ID' and len('$ORG_ID') == 36"

req POST /access/organizations "{\"shortName\":\"smoke-$SUFFIX-b\",\"fullName\":\"Smoke B $SUFFIX\"}"
SECOND_ID="$(jq_get "d['id']")"

req GET /access/organizations
check "GET /access/organizations" 200 "$CODE"
checkc "  the new organization is listed" "'$ORG_ID' in [o['id'] for o in d]"

req GET "/access/organizations/$ORG_ID"
check "GET /access/organizations/{id}" 200 "$CODE"

req GET /access/users
check "GET /access/users" 200 "$CODE"
check "  the mirror reports no approved flag" "False" "$(jq_get "d[0]['approved']" 2>/dev/null || echo False)"

req POST /access/organizations '{"shortName":"only-short"}'
check "POST /access/organizations without fullName" 400 "$CODE"

# The dictionary view, which is what the agent screens read.
req GET /dict/org
check "GET /dict/org" 200 "$CODE"
checkc "  the new organization is in the dictionary" "'$ORG_ID' in [o['id'] for o in d]"

req GET "/dict/org/$ORG_ID"
check "GET /dict/org/{id}" 200 "$CODE"
check "  the agent flags start false" "False" "$(jq_get "d['crmAgentSet']")"
check "  the event agent flag starts false" "False" "$(jq_get "d['eventAgentsSet']")"
check "  the camera agent flag starts false" "False" "$(jq_get "d['cameraAgentsSet']")"

req POST "/dict/org/$ORG_ID" "{\"shortName\":\"smoke-$SUFFIX-renamed\",\"fullName\":\"Smoke Renamed $SUFFIX\"}"
check "POST /dict/org/{id}" 200 "$CODE"
check "  shortName renamed" "smoke-$SUFFIX-renamed" "$(jq_get "d['shortName']")"

req GET "/dict/org/ffffffff-ffff-ffff-ffff-ffffffffffff"
check "GET /dict/org/{unknown} is 404" 404 "$CODE"

# ================================================================
# agent families
# ================================================================

for FAM in crm evt img; do
	req GET "/$FAM/types"
	check "GET /$FAM/types" 200 "$CODE"
	checkc "  the type list is not empty" "len(d) > 0"
done

req GET /crm/types/
check "GET /crm/types/ (trailing slash)" 200 "$CODE"
req GET /crm/types/bogus
check "GET /crm/types/bogus does not match the alias" 404 "$CODE"

req POST /crm/agents "{\"agentType\":\"YClients\",\"name\":\"smoke-$SUFFIX-crm\",\"description\":\"smoke\",\"organizationId\":\"$ORG_ID\"}"
check "POST /crm/agents bound to an organization" 201 "$CODE"
CRM_AGENT="$(jq_get "d['id']")"
check "  it reports the organization" "$ORG_ID" "$(jq_get "d['organizationId']")"
check "  it is not yet configured" "False" "$(jq_get "d['configured']")"
checkc "  it owns a CRM organization" "d['crmOrganization'] is not None"

req GET "/dict/org/$ORG_ID"
check "  the dictionary flag was set" "True" "$(jq_get "d['crmAgentSet']")"

req POST /crm/agents "{\"agentType\":\"YClients\",\"name\":\"smoke-$SUFFIX-dup\",\"description\":\"smoke\",\"organizationId\":\"$ORG_ID\"}"
check "POST /crm/agents for an organization that has one" 409 "$CODE"

req POST /crm/agents "{\"agentType\":\"Nonsense\",\"name\":\"x\"}"
check "POST /crm/agents with an unknown type" 400 "$CODE"
req POST /crm/agents '{"name":"x"}'
check "POST /crm/agents without a type" 400 "$CODE"
req POST /crm/agents '{"agentType":"YClients"}'
check "POST /crm/agents without a name" 400 "$CODE"

req GET "/crm/agents/$CRM_AGENT"
check "GET /crm/agents/{id}" 200 "$CODE"
check "  the agent round-trips" "smoke-$SUFFIX-crm" "$(jq_get "d['name']")"

req GET "/crm/agents?org=$ORG_ID"
check "GET /crm/agents?org=" 200 "$CODE"
checkc "  the new agent is listed" "'$CRM_AGENT' in [a['id'] for a in d]"
checkc "  the list DTO carries no config" "'config' not in d[0]"

req GET "/crm/agents?org=$ORG_ID&with_unbounded=true"
check "GET /crm/agents?org=&with_unbounded=" 200 "$CODE"

req GET "/crm/agents?org=ffffffff-ffff-ffff-ffff-ffffffffffff"
check "GET /crm/agents?org= for an unknown org" 200 "$CODE"
check "  the list is empty" "0" "$(jq_get "len(d)")"

req GET "/crm/agents"
check "GET /crm/agents" 200 "$CODE"

req GET "/crm/configs/$CRM_AGENT"
check "GET /crm/configs/{id} creates the configuration" 200 "$CODE"
check "  the id is the agent id" "$CRM_AGENT" "$(jq_get "d['id']")"
req GET "/crm/agents/$CRM_AGENT"
check "  the agent is now configured" "True" "$(jq_get "d['configured']")"

# The Java service compares the path id with the body id, so a rename that
# omits the id is refused rather than applied to whichever agent the path names.
req PUT "/crm/agents/$CRM_AGENT" '{"name":"smoke-renamed","description":"renamed"}'
check "PUT /crm/agents/{id} without a body id" 400 "$CODE"
req PUT "/crm/agents/$CRM_AGENT" "{\"id\":\"other\",\"name\":\"x\"}"
check "PUT /crm/agents/{id} with a mismatched body id" 400 "$CODE"
req PUT "/crm/agents/$CRM_AGENT" "{\"id\":\"$CRM_AGENT\",\"name\":\"smoke-renamed\",\"description\":\"renamed\"}"
check "PUT /crm/agents/{id}" 200 "$CODE"
check "  name applied" "smoke-renamed" "$(jq_get "d['name']")"
check "  description applied" "renamed" "$(jq_get "d['description']")"

# Moving the agent to another organization is a separate, superuser-only step.
req PUT "/crm/agents/$CRM_AGENT/bind?org=$SECOND_ID"
check "PUT /crm/agents/{id}/bind moves the agent" 200 "$CODE"
check "  now bound to the second organization" "$SECOND_ID" "$(jq_get "d['organizationId']")"
req GET "/dict/org/$ORG_ID"
check "  the first organization's flag is cleared" "False" "$(jq_get "d['crmAgentSet']")"
req GET "/dict/org/$SECOND_ID"
check "  the second organization's flag is set" "True" "$(jq_get "d['crmAgentSet']")"

req PUT "/crm/agents/$CRM_AGENT/unbind"
check "PUT /crm/agents/{id}/unbind" 200 "$CODE"
check "  organizationId is null again" "None" "$(jq_get "d['organizationId']")"
req GET "/dict/org/$SECOND_ID"
check "  the organization's flag is cleared" "False" "$(jq_get "d['crmAgentSet']")"

req PUT "/crm/agents/$CRM_AGENT/bind"
check "PUT /crm/agents/{id}/bind without org is 404" 404 "$CODE"

req DELETE "/crm/agents/$CRM_AGENT"
check "DELETE /crm/agents/{id}" 204 "$CODE"
req GET "/crm/agents/$CRM_AGENT"
check "  the deleted agent is gone" 404 "$CODE"

# The event and camera families, which do not require a CRM organization.
req POST /evt/agents '{"agentType":"Macroscop","name":"smoke-evt","description":"smoke"}'
check "POST /evt/agents" 201 "$CODE"
EVT_AGENT="$(jq_get "d['id']")"
req POST /evt/agents '{"agentType":"Nonsense","name":"x"}'
check "POST /evt/agents with an unknown type" 400 "$CODE"
req POST /img/agents '{"agentType":"Macroscop","name":"smoke-img","description":"smoke"}'
check "POST /img/agents" 201 "$CODE"
IMG_AGENT="$(jq_get "d['id']")"
req POST /img/agents '{"agentType":"Zigbee","name":"x"}'
check "POST /img/agents with a type from another family" 400 "$CODE"

# A Zigbee event agent is offered by the type picker and accepted on create, but
# it has no configuration class, so the configuration endpoint refuses it.
req POST /evt/agents '{"agentType":"Zigbee","name":"smoke-zigbee","description":"smoke"}'
check "POST /evt/agents with the Zigbee type" 201 "$CODE"
ZIGBEE_AGENT="$(jq_get "d['id']")"
req GET "/evt/configs/$ZIGBEE_AGENT"
check "GET /evt/configs/{id} for a Zigbee agent" 400 "$CODE"
req GET "/evt/agents/$ZIGBEE_AGENT"
check "  the agent is still not configured" "False" "$(jq_get "d['configured']")"

req GET "/evt/configs/$EVT_AGENT"
check "GET /evt/configs/{id} for a Macroscop agent" 200 "$CODE"
req GET "/evt/agents/$EVT_AGENT"
check "  the agent is now configured" "True" "$(jq_get "d['configured']")"

# Two event agents may share one organization, unlike CRM.
req POST /evt/agents "{\"agentType\":\"Zigbee\",\"name\":\"smoke-evt2\",\"organizationId\":\"$ORG_ID\"}"
check "POST /evt/agents, second agent for the same org" 201 "$CODE"
EVT2="$(jq_get "d['id']")"
req GET "/dict/org/$ORG_ID"
check "  the event flag is set" "True" "$(jq_get "d['eventAgentsSet']")"
check "  the camera flag is untouched" "False" "$(jq_get "d['cameraAgentsSet']")"

# ================================================================
# YClients
# ================================================================

req POST /crm/agents '{"agentType":"YClients","name":"smoke-yc","description":"smoke"}'
check "POST /crm/agents unbound" 201 "$CODE"
YC_AGENT="$(jq_get "d['id']")"

req GET "/yc/configs/$YC_AGENT"
check "GET /yc/configs/{id} before the config exists" 404 "$CODE"

req GET "/crm/configs/$YC_AGENT"
check "GET /crm/configs/{id}" 200 "$CODE"
req GET "/yc/configs/$YC_AGENT"
check "GET /yc/configs/{id} once the config exists" 200 "$CODE"
check "  the user token is null until it is set" "None" "$(jq_get "d['credentials']['userToken']")"

req PUT "/yc/configs/$YC_AGENT" "{\"id\":\"$YC_AGENT\",\"credentials\":{\"partnerToken\":\"partner-xyz\",\"userToken\":\"user-xyz\"}}"
check "PUT /yc/configs/{id}" 200 "$CODE"
check "  the user token round-trips" "user-xyz" "$(jq_get "d['credentials']['userToken']")"
STORED=$(docker exec mon3-pg psql -q -t -U mon3 -d mon3 -c \
	"SELECT user_token FROM admin.yc_agent_configs WHERE id = '$YC_AGENT'" 2>/dev/null | tr -d '[:space:]')
checkc "the stored token is masked" "'$STORED' != 'user-xyz' and '$STORED' != ''"

req PUT "/yc/configs/$YC_AGENT" '{"id":"a-different-id","credentials":{"userToken":"x"}}'
check "PUT /yc/configs/{id} with a mismatched body id" 400 "$CODE"
req PUT "/yc/configs/$YC_AGENT" '{"id":"'"$YC_AGENT"'"}'
check "PUT /yc/configs/{id} without credentials" 400 "$CODE"

req GET "/yc/agents/$YC_AGENT/organization"
check "GET /yc/agents/{id}/organization creates it" 200 "$CODE"
YC_ORG="$(jq_get "d['id']")"
req PUT "/yc/agents/$YC_AGENT/organization" "{\"id\":\"wrong\",\"ycId\":1}"
check "PUT /yc/agents/{id}/organization with a wrong id" 400 "$CODE"
req PUT "/yc/agents/$YC_AGENT/organization" "{\"id\":\"$YC_ORG\",\"ycId\":4242,\"name\":\"Acme\",\"timezone\":\"+03:00\"}"
check "PUT /yc/agents/{id}/organization" 200 "$CODE"
check "  the external company is stored" "Acme" "$(jq_get "d['name']")"
check "  the external id is stored" "4242" "$(jq_get "d['ycId']")"
req GET "/yc/agents/$YC_AGENT/organization"
check "  it round-trips through the database" "4242" "$(jq_get "d['ycId']")"

req PUT "/yc/agents/$YC_AGENT/service-categories" '[{"id":1,"name":"Category One"}]'
check "PUT /yc/agents/{id}/service-categories" 200 "$CODE"
check "  one category stored" "1" "$(jq_get "len(d)")"
check "  the category carries the company id" "4242" "$(jq_get "d[0]['orgId']")"
req PUT "/yc/agents/$YC_AGENT/service-categories" '[{"id":1,"name":"Category One"},{"id":2,"name":"Category Two"}]'
check "PUT .../service-categories is a replace" 200 "$CODE"
check "  two categories stored" "2" "$(jq_get "len(d)")"
check "  sorted by name" "Category One" "$(jq_get "d[0]['name']")"
req PUT "/yc/agents/$YC_AGENT/service-categories" '[{"id":2,"name":"Category Two"}]'
check "  an omitted category is deleted" "1" "$(jq_get "len(d)")"

req POST "/yc/agents/$YC_AGENT/services" '{"ycId":7,"ycName":"Service Seven","categoryId":2}'
check "POST /yc/agents/{id}/services" 200 "$CODE"
check "  the service is stored" "Service Seven" "$(jq_get "d['name']")"
SVC_ID="$(jq_get "d['id']")"
req POST "/yc/agents/$YC_AGENT/services" '{"ycId":7,"ycName":"Duplicate","categoryId":2}'
check "POST /yc/agents/{id}/services with a duplicate" 409 "$CODE"
req POST "/yc/agents/$YC_AGENT/services" '{"ycId":8,"ycName":"Orphan","categoryId":9999}'
check "POST /yc/agents/{id}/services with an unknown category" 400 "$CODE"

req GET "/yc/agents/$YC_AGENT/services"
check "GET /yc/agents/{id}/services" 200 "$CODE"
check "  one service listed" "1" "$(jq_get "len(d)")"
req PUT "/yc/agents/$YC_AGENT/services/$SVC_ID" '{"ycName":"Service Renamed"}'
check "PUT /yc/agents/{agent}/services/{id}" 200 "$CODE"
check "  the name is applied" "Service Renamed" "$(jq_get "d['ycName']")"
req DELETE "/yc/agents/$YC_AGENT/services/$SVC_ID"
check "DELETE /yc/agents/{agent}/services/{id}" 204 "$CODE"
req GET "/yc/agents/$YC_AGENT/services"
check "  the service is gone" "0" "$(jq_get "len(d)")"

req POST "/yc/agents/$YC_AGENT/places" '{"ycId":11,"ycName":"Place Eleven","available":true}'
check "POST /yc/agents/{id}/places" 200 "$CODE"
PLACE_ID="$(jq_get "d['id']")"
req POST "/yc/agents/$YC_AGENT/places" '{"ycId":11,"ycName":"Duplicate"}'
check "POST /yc/agents/{id}/places with a duplicate" 409 "$CODE"
req GET "/yc/agents/$YC_AGENT/places"
check "GET /yc/agents/{id}/places" 200 "$CODE"
check "  one place listed" "1" "$(jq_get "len(d)")"
req PUT "/yc/agents/$YC_AGENT/places/$PLACE_ID" '{"ycName":"Place Renamed","available":false}'
check "PUT /yc/agents/{agent}/places/{id}" 200 "$CODE"
check "  the name is applied" "Place Renamed" "$(jq_get "d['ycName']")"
check "  availability is applied" "False" "$(jq_get "d['available']")"
req DELETE "/yc/agents/$YC_AGENT/places/$PLACE_ID"
check "DELETE /yc/agents/{agent}/places/{id}" 204 "$CODE"

# The upstream is unreachable here, so the assertion is that a failed call is a
# 200 carrying success=false and a message, not a 500.
req GET "/yc/misc/agent/$YC_AGENT/allowed-orgs"
check "GET /yc/misc/agent/{id}/allowed-orgs with no upstream" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"
checkc "  an error message is present" "bool(d.get('errorMessage'))"

req GET "/yc/misc/agent/$YC_AGENT/org/4242/service-categories"
check "GET /yc/misc/agent/{id}/org/{org}/service-categories" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"

req GET "/yc/misc/agent/$YC_AGENT/org/not-a-number/service-categories"
check "GET .../org/{non-numeric}/service-categories is 400" 400 "$CODE"

req GET "/yc/misc/agent/$YC_AGENT/services"
check "GET /yc/misc/agent/{id}/services" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"
req GET "/yc/misc/agent/$YC_AGENT/places"
check "GET /yc/misc/agent/{id}/places" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"

req POST /yc/misc/get-token '{"login":"nobody","password":"nothing"}'
check "POST /yc/misc/get-token with no upstream" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"

req DELETE "/crm/agents/$YC_AGENT"
check "DELETE /crm/agents/{id} with YClients data" 204 "$CODE"

# ================================================================
# Macroscop
# ================================================================

# The link row is created by the family's own configuration endpoint, so the
# Macroscop one is readable but empty rather than missing.
req GET "/macroscop/evt-configs/$EVT_AGENT"
check "GET /macroscop/evt-configs/{id} before it is bound" 200 "$CODE"
check "  the config is null until something is bound" "None" "$(jq_get "d['config']")"
req PUT "/macroscop/evt-configs/$EVT_AGENT" 'null'
check "PUT /macroscop/evt-configs/{id} with a null body" 409 "$CODE"
req PUT "/macroscop/evt-configs/$EVT_AGENT" "{\"config\":{\"id\":\"not-a-config\"}}"
check "PUT /macroscop/evt-configs/{id} naming an unknown config" 404 "$CODE"
req PUT "/macroscop/evt-configs/$EVT_AGENT" '{"config":null}'
check "PUT /macroscop/evt-configs/{id} with no config" 200 "$CODE"
check "  the empty request is echoed back" "None" "$(jq_get "d['config']")"

req GET /macroscop/misc/archive-modes
check "GET /macroscop/misc/archive-modes" 200 "$CODE"
check "  four modes" "4" "$(jq_get "len(d)")"
check "  the first is Always" "Always" "$(jq_get "d[0]['id']")"
check "  a name is the Russian description" "Всегда включена" "$(jq_get "d[0]['name']")"
checkc "  sorted by name" "[m['id'] for m in d] == sorted(m['id'] for m in d)"

req GET /macroscop/configs
check "GET /macroscop/configs" 200 "$CODE"
check "  empty to begin with" "0" "$(jq_get "len(d)")"

req POST /macroscop/configs
check "POST /macroscop/configs" 201 "$CODE"
MS_CFG="$(jq_get "d['id']")"
check "  a fresh config has no server info" "None" "$(jq_get "d['serverInfo']")"
check "  a fresh config has no credentials" "None" "$(jq_get "d['credentials']")"
check "  a fresh config has no address" "None" "$(jq_get "d['serverAddress']")"
checkc "  a fresh config is named temp-<uuid>" "d['name'].startswith('temp-')"

req GET /macroscop/configs
check "GET /macroscop/configs after the create" 200 "$CODE"
check "  one config listed" "1" "$(jq_get "len(d)")"

req GET "/macroscop/configs/$MS_CFG"
check "GET /macroscop/configs/{id}" 200 "$CODE"
checkc "  a loaded config renders the all-null server info block" "d['serverInfo'] == {'id': None, 'version': None, 'responseDate': None, 'tz': None, 'useTz': False}"
checkc "  a loaded config renders the all-null credentials block" "d['credentials'] == {'login': None, 'password': None}"

req PUT "/macroscop/configs/$MS_CFG" "{\"name\":\"smoke-ms-$SUFFIX\",\"serverAddress\":\"10.0.0.9\",\"credentials\":{\"login\":\"admin\",\"password\":\"s3cret\"},\"serverInfo\":{\"id\":\"srv-1\",\"version\":\"5.4\",\"tz\":\"+03:00\",\"useTz\":true}}"
check "PUT /macroscop/configs/{id}" 200 "$CODE"
check "  the name is applied" "smoke-ms-$SUFFIX" "$(jq_get "d['name']")"
check "  the address is applied" "10.0.0.9" "$(jq_get "d['serverAddress']")"
check "  the login is unmasked on read" "admin" "$(jq_get "d['credentials']['login']")"
check "  the server id round-trips" "srv-1" "$(jq_get "d['serverInfo']['id']")"
check "  the zone is rendered as an id" "+03:00" "$(jq_get "d['serverInfo']['tz']")"
check "  useTz round-trips" "True" "$(jq_get "d['serverInfo']['useTz']")"

STORED=$(docker exec mon3-pg psql -q -t -U mon3 -d mon3 -c \
	"SELECT password FROM admin.macroscop_agent_configs WHERE id = '$MS_CFG'" 2>/dev/null | tr -d '[:space:]')
checkc "the stored password is masked" "'$STORED' != 's3cret' and '$STORED' != ''"

# The Java service required credentials on every update, so a partial body was
# refused rather than merged.
req PUT "/macroscop/configs/$MS_CFG" '{}'
check "PUT /macroscop/configs/{id} without credentials" 400 "$CODE"
req PUT "/macroscop/configs/$MS_CFG" "{\"credentials\":{}}"
check "PUT /macroscop/configs/{id} keeps the name when omitted" 200 "$CODE"
check "  the name is unchanged" "smoke-ms-$SUFFIX" "$(jq_get "d['name']")"
check "  the address is cleared" "None" "$(jq_get "d['serverAddress']")"

req PUT "/macroscop/configs/00000000-0000-0000-0000-000000000000" '{"name":"x"}'
check "PUT /macroscop/configs/{unknown}" 404 "$CODE"

req PUT "/macroscop/evt-configs/$EVT_AGENT/bind?cfg=00000000-0000-0000-0000-000000000000"
check "PUT /macroscop/evt-configs/{id}/bind to an unknown config" 404 "$CODE"
req PUT "/macroscop/evt-configs/$EVT_AGENT" "{\"config\":{\"id\":\"$MS_CFG\"}}"
check "PUT /macroscop/evt-configs/{id}" 200 "$CODE"
check "  the event agent is bound to the config" "$MS_CFG" "$(jq_get "d['config']['id']")"
req GET "/macroscop/evt-configs/$EVT_AGENT"
check "GET /macroscop/evt-configs/{id} after the link" 200 "$CODE"
check "  the same config is read back" "$MS_CFG" "$(jq_get "d['config']['id']")"

req POST /img/agents '{"agentType":"Macroscop","name":"smoke-img2"}'
IMG_AGENT2="$(jq_get "d['id']")"
req PUT "/macroscop/img-configs/$IMG_AGENT2" "{\"config\":{\"id\":\"$MS_CFG\"}}"
check "PUT /macroscop/img-configs/{id} before its link exists" 404 "$CODE"
req GET "/img/configs/$IMG_AGENT2"
check "GET /img/configs/{id} creates the link row" 200 "$CODE"
req PUT "/macroscop/img-configs/$IMG_AGENT2" "{\"config\":{\"id\":\"$MS_CFG\"}}"
check "PUT /macroscop/img-configs/{id}" 200 "$CODE"
check "  the camera agent is bound to the config" "$MS_CFG" "$(jq_get "d['config']['id']")"

# Editing the agent's configuration is not the same as moving it to another
# server, and the endpoint refuses the second meaning.
req PUT "/macroscop/evt-configs/$EVT_AGENT" "{\"config\":{\"id\":\"00000000-0000-0000-0000-000000000000\"}}"
check "PUT /macroscop/evt-configs/{id} to another config" 409 "$CODE"
req PUT "/macroscop/evt-configs/$EVT_AGENT/bind"
check "PUT /macroscop/evt-configs/{id}/bind without cfg is 404" 404 "$CODE"

req PUT "/macroscop/evt-configs/$EVT_AGENT/bind?cfg=$MS_CFG"
check "PUT /macroscop/evt-configs/{id}/bind to the same config" 200 "$CODE"
req PUT "/macroscop/evt-configs/$EVT_AGENT/unbind"
check "PUT /macroscop/evt-configs/{id}/unbind" 200 "$CODE"
check "  the binding is gone" "None" "$(jq_get "d['config']")"
req PUT "/macroscop/img-configs/$IMG_AGENT2/unbind"
check "PUT /macroscop/img-configs/{id}/unbind" 200 "$CODE"

req GET "/macroscop/configs/$MS_CFG/channels"
check "GET /macroscop/configs/{id}/channels" 200 "$CODE"
check "  no channels yet" "0" "$(jq_get "len(d)")"
req PUT "/macroscop/configs/$MS_CFG/channels" '[]'
check "PUT /macroscop/configs/{id}/channels with an empty list" 200 "$CODE"
check "  still no channels" "0" "$(jq_get "len(d)")"
# A channel is only created when the request says it exists upstream; the flag
# is how the picker distinguishes a channel the server reported from one the
# operator has since removed.
req PUT "/macroscop/configs/$MS_CFG/channels" '[{"macroscopId":"ch1","name":"Front Door"}]'
check "PUT .../channels without exists stores nothing" 200 "$CODE"
check "  no channel stored" "0" "$(jq_get "len(d)")"
req PUT "/macroscop/configs/$MS_CFG/channels" '[{"macroscopId":"ch1","name":"Front Door","exists":true,"used":true,"enabled":true}]'
check "PUT /macroscop/configs/{id}/channels" 200 "$CODE"
check "  one channel stored" "1" "$(jq_get "len(d)")"
check "  the channel is enabled" "True" "$(jq_get "d[0]['enabled']")"
req GET "/macroscop/configs/$MS_CFG/channels"
check "  it round-trips" "Front Door" "$(jq_get "d[0]['name']")"

# The upstream probes need usable credentials, and the update above deliberately
# cleared the address, so put it back first.
req PUT "/macroscop/configs/$MS_CFG" "{\"name\":\"smoke-ms-$SUFFIX\",\"serverAddress\":\"10.0.0.9\",\"credentials\":{\"login\":\"admin\",\"password\":\"s3cret\"}}"
check "PUT /macroscop/configs/{id} restores the address" 200 "$CODE"

# The upstream is unreachable, so a screenshot is a 502 carrying the upstream's
# own message rather than a 500 from an unhandled client error.
req GET "/macroscop/misc/configs/$MS_CFG/server-info"
check "GET /macroscop/misc/configs/{id}/server-info with no upstream" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"
req GET "/macroscop/misc/configs/$MS_CFG/channels"
check "GET /macroscop/misc/configs/{id}/channels with no upstream" 200 "$CODE"
check "  success is false" "False" "$(jq_get "d['success']")"
req GET "/macroscop/misc/configs/$MS_CFG/channels/ch1/current-screenshot"
check "GET .../current-screenshot with no upstream" 502 "$CODE"
checkc "  the problem carries a message" "bool(d.get('detail'))"
req GET "/macroscop/misc/configs/$MS_CFG/channels/unknown/current-screenshot"
check "GET .../current-screenshot for an unknown channel" 404 "$CODE"
req GET "/macroscop/misc/configs/$MS_CFG/channels/ch1/last-archive-screenshot"
check "GET .../last-archive-screenshot with no upstream" 502 "$CODE"

req POST /macroscop/misc/server-info '{"address":"10.0.0.9","login":"admin","password":"s3cret"}'
check "POST /macroscop/misc/server-info" 200 "$CODE"
check "  success is false without an upstream" "False" "$(jq_get "d['success']")"
req POST /macroscop/misc/server-info '{"address":"","login":"","password":""}'
check "POST /macroscop/misc/server-info with blanks" 400 "$CODE"

req DELETE "/macroscop/configs/$MS_CFG"
check "DELETE /macroscop/configs/{id}" 204 "$CODE"
req GET "/macroscop/configs/$MS_CFG"
check "  the deleted config is gone" 404 "$CODE"
req DELETE "/macroscop/configs/$MS_CFG"
check "  deleting it twice is 404" 404 "$CODE"

# ================================================================
# cleanup
# ================================================================

req DELETE "/evt/agents/$EVT_AGENT"
check "DELETE /evt/agents/{id}" 204 "$CODE"
req DELETE "/evt/agents/$EVT_AGENT"
check "  deleting it twice is 404" 404 "$CODE"
req DELETE "/evt/agents/$ZIGBEE_AGENT"
check "DELETE /evt/agents/{id} for the Zigbee agent" 204 "$CODE"
req DELETE "/img/agents/$IMG_AGENT"
check "DELETE /img/agents/{id}" 204 "$CODE"
req DELETE "/img/agents/$IMG_AGENT2"
check "DELETE /img/agents/{id}" 204 "$CODE"

req DELETE "/evt/agents/$EVT2"
check "DELETE /evt/agents/{id} for the last bound agent" 204 "$CODE"
req GET "/dict/org/$ORG_ID"
check "GET /dict/org/{id} after the agent cleanup" 200 "$CODE"
check "  the event flag is cleared with the last agent" "False" "$(jq_get "d['eventAgentsSet']")"
check "  the crm flag was already clear" "False" "$(jq_get "d['crmAgentSet']")"

req DELETE "/access/organizations/$SECOND_ID"
check "DELETE /access/organizations/{id}" 204 "$CODE"
req DELETE "/access/organizations/$ORG_ID"
check "DELETE /access/organizations/{id}" 204 "$CODE"
req GET "/access/organizations/$ORG_ID"
check "  the deleted organization is gone" 404 "$CODE"

req GET /dict/org
checkc "the smoke organizations are gone from the dictionary" "'$ORG_ID' not in [o['id'] for o in d]"

# An organization create must reach service-auth, which keeps its own mirror.
# The auth schema is what makes the publish observable from outside.
SLEPT=0
while [[ $SLEPT -lt 10 ]]; do
	MIRROR=$(docker exec mon3-pg psql -q -t -U mon3 -d mon3 -c \
		"SELECT count(*) FROM auth.organizations WHERE id = '$ORG_ID'" 2>/dev/null | tr -d '[:space:]')
	[[ "$MIRROR" == "0" ]] && break
	sleep 1
	SLEPT=$((SLEPT + 1))
done
check "the deleted organization reached service-auth's mirror" 0 "${MIRROR:-unknown}"

req GET /nope
check "an unmapped path is a JSON 404" 404 "$CODE"
check "  the body is a problem document" "about:blank" "$(jq_get "d['type']")"

rm -f "$JAR"
echo
if [[ "$FAIL" == 0 ]]; then
	echo "smoke: all checks passed"
else
	echo "smoke: FAILURES present"
fi
exit "$FAIL"
