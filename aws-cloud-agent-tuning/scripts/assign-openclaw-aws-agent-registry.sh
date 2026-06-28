#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-southeast-2}"
AGENT_REGISTRY_TABLE="${AGENT_REGISTRY_TABLE:-OpenClawAgentRegistry}"
ACTIVE_AGENT_PARAMETER="${ACTIVE_AGENT_PARAMETER:-/openclaw/registry/active-agent}"
AGENT_ID="${AGENT_ID:-openclaw}"
AGENT_NAME="${AGENT_NAME:-OpenClaw AWS Agent}"
AGENT_RUNTIME="${AGENT_RUNTIME:-openclaw}"
AGENT_PROVIDER="${AGENT_PROVIDER:-aws-lightsail}"
AGENT_OWNER="${AGENT_OWNER:-xtoken2000}"
AGENT_VERSION="${AGENT_VERSION:-unknown}"
AGENT_STATUS="${AGENT_STATUS:-active}"
AGENT_CAPABILITIES="${AGENT_CAPABILITIES:-telegram,whatsapp,farcaster,commerce,solana-invocation}"
AGENT_SKILLS="${AGENT_SKILLS:-openclaw,contractor,restaurant,research,commerce}"
AGENT_AUTH="${AGENT_AUTH:-bearer_token}"
AGENT_INPUT_SCHEMA="${AGENT_INPUT_SCHEMA:-{\"message\":\"string\",\"agent\":\"string\",\"source\":\"string\"}}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required. Install/configure it, then rerun this script." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to build the DynamoDB item safely." >&2
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION")
if [ -n "${AWS_PROFILE:-}" ]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
fi

if ! aws "${AWS_ARGS[@]}" dynamodb describe-table --table-name "$AGENT_REGISTRY_TABLE" >/dev/null 2>&1; then
  echo "Creating DynamoDB registry table: $AGENT_REGISTRY_TABLE"
  aws "${AWS_ARGS[@]}" dynamodb create-table \
    --table-name "$AGENT_REGISTRY_TABLE" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=agent_id,AttributeType=S \
    --key-schema AttributeName=agent_id,KeyType=HASH >/dev/null

  aws "${AWS_ARGS[@]}" dynamodb wait table-exists --table-name "$AGENT_REGISTRY_TABLE"
fi

ITEM_FILE="$(mktemp)"
trap 'rm -f "$ITEM_FILE"' EXIT

export ITEM_FILE
export AGENT_ID AGENT_NAME AGENT_RUNTIME AGENT_PROVIDER AGENT_OWNER
export AGENT_VERSION AGENT_STATUS AGENT_CAPABILITIES AGENT_SKILLS AGENT_AUTH AGENT_INPUT_SCHEMA
export AGENT_ENDPOINT="${AGENT_ENDPOINT:-}"

node <<'NODE'
const fs = require("fs");

function value(name, fallback = "") {
  return process.env[name] || fallback;
}

const capabilities = value("AGENT_CAPABILITIES")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const skills = value("AGENT_SKILLS")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const inputSchema = JSON.parse(value(
  "AGENT_INPUT_SCHEMA",
  "{\"message\":\"string\",\"agent\":\"string\",\"source\":\"string\"}"
));

const item = {
  agent_id: { S: value("AGENT_ID", "openclaw") },
  name: { S: value("AGENT_NAME", "OpenClaw AWS Agent") },
  runtime: { S: value("AGENT_RUNTIME", "openclaw") },
  provider: { S: value("AGENT_PROVIDER", "aws-lightsail") },
  owner: { S: value("AGENT_OWNER", "xtoken2000") },
  version: { S: value("AGENT_VERSION", "unknown") },
  status: { S: value("AGENT_STATUS", "active") },
  assigned_at: { S: new Date().toISOString() },
  auth: { S: value("AGENT_AUTH", "bearer_token") },
  input_schema: { S: JSON.stringify(inputSchema) },
};

if (value("AGENT_ENDPOINT")) {
  item.endpoint = { S: value("AGENT_ENDPOINT") };
}

if (capabilities.length > 0) {
  item.capabilities = { SS: capabilities };
}

if (skills.length > 0) {
  item.skills = { SS: skills };
}

item.descriptor = {
  S: JSON.stringify({
    name: item.name.S,
    skills,
    endpoint: item.endpoint?.S || "",
    auth: item.auth.S,
    input_schema: inputSchema,
  }),
};

fs.writeFileSync(process.env.ITEM_FILE, JSON.stringify(item, null, 2));
NODE

echo "Assigning OpenClaw agent '$AGENT_ID' in $AGENT_REGISTRY_TABLE"
aws "${AWS_ARGS[@]}" dynamodb put-item \
  --table-name "$AGENT_REGISTRY_TABLE" \
  --item "file://$ITEM_FILE"

echo "Setting active agent pointer: $ACTIVE_AGENT_PARAMETER=$AGENT_ID"
aws "${AWS_ARGS[@]}" ssm put-parameter \
  --name "$ACTIVE_AGENT_PARAMETER" \
  --type String \
  --value "$AGENT_ID" \
  --overwrite >/dev/null

echo "Assigned $AGENT_ID to AWS agent registry table $AGENT_REGISTRY_TABLE"
