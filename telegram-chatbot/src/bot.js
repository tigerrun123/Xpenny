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
  await ctx.reply("Ask me anything. Use /reset to clear this chat memory.");
});

bot.command("reset", async (ctx) => {
  conversations.delete(ctx.chat.id);
  await ctx.reply("Chat memory reset.");
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

await bot.launch();
console.log("Xpenny Telegram ChatGPT bot is running.");

const shutdown = (signal) => {
  bot.stop(signal);
  process.exit(0);
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
