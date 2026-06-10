# Telegram Chatbot Setup

The project is set up so Telegram is the user interface and the AWS/OpenCloud/LiveSailing agent is the backend brain.

## Flow

1. Telegram user sends a message.
2. `src/bot.js` receives it through polling or webhook.
3. `src/agent-client.js` sends the message to `AGENT_API_URL`.
4. The cloud agent replies.
5. The bot sends the reply back to Telegram.

## Required Values

- `TELEGRAM_BOT_TOKEN`
- `AGENT_API_URL`
- `AGENT_API_KEY` if the cloud endpoint requires authentication

## Local Run

```sh
npm install
npm start
```

## Cloud Run

For a long-running AWS host, use `TELEGRAM_MODE=polling`.

For public HTTPS hosting, use:

```text
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://your-host.example.com/telegram/webhook
TELEGRAM_WEBHOOK_PATH=/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=some-random-secret
```

