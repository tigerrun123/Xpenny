import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ACTION_PATH = "/api/actions/pay";
const FIFA_ACTION_PATH = "/api/actions/fifa26";
const FIFA_CALLBACK_PATH = "/api/actions/fifa26/complete";
const FIFA_VERIFY_PATH = "/api/actions/fifa26/verify";
const HELLO_ACTION_PATH = "/api/actions/hello-solana";
const HELLO_CALLBACK_PATH = "/api/actions/hello-solana/complete";
const HELLO_PAGE_PATH = "/blinks/hello-solana";
const HELLO_CLIENT_PATH = "/api/actions/hello-solana-client.js";
const WEB3_BROWSER_PATH = "/api/actions/solana-web3.js";
const ICON_PATH = "/api/actions/xpenny-icon.svg";
const LAMPORTS_PER_SOL = 1_000_000_000;
const USDC_DECIMALS = 6;
const FIFA_PRICE_USDC = 0.01;
const FIFA_PRICE_BASE_UNITS = 10_000;
const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const FIFA_MEMO_PREFIX = "xpenny:fifa26:";
const HELLO_MEMO_PREFIX = "xpenny:hello-solana:";
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

function fifaActionUrl(requestId?: string) {
  const url = new URL(`${baseUrl()}${FIFA_ACTION_PATH}`);
  if (requestId) url.searchParams.set("request", requestId);
  return url.toString();
}

function helloActionUrl(requestId?: string) {
  const url = new URL(`${baseUrl()}${HELLO_ACTION_PATH}`);
  if (requestId) url.searchParams.set("request", requestId);
  return url.toString();
}

function receiptPath() {
  return process.env.SOLANA_BLINK_STATE_PATH?.trim()
    || path.join(process.env.HOME || process.cwd(), ".openclaw", "solana-blinks", "fifa26-receipts.json");
}

function readReceipts(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(receiptPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeReceipts(receipts: Record<string, any>) {
  fs.mkdirSync(path.dirname(receiptPath()), { recursive: true });
  const temporary = `${receiptPath()}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipts, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, receiptPath());
}

function validRequestId(value: string | null) {
  if (!value || !/^[0-9a-f-]{36}$/i.test(value)) throw new Error("invalid FIFA 26 request reference");
  return value;
}

function associatedTokenAddress(mint: PublicKey, owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function createTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
) {
  const data = Buffer.alloc(10);
  data[0] = 12;
  data.writeBigUInt64LE(amount, 1);
  data[9] = decimals;
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
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

function fifaMetadata(requestId: string = crypto.randomUUID()) {
  return {
    type: "action",
    icon: `${baseUrl()}${ICON_PATH}`,
    title: "Unlock FIFA 26 information",
    description: "Deposit 0.01 USDC to the configured escrow wallet. The Telegram agent reveals the requested FIFA 26 information only after confirming this transaction.",
    label: "Escrow 0.01 USDC",
    links: {
      actions: [{ label: "Escrow 0.01 USDC", href: fifaActionUrl(requestId) }],
    },
  };
}

function helloMetadata(requestId: string = crypto.randomUUID()) {
  return {
    type: "action",
    icon: `${baseUrl()}${ICON_PATH}`,
    title: "Hello Solana",
    description: "Sign a memo-only transaction to test the Telegram → Blink → wallet → callback flow. No SOL or tokens are transferred; the normal network fee applies.",
    label: "Say hello",
    links: {
      actions: [{ label: "Say hello", href: helloActionUrl(requestId) }],
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

function buildFifaTransaction(
  sender: PublicKey,
  escrowOwner: PublicKey,
  mint: PublicKey,
  requestId: string,
  blockhash: string,
  lastValidBlockHeight: number,
) {
  const senderTokenAccount = associatedTokenAddress(mint, sender);
  const escrowTokenAccount = associatedTokenAddress(mint, escrowOwner);
  const memo = `${FIFA_MEMO_PREFIX}${requestId}`;
  return new Transaction({ feePayer: sender, blockhash, lastValidBlockHeight }).add(
    createAssociatedTokenAccountIdempotentInstruction(sender, escrowTokenAccount, escrowOwner, mint),
    createTransferCheckedInstruction(
      senderTokenAccount,
      mint,
      escrowTokenAccount,
      sender,
      BigInt(FIFA_PRICE_BASE_UNITS),
      USDC_DECIMALS,
    ),
    new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, "utf8") }),
  );
}

function buildHelloTransaction(
  sender: PublicKey,
  requestId: string,
  blockhash: string,
  lastValidBlockHeight: number,
) {
  return new Transaction({ feePayer: sender, blockhash, lastValidBlockHeight }).add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`${HELLO_MEMO_PREFIX}${requestId}`, "utf8"),
    }),
  );
}

async function createHelloTransaction(account: string, requestId: string) {
  const sender = new PublicKey(account);
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = buildHelloTransaction(sender, requestId, blockhash, lastValidBlockHeight);
  const callback = new URL(`${baseUrl()}${HELLO_CALLBACK_PATH}`);
  callback.searchParams.set("request", requestId);
  return {
    transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    message: "Sign the Hello Solana memo. No SOL or tokens will be transferred; the network fee applies.",
    links: { next: { type: "post", href: callback.pathname + callback.search } },
  };
}

async function createFifaTransaction(account: string, requestId: string) {
  const sender = new PublicKey(account);
  const escrowOwner = new PublicKey(requiredEnv("SOLANA_USDC_ESCROW_RECIPIENT"));
  const mint = new PublicKey(process.env.SOLANA_USDC_MINT?.trim() || MAINNET_USDC_MINT);
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = buildFifaTransaction(sender, escrowOwner, mint, requestId, blockhash, lastValidBlockHeight);

  const callback = new URL(`${baseUrl()}${FIFA_CALLBACK_PATH}`);
  callback.searchParams.set("request", requestId);
  return {
    transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    message: `Deposit ${FIFA_PRICE_USDC} USDC for FIFA 26 information. Verify the escrow address before signing.`,
    links: { next: { type: "post", href: callback.pathname + callback.search } },
  };
}

export const __test = {
  associatedTokenAddress,
  buildFifaTransaction,
  buildHelloTransaction,
  fifaMetadata,
  helloMetadata,
  recordReceipt,
};

function accountKey(value: any) {
  return String(value?.pubkey ?? value);
}

function transactionMemo(transaction: any) {
  for (const instruction of transaction.transaction.message.instructions || []) {
    if (instruction?.program === "spl-memo" && typeof instruction.parsed === "string") return instruction.parsed;
  }
  return "";
}

async function verifyFifaPayment(signature: string, expectedRequest?: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) throw new Error("invalid transaction signature");
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction || transaction.meta?.err) throw new Error("transaction is not confirmed successfully");

  const memo = transactionMemo(transaction);
  if (!memo.startsWith(FIFA_MEMO_PREFIX)) throw new Error("transaction is not a FIFA 26 payment");
  const requestId = validRequestId(memo.slice(FIFA_MEMO_PREFIX.length));
  if (expectedRequest && requestId !== expectedRequest) throw new Error("payment reference does not match this request");

  const escrowOwner = new PublicKey(requiredEnv("SOLANA_USDC_ESCROW_RECIPIENT"));
  const mint = new PublicKey(process.env.SOLANA_USDC_MINT?.trim() || MAINNET_USDC_MINT);
  const escrowTokenAccount = associatedTokenAddress(mint, escrowOwner).toBase58();
  const keys = transaction.transaction.message.accountKeys.map(accountKey);
  const escrowIndex = keys.indexOf(escrowTokenAccount);
  if (escrowIndex < 0) throw new Error("escrow token account is missing from transaction");

  const balance = (items: readonly any[] | null | undefined) => {
    const item = items?.find((entry) => entry.accountIndex === escrowIndex && entry.mint === mint.toBase58());
    return BigInt(item?.uiTokenAmount?.amount || "0");
  };
  const received = balance(transaction.meta?.postTokenBalances) - balance(transaction.meta?.preTokenBalances);
  if (received !== BigInt(FIFA_PRICE_BASE_UNITS)) throw new Error("transaction did not deposit exactly 0.01 USDC");

  const signer = transaction.transaction.message.accountKeys.find((key: any) => key.signer);
  return { requestId, account: accountKey(signer), signature, receivedUSDC: FIFA_PRICE_USDC };
}

function recordReceipt(payment: any, consume: boolean) {
  const receipts = readReceipts();
  const existing = receipts[payment.signature];
  if (consume && existing?.status === "consumed") throw new Error("this FIFA 26 payment was already used");
  receipts[payment.signature] = {
    ...payment,
    confirmedAt: existing?.confirmedAt || new Date().toISOString(),
    consumedAt: consume ? new Date().toISOString() : existing?.consumedAt,
    status: consume ? "consumed" : existing?.status || "confirmed",
  };
  writeReceipts(receipts);
  return receipts[payment.signature];
}

function icon(res: any) {
  cors(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#9945ff"/><stop offset="1" stop-color="#14f195"/></linearGradient></defs><rect width="512" height="512" rx="96" fill="#09090b"/><path fill="url(#g)" d="M143 329h278l-52 54H91l52-54zm0-200h278l-52 54H91l52-54zm226 100H91l52 54h278l-52-54z"/></svg>`);
}

function helloPage(res: any) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hello Solana Blink</title><style>body{margin:0;background:#09090b;color:#fafafa;font:16px system-ui;display:grid;min-height:100vh;place-items:center}.card{width:min(92vw,440px);padding:28px;border:1px solid #27272a;border-radius:22px;background:#18181b;box-shadow:0 20px 70px #0008}h1{margin:0 0 10px;font-size:30px}.tag{color:#14f195;font-weight:700}.muted{color:#a1a1aa;line-height:1.5}button,a.button{display:block;box-sizing:border-box;width:100%;margin-top:18px;padding:14px 18px;border:0;border-radius:12px;background:linear-gradient(90deg,#9945ff,#14f195);color:#09090b;font-weight:800;text-align:center;text-decoration:none;cursor:pointer}button:disabled{opacity:.55;cursor:wait}#status{white-space:pre-wrap;margin-top:18px;padding:12px;border-radius:10px;background:#09090b;min-height:24px}</style></head><body><main class="card"><div class="tag">XPENNY BLINK TEST</div><h1>Hello Solana</h1><p class="muted">Sign a memo-only transaction to test Telegram → Blink → Phantom → Solana → callback. No SOL or tokens are transferred; the network fee applies.</p><button id="run">Say hello</button><a id="phantom" class="button" hidden>Open in Phantom</a><div id="status">Ready.</div></main><script src="${WEB3_BROWSER_PATH}"></script><script src="${HELLO_CLIENT_PATH}"></script></body></html>`);
}

function helloClient(res: any) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(`(()=>{const run=document.getElementById('run'),status=document.getElementById('status'),open=document.getElementById('phantom');const page=location.href;open.href='https://phantom.app/ul/browse/'+encodeURIComponent(page)+'?ref='+encodeURIComponent(location.origin);if(!window.phantom?.solana){open.hidden=false;status.textContent='Phantom was not detected. Open this page inside Phantom.'}const sleep=ms=>new Promise(r=>setTimeout(r,ms));run.onclick=async()=>{run.disabled=true;open.hidden=true;try{const provider=window.phantom?.solana;if(!provider)throw new Error('Open this page in Phantom or install the Phantom browser extension.');status.textContent='Connecting to Phantom…';const connected=await provider.connect();const account=connected.publicKey.toString();status.textContent='Preparing memo transaction…';const meta=await fetch('${HELLO_ACTION_PATH}').then(r=>{if(!r.ok)throw new Error('Action metadata failed');return r.json()});const action=await fetch(meta.links.actions[0].href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account})}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.message||'Action failed');return b});const bytes=Uint8Array.from(atob(action.transaction),c=>c.charCodeAt(0));const tx=solanaWeb3.Transaction.from(bytes);status.textContent='Review and sign in Phantom…';const sent=await provider.signAndSendTransaction(tx);const signature=typeof sent==='string'?sent:sent.signature;status.textContent='Confirming on Solana…\n'+signature;let done,last;for(let i=0;i<20;i++){await sleep(1500);const response=await fetch(action.links.next.href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({account,signature})});last=await response.json();if(response.ok){done=last;break}}if(!done)throw new Error(last?.message||'Transaction confirmation timed out');status.textContent=done.title+'\n\n'+done.description}catch(e){status.textContent='Test failed: '+(e?.message||e);run.disabled=false}}})();`);
}

function web3BrowserBundle(res: any) {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const bundle = path.resolve(currentDir, "../node_modules/@solana/web3.js/lib/index.iife.min.js");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(fs.readFileSync(bundle));
  } catch {
    json(res, 500, { message: "Solana browser library is unavailable" });
  }
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

async function fifaActionHandler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      cors(res); res.statusCode = 204; res.end(); return true;
    }
    const url = new URL(req.url, baseUrl());
    if (req.method === "GET") {
      json(res, 200, fifaMetadata(url.searchParams.get("request") || undefined));
      return true;
    }
    if (req.method === "POST") {
      const requestId = validRequestId(url.searchParams.get("request"));
      const body = await readJson(req);
      if (typeof body.account !== "string") throw new Error("account is required");
      json(res, 200, await createFifaTransaction(body.account, requestId));
      return true;
    }
    json(res, 405, { message: "Method not allowed" }); return true;
  } catch (error: any) {
    json(res, 400, { message: error?.message || "Unable to create FIFA 26 payment" }); return true;
  }
}

async function fifaCallbackHandler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      cors(res); res.statusCode = 204; res.end(); return true;
    }
    if (req.method !== "POST") {
      json(res, 405, { message: "Method not allowed" }); return true;
    }
    const url = new URL(req.url, baseUrl());
    const requestId = validRequestId(url.searchParams.get("request"));
    const body = await readJson(req);
    const payment = await verifyFifaPayment(String(body.signature || ""), requestId);
    recordReceipt(payment, false);
    json(res, 200, {
      type: "completed",
      icon: `${baseUrl()}${ICON_PATH}`,
      title: "FIFA 26 payment confirmed",
      description: `Return to Telegram and send this transaction signature to reveal your result: ${payment.signature}`,
      label: "Payment confirmed",
    });
    return true;
  } catch (error: any) {
    json(res, 400, { message: error?.message || "Unable to verify FIFA 26 payment" }); return true;
  }
}

async function fifaVerifyHandler(req: any, res: any) {
  try {
    if (req.method !== "GET") {
      json(res, 405, { message: "Method not allowed" }); return true;
    }
    const url = new URL(req.url, baseUrl());
    const payment = await verifyFifaPayment(url.searchParams.get("signature") || "");
    const receipt = recordReceipt(payment, true);
    json(res, 200, { verified: true, ...receipt });
    return true;
  } catch (error: any) {
    json(res, 400, { verified: false, message: error?.message || "Unable to verify FIFA 26 payment" }); return true;
  }
}

async function helloActionHandler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      cors(res); res.statusCode = 204; res.end(); return true;
    }
    const url = new URL(req.url, baseUrl());
    if (req.method === "GET") {
      json(res, 200, helloMetadata(url.searchParams.get("request") || undefined));
      return true;
    }
    if (req.method === "POST") {
      const requestId = validRequestId(url.searchParams.get("request"));
      const body = await readJson(req);
      if (typeof body.account !== "string") throw new Error("account is required");
      json(res, 200, await createHelloTransaction(body.account, requestId));
      return true;
    }
    json(res, 405, { message: "Method not allowed" }); return true;
  } catch (error: any) {
    json(res, 400, { message: error?.message || "Unable to create Hello Solana transaction" }); return true;
  }
}

async function helloCallbackHandler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      cors(res); res.statusCode = 204; res.end(); return true;
    }
    if (req.method !== "POST") {
      json(res, 405, { message: "Method not allowed" }); return true;
    }
    const url = new URL(req.url, baseUrl());
    const requestId = validRequestId(url.searchParams.get("request"));
    const body = await readJson(req);
    const signature = String(body.signature || "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) throw new Error("invalid transaction signature");
    const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const transaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction || transaction.meta?.err) throw new Error("transaction is not confirmed successfully");
    if (transactionMemo(transaction) !== `${HELLO_MEMO_PREFIX}${requestId}`) {
      throw new Error("Hello Solana memo does not match this request");
    }
    json(res, 200, {
      type: "completed",
      icon: `${baseUrl()}${ICON_PATH}`,
      title: "Hello from Solana!",
      description: "Telegram → Blink → wallet → Solana → callback is working. No payment was transferred.",
      label: "Test complete",
    });
    return true;
  } catch (error: any) {
    json(res, 400, { message: error?.message || "Unable to verify Hello Solana transaction" }); return true;
  }
}

export default function register(api: any) {
  api.registerHttpRoute({ path: "/actions.json", auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    json(res, 200, { rules: [
      { pathPattern: "/pay", apiPath: ACTION_PATH },
      { pathPattern: "/fifa26", apiPath: FIFA_ACTION_PATH },
      { pathPattern: "/hello-solana", apiPath: HELLO_ACTION_PATH },
      { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
    ] });
    return true;
  }});
  api.registerHttpRoute({ path: ICON_PATH, auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    icon(res);
    return true;
  }});
  api.registerHttpRoute({ path: ACTION_PATH, auth: "plugin", match: "exact", handler: actionHandler });
  api.registerHttpRoute({ path: FIFA_ACTION_PATH, auth: "plugin", match: "exact", handler: fifaActionHandler });
  api.registerHttpRoute({ path: FIFA_CALLBACK_PATH, auth: "plugin", match: "exact", handler: fifaCallbackHandler });
  api.registerHttpRoute({ path: FIFA_VERIFY_PATH, auth: "plugin", match: "exact", handler: fifaVerifyHandler });
  api.registerHttpRoute({ path: HELLO_ACTION_PATH, auth: "plugin", match: "exact", handler: helloActionHandler });
  api.registerHttpRoute({ path: HELLO_CALLBACK_PATH, auth: "plugin", match: "exact", handler: helloCallbackHandler });
  api.registerHttpRoute({ path: HELLO_PAGE_PATH, auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    helloPage(res); return true;
  } });
  api.registerHttpRoute({ path: HELLO_CLIENT_PATH, auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    helloClient(res); return true;
  } });
  api.registerHttpRoute({ path: WEB3_BROWSER_PATH, auth: "plugin", match: "exact", handler: async (_req: any, res: any) => {
    web3BrowserBundle(res); return true;
  } });
}
