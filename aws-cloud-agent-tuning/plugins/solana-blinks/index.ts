import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const ACTION_PATH = "/api/actions/pay";
const ICON_PATH = "/api/actions/xpenny-icon.svg";
const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_BODY_BYTES = 16 * 1024;

function cors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: any, status: number, value: unknown) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function baseUrl() {
  return requiredEnv("SOLANA_BLINK_BASE_URL").replace(/\/$/, "");
}

function actionUrl(amount?: string) {
  if (amount === "{amount}") return `${baseUrl()}${ACTION_PATH}?amount={amount}`;
  const url = new URL(`${baseUrl()}${ACTION_PATH}`);
  if (amount) url.searchParams.set("amount", amount);
  return url.toString();
}

function parseAmount(raw: string | null) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
    throw new Error("amount must be greater than 0 and no more than 1000 SOL");
  }
  const lamports = Math.round(amount * LAMPORTS_PER_SOL);
  if (!Number.isSafeInteger(lamports) || lamports < 1) {
    throw new Error("amount is too small");
  }
  return { amount, lamports };
}

async function readJson(req: any) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function metadata() {
  const title = process.env.SOLANA_BLINK_TITLE?.trim() || "Pay Xpenny with SOL";
  const description = process.env.SOLANA_BLINK_DESCRIPTION?.trim()
    || "Create a SOL payment transaction. Your wallet shows the transaction before you sign it.";
  return {
    type: "action",
    icon: `${baseUrl()}${ICON_PATH}`,
    title,
    description,
    label: "Pay SOL",
    links: {
      actions: [
        { label: "Pay 0.01 SOL", href: actionUrl("0.01") },
        { label: "Pay 0.1 SOL", href: actionUrl("0.1") },
        {
          label: "Pay SOL",
          href: actionUrl("{amount}"),
          parameters: [{
            name: "amount",
            label: "SOL amount",
            type: "number",
            required: true,
            min: 0.000001,
            max: 1000,
          }],
        },
      ],
    },
  };
}

async function createTransaction(account: string, amountRaw: string | null) {
  const sender = new PublicKey(account);
  const recipient = new PublicKey(requiredEnv("SOLANA_BLINK_RECIPIENT"));
  const { amount, lamports } = parseAmount(amountRaw);
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  }).add(SystemProgram.transfer({ fromPubkey: sender, toPubkey: recipient, lamports }));

  return {
    transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    message: `Pay ${amount} SOL to ${recipient.toBase58()}`,
  };
}

function icon(res: any) {
  cors(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#9945ff"/><stop offset="1" stop-color="#14f195"/></linearGradient></defs><rect width="512" height="512" rx="96" fill="#09090b"/><path fill="url(#g)" d="M143 329h278l-52 54H91l52-54zm0-200h278l-52 54H91l52-54zm226 100H91l52 54h278l-52-54z"/></svg>`);
}

async function actionHandler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.statusCode = 204;
      res.end();
      return true;
    }
    if (req.method === "GET") {
      json(res, 200, metadata());
      return true;
    }
    if (req.method === "POST") {
      const url = new URL(req.url, baseUrl());
      const body = await readJson(req);
      if (typeof body.account !== "string") throw new Error("account is required");
      json(res, 200, await createTransaction(body.account, url.searchParams.get("amount")));
      return true;
    }
    json(res, 405, { message: "Method not allowed" });
    return true;
  } catch (error: any) {
    json(res, 400, { message: error?.message || "Unable to create transaction" });
    return true;
  }
}

export default function register(api: any) {
  api.registerHttpRoute({ path: "/actions.json", auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    json(res, 200, { rules: [{ pathPattern: "/pay", apiPath: ACTION_PATH }] });
    return true;
  }});
  api.registerHttpRoute({ path: ICON_PATH, auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    icon(res);
    return true;
  }});
  api.registerHttpRoute({ path: ACTION_PATH, auth: "plugin", match: "exact", handler: actionHandler });
}
