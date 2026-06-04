import "dotenv/config";
import OpenAI from "openai";
import { Telegraf } from "telegraf";

const {
  TELEGRAM_BOT_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5.2",
  HYPERTRACKER_API_TOKEN,
} = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in environment.");
}

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment.");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const conversations = new Map();

const developerInstructions = `
You are the Xpenny Telegram assistant.
Answer clearly and conversationally.
If the user asks about the Xpenny project, explain it as an XPEN token and agentomics prototype.
Keep responses concise unless the user asks for detail.
`;

const demoHyperliquidTraders = [
  { wallet: "0x8fd1...a902", market: "BTC", roi: 184.6, pnl: 42850, volume: 1250000 },
  { wallet: "0x41ac...77be", market: "HYPE", roi: 152.4, pnl: 31920, volume: 842000 },
  { wallet: "0x99e4...310d", market: "ETH", roi: 133.8, pnl: 28740, volume: 930000 },
  { wallet: "0x6b20...f18a", market: "SOL", roi: 118.2, pnl: 22410, volume: 610000 },
  { wallet: "0xd71f...ce22", market: "BTC", roi: 104.9, pnl: 19880, volume: 710000 },
  { wallet: "0x2c0a...bb14", market: "PURR", roi: 97.3, pnl: 15420, volume: 338000 },
  { wallet: "0xb934...a61c", market: "ETH", roi: 88.5, pnl: 14310, volume: 520000 },
  { wallet: "0x54bd...02fa", market: "FARTCOIN", roi: 76.7, pnl: 12690, volume: 289000 },
  { wallet: "0xe401...8910", market: "DOGE", roi: 69.2, pnl: 9800, volume: 241000 },
  { wallet: "0x0a79...6d45", market: "LINK", roi: 61.8, pnl: 8720, volume: 198000 },
];

const demoHyperliquidLossTraders = [
  { wallet: "0x93cb...4a80", market: "BTC", roi: -48.4, pnl: -68420, volume: 1510000 },
  { wallet: "0xaa11...8f2d", market: "ETH", roi: -43.1, pnl: -52980, volume: 1180000 },
  { wallet: "0x71f9...b0c3", market: "HYPE", roi: -39.6, pnl: -44750, volume: 870000 },
  { wallet: "0x6802...e1aa", market: "SOL", roi: -34.2, pnl: -38210, volume: 730000 },
  { wallet: "0xf8d4...71d0", market: "DOGE", roi: -31.8, pnl: -29450, volume: 502000 },
  { wallet: "0x2f5b...19e7", market: "FARTCOIN", roi: -28.7, pnl: -25160, volume: 420000 },
  { wallet: "0xc044...dd92", market: "LINK", roi: -24.9, pnl: -21480, volume: 390000 },
  { wallet: "0x9d7e...3b11", market: "PURR", roi: -22.5, pnl: -18420, volume: 310000 },
  { wallet: "0x318c...a5fb", market: "ETH", roi: -19.3, pnl: -15330, volume: 285000 },
  { wallet: "0x40ab...906c", market: "BTC", roi: -17.4, pnl: -12980, volume: 260000 },
];

function formatUsd(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function normalizeHyperArgs(timeframe = "7d", sort = "roi") {
  const periodMap = {
    "1d": "Day",
    "24h": "Day",
    "7d": "Week",
    "30d": "Month",
    all: "AllTime",
    alltime: "AllTime",
  };
  const period = periodMap[timeframe.toLowerCase()] || "Week";
  const normalizedSort = ["pnl", "roi", "volume"].includes(sort.toLowerCase())
    ? sort.toLowerCase()
    : "roi";

  return {
    orderBy: `pnl${period}`,
    period,
    sort: normalizedSort,
    timeframe,
  };
}

function getLeaderboardRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
}

function compactAddress(address = "") {
  if (address.length <= 14) {
    return address || "unknown";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTraderRows(traders, period) {
  return traders
    .slice(0, 10)
    .map((trader, index) => {
      const pnl = Number(trader[`pnl${period}`]);
      const roi = Number(trader[`pnlPercent${period}`]);
      const volume = Number(trader[`volume${period}`]);
      const equity = Number(trader.perpEquity);

      return [
        `${index + 1}. ${compactAddress(trader.address || trader.wallet)}`,
        `ROI: ${Number.isFinite(roi) ? `${roi.toFixed(1)}%` : "n/a"}`,
        `PnL: ${formatUsd(pnl)}`,
        `Eq: ${formatUsd(equity)}`,
        `Vol: ${formatUsd(volume)}`,
      ].join(" | ");
    })
    .join("\n");
}

async function fetchHyperTrackerLeaderboard(timeframe = "7d", sort = "roi", direction = "top") {
  if (!HYPERTRACKER_API_TOKEN) {
    return null;
  }

  const { orderBy, period, sort: normalizedSort } = normalizeHyperArgs(timeframe, sort);
  const url = new URL("https://ht-api.coinmarketman.com/api/external/leaderboards/perp-pnl");
  const order = direction === "loss" ? "asc" : "desc";

  url.searchParams.set("order", order);
  url.searchParams.set("orderBy", orderBy);
  url.searchParams.set("rankBy", orderBy);
  url.searchParams.set("limit", "25");
  url.searchParams.set("offset", "0");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${HYPERTRACKER_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HyperTracker API returned ${response.status}`);
  }

  const payload = await response.json();
  const field =
    normalizedSort === "roi"
      ? `pnlPercent${period}`
      : normalizedSort === "volume"
        ? `volume${period}`
        : `pnl${period}`;
  const traders = getLeaderboardRows(payload)
    .filter((trader) => Number.isFinite(Number(trader[field])))
    .sort((a, b) =>
      direction === "loss" ? Number(a[field]) - Number(b[field]) : Number(b[field]) - Number(a[field]),
    );

  if (!traders.length) {
    throw new Error("HyperTracker API returned no leaderboard rows");
  }

  const title = direction === "loss" ? "Top Loss Traders" : "Top Traders";

  return [
    `Hyperliquid ${title} Live (${timeframe.toUpperCase()} by ${normalizedSort.toUpperCase()})`,
    "",
    formatTraderRows(traders, period),
    "",
    "Source: HyperTracker perp-pnl leaderboard. Not financial advice.",
  ].join("\n");
}

function formatHyperliquidTopTraders(timeframe = "7d", sort = "roi") {
  const label = sort.toUpperCase();
  const rows = demoHyperliquidTraders
    .map((trader, index) => {
      return [
        `${index + 1}. ${trader.wallet}`,
        `Market: ${trader.market}`,
        `ROI: +${trader.roi.toFixed(1)}%`,
        `PnL: ${formatUsd(trader.pnl)}`,
        `Vol: ${formatUsd(trader.volume)}`,
      ].join(" | ");
    })
    .join("\n");

  return [
    `Hyperliquid Top Traders Demo (${timeframe.toUpperCase()} by ${label})`,
    "",
    rows,
    "",
    "Demo data only. Connect a leaderboard API key later for live Hyperliquid data.",
  ].join("\n");
}

function formatHyperliquidLossTraders(timeframe = "7d", sort = "pnl") {
  const label = sort.toUpperCase();
  const rows = demoHyperliquidLossTraders
    .map((trader, index) => {
      return [
        `${index + 1}. ${trader.wallet}`,
        `Market: ${trader.market}`,
        `ROI: ${trader.roi.toFixed(1)}%`,
        `PnL: ${formatUsd(trader.pnl)}`,
        `Vol: ${formatUsd(trader.volume)}`,
      ].join(" | ");
    })
    .join("\n");

  return [
    `Hyperliquid Top Loss Traders Demo (${timeframe.toUpperCase()} by ${label})`,
    "",
    rows,
    "",
    "Demo data only. Add HYPERTRACKER_API_TOKEN for live loss leaderboard data.",
  ].join("\n");
}

function splitTelegramMessage(text) {
  const chunks = [];
  const maxLength = 3900;

  for (let index = 0; index < text.length; index += maxLength) {
    chunks.push(text.slice(index, index + maxLength));
  }

  return chunks.length ? chunks : ["I could not generate a response."];
}

async function sendLongMessage(ctx, text) {
  for (const chunk of splitTelegramMessage(text)) {
    await ctx.reply(chunk);
  }
}

bot.start(async (ctx) => {
  await ctx.reply("Hello, I am the Xpenny ChatGPT bot. Send me a message.");
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Ask me anything.",
      "",
      "Commands:",
      "/reset - Clear this chat memory",
      "/hyper_top - Show demo Hyperliquid top traders",
      "/hyper_top 7d roi - Demo top 10 by ROI",
      "/hyper_top 30d pnl - Demo top 10 by PnL",
      "/hyper_loss - Show top 10 loss traders by 7D PnL",
      "/hyper_loss 30d pnl - Show top 10 loss traders by 30D PnL",
    ].join("\n"),
  );
});

bot.command("reset", async (ctx) => {
  conversations.delete(ctx.chat.id);
  await ctx.reply("Chat memory reset.");
});

bot.command("hyper_top", async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const timeframe = parts[1] || "7d";
  const sort = parts[2] || "roi";

  await ctx.sendChatAction("typing");

  try {
    const liveText = await fetchHyperTrackerLeaderboard(timeframe, sort, "top");
    await ctx.reply(liveText || formatHyperliquidTopTraders(timeframe, sort));
  } catch (error) {
    console.error("HyperTracker API error:", error);
    await ctx.reply(
      [
        formatHyperliquidTopTraders(timeframe, sort),
        "",
        "Live HyperTracker request failed, so I used demo data.",
      ].join("\n"),
    );
  }
});

bot.command("hyper_loss", async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const timeframe = parts[1] || "7d";
  const sort = parts[2] || "pnl";

  await ctx.sendChatAction("typing");

  try {
    const liveText = await fetchHyperTrackerLeaderboard(timeframe, sort, "loss");
    await ctx.reply(liveText || formatHyperliquidLossTraders(timeframe, sort));
  } catch (error) {
    console.error("HyperTracker loss API error:", error);
    await ctx.reply(
      [
        formatHyperliquidLossTraders(timeframe, sort),
        "",
        "Live HyperTracker loss request failed, so I used demo data.",
      ].join("\n"),
    );
  }
});

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userText = ctx.message.text;

  if (!userText || userText.startsWith("/")) {
    return;
  }

  await ctx.sendChatAction("typing");

  try {
    const previousResponseId = conversations.get(chatId);
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions: developerInstructions,
      input: userText,
      previous_response_id: previousResponseId,
      max_output_tokens: 900,
    });

    conversations.set(chatId, response.id);
    await sendLongMessage(ctx, response.output_text);
  } catch (error) {
    console.error(error);
    await ctx.reply("Sorry, I hit an error while talking to OpenAI. Please try again.");
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error);
});

async function launchWithRetry(maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bot.launch();
      console.log("Xpenny Telegram ChatGPT bot is running.");
      return;
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`Telegram launch failed (${attempt}/${maxAttempts}): ${message}`);

      if (attempt === maxAttempts) {
        console.error(
          "Could not connect to Telegram. Check your internet connection, VPN/proxy, and bot token.",
        );
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    }
  }
}

await launchWithRetry();

const shutdown = (signal) => {
  bot.stop(signal);
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
