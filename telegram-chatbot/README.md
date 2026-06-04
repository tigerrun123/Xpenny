# Xpenny Telegram ChatGPT Bot

This is a simple Telegram chatbot that forwards user messages to the OpenAI
Responses API and replies inside Telegram.

## 1. Create a Telegram bot

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`.
3. Follow the prompts.
4. Copy the bot token.

Do not paste the token into chat. Keep it in `.env`.

## 2. Configure environment variables

```sh
cd telegram-chatbot
cp .env.example .env
```

Edit `.env`:

```text
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.2
```

## 3. Install and run

```sh
npm install
npm start
```

Then open your Telegram bot and send a message.

## Commands

- `/start` - Start the bot
- `/help` - Show help
- `/reset` - Clear this chat's conversation memory

## Notes

- This local version uses Telegram long polling.
- To keep it online 24/7, deploy it to a server or hosting platform that can run
  a Node.js background process.
- The website at `https://xpenny.netlify.app` is static, so it cannot host this
  long-running Telegram bot by itself.
