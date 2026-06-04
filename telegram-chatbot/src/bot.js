import "dotenv/config";
import OpenAI from "openai";
import { Telegraf } from "telegraf";

const { TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, OPENAI_MODEL = "gpt-5.2" } = process.env;

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

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
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

  await ctx.reply(formatHyperliquidTopTraders(timeframe, sort));
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
