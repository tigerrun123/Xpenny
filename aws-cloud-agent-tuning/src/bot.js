import "dotenv/config";
import http from "node:http";
import { Telegraf } from "telegraf";
import { askCloudAgent } from "./agent-client.js";
import { appendMessage, clearConversation, getConversation } from "./conversation-store.js";

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_MODE = "polling",
  TELEGRAM_WEBHOOK_PATH = "/telegram/webhook",
  TELEGRAM_WEBHOOK_SECRET,
  TELEGRAM_WEBHOOK_URL,
  PORT = "3000",
} = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in environment.");
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

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
  await ctx.reply("LiveSailing cloud agent is connected. Send me a message.");
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Send any message and I will route it to the cloud agent.",
      "",
      "Commands:",
      "/start - Start the bot",
      "/help - Show this help",
      "/reset - Clear this chat memory",
      "/health - Check bot status",
    ].join("\n"),
  );
});

bot.command("reset", async (ctx) => {
  clearConversation(ctx.chat.id);
  await ctx.reply("Chat memory reset.");
});

bot.command("health", async (ctx) => {
  await ctx.reply("Bot is running. Telegram is connected.");
});

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const userText = ctx.message.text;

  if (!userText || userText.startsWith("/")) {
    return;
  }

  await ctx.sendChatAction("typing");

  try {
    const history = getConversation(chatId);
    const reply = await askCloudAgent({ chatId, userText, history });

    appendMessage(chatId, "user", userText);
    appendMessage(chatId, "assistant", reply);

    await sendLongMessage(ctx, reply);
  } catch (error) {
    console.error("Agent request failed:", error);
    await ctx.reply(`Agent request failed: ${error.message}`);
  }
});

bot.catch((error) => {
  console.error("Telegram bot error:", error);
});

async function launchPolling() {
  await bot.launch();
  console.log("Telegram bot is running in polling mode.");
}

async function launchWebhook() {
  if (!TELEGRAM_WEBHOOK_URL) {
    throw new Error("TELEGRAM_WEBHOOK_URL is required when TELEGRAM_MODE=webhook.");
  }

  await bot.telegram.setWebhook(TELEGRAM_WEBHOOK_URL, {
    secret_token: TELEGRAM_WEBHOOK_SECRET,
  });

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method !== "POST" || req.url !== TELEGRAM_WEBHOOK_PATH) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    if (
      TELEGRAM_WEBHOOK_SECRET &&
      req.headers["x-telegram-bot-api-secret-token"] !== TELEGRAM_WEBHOOK_SECRET
    ) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    try {
      const update = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      await bot.handleUpdate(update);
      res.writeHead(200);
      res.end("OK");
    } catch (error) {
      console.error("Webhook update failed:", error);
      res.writeHead(400);
      res.end("Bad request");
    }
  });

  server.listen(Number(PORT), () => {
    console.log(`Telegram bot is running in webhook mode on port ${PORT}.`);
  });
}

if (TELEGRAM_MODE === "webhook") {
  await launchWebhook();
} else {
  await launchPolling();
}

const shutdown = (signal) => {
  bot.stop(signal);
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

