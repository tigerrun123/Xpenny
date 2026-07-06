import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const {
  AWS_REGION = "ap-southeast-2",
  AGENT_REGISTRY_TABLE = "OpenClawAgentRegistry",
  ACTIVE_AGENT_PARAMETER = "/openclaw/registry/active-agent",
  OPENCLAW_AGENT_TOKEN,
  OPENCLAW_AGENT_AUTH_HEADER = "Authorization",
  OPENCLAW_AGENT_AUTH_SCHEME = "Bearer",
  ROUTER_TIMEOUT_MS = "60000",
} = process.env;

function awsArgs(...args) {
  const profileArgs = process.env.AWS_PROFILE ? ["--profile", process.env.AWS_PROFILE] : [];
  return ["--region", AWS_REGION, ...profileArgs, ...args];
}

async function awsJson(...args) {
  const { stdout } = await execFileAsync("aws", [...awsArgs(...args), "--output", "json"], {
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout || "{}");
}

function attrValue(attribute) {
  if (!attribute) return undefined;
  if (attribute.S !== undefined) return attribute.S;
  if (attribute.N !== undefined) return Number(attribute.N);
  if (attribute.BOOL !== undefined) return attribute.BOOL;
  if (attribute.SS !== undefined) return attribute.SS;
  return undefined;
}

function fromDynamoItem(item = {}) {
  const record = Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, attrValue(value)]),
  );

  if (record.descriptor) {
    record.descriptor = JSON.parse(record.descriptor);
  }

  if (record.input_schema) {
    record.input_schema = JSON.parse(record.input_schema);
  }

  return record;
}

function scoreRecord(record, query) {
  const haystack = [
    record.agent_id,
    record.name,
    record.runtime,
    record.provider,
    record.status,
    ...(record.skills || []),
    ...(record.capabilities || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

async function activeAgentId() {
  const payload = await awsJson(
    "ssm",
    "get-parameter",
    "--name",
    ACTIVE_AGENT_PARAMETER,
  );
  return payload.Parameter?.Value;
}

async function searchRegistry(query) {
  const payload = await awsJson(
    "dynamodb",
    "scan",
    "--table-name",
    AGENT_REGISTRY_TABLE,
  );

  const activeId = await activeAgentId().catch(() => "");
  return (payload.Items || [])
    .map(fromDynamoItem)
    .filter((record) => record.status === "active")
    .map((record) => ({
      ...record,
      route_score: scoreRecord(record, query) + (record.agent_id === activeId ? 0.25 : 0),
    }))
    .filter((record) => record.route_score > 0)
    .sort((a, b) => b.route_score - a.route_score);
}

function authHeaders() {
  if (!OPENCLAW_AGENT_TOKEN) return {};
  const value = OPENCLAW_AGENT_AUTH_SCHEME
    ? `${OPENCLAW_AGENT_AUTH_SCHEME} ${OPENCLAW_AGENT_TOKEN}`
    : OPENCLAW_AGENT_TOKEN;
  return { [OPENCLAW_AGENT_AUTH_HEADER]: value };
}

async function invokeAgent(record, message) {
  const endpoint = record.endpoint || record.descriptor?.endpoint;

  if (!endpoint) {
    throw new Error(`Registry record '${record.agent_id}' does not have an endpoint.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(ROUTER_TIMEOUT_MS));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        message,
        agent: record.agent_id,
        source: "aws-agent-registry-router-demo",
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`Agent endpoint returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function parseArgs(argv) {
  const args = { invoke: false, query: "", message: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--invoke") args.invoke = true;
    else if (item === "--query") args.query = argv[++i] || "";
    else if (item === "--message") args.message = argv[++i] || "";
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const query = args.query || args.message || "openclaw contractor";
const matches = await searchRegistry(query);

if (matches.length === 0) {
  console.log(JSON.stringify({ ok: false, error: "No active registry match", query }, null, 2));
  process.exitCode = 1;
} else {
  const selected = matches[0];
  const result = {
    ok: true,
    query,
    selected: {
      agent_id: selected.agent_id,
      name: selected.name,
      endpoint: selected.endpoint || selected.descriptor?.endpoint || "",
      skills: selected.skills || [],
      input_schema: selected.input_schema || selected.descriptor?.input_schema || {},
      route_score: selected.route_score,
    },
  };

  if (args.invoke) {
    result.invocation = await invokeAgent(selected, args.message || query);
  }

  console.log(JSON.stringify(result, null, 2));
}
