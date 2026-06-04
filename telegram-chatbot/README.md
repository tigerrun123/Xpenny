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
HYPERTRACKER_API_TOKEN=optional_hypertracker_api_token
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
- `/hyper_top` - Show demo Hyperliquid top traders
- `/hyper_top 7d roi` - Show demo top 10 traders by ROI
- `/hyper_top 30d pnl` - Show demo top 10 traders by PnL
- `/hyper_loss` - Show top 10 loss traders by 7D PnL
- `/hyper_loss 30d pnl` - Show top 10 loss traders by 30D PnL

The Hyperliquid command currently uses demo data. To make it live, connect a
leaderboard API such as Nansen, HyData, HyperTracker, or another data provider
that exposes Hyperliquid trader PnL/ROI rankings.

## Hyperliquid live data

The bot supports HyperTracker live leaderboard data when
`HYPERTRACKER_API_TOKEN` is set in `.env`.

HyperTracker's public docs list a Free Tier with 100 requests per day. Create a
CoinMarketMan/HyperTracker account, open the API Dashboard, generate a key, and
paste it into `.env`:

```text
HYPERTRACKER_API_TOKEN=your_hypertracker_api_token
```

Then restart:

```sh
npm start
```

The `/hyper_top` and `/hyper_loss` commands use the HyperTracker `perp-pnl`
leaderboard endpoint. If the token is missing or the API request fails, the bot
falls back to demo data.

## Notes

- This local version uses Telegram long polling.
- To keep it online 24/7, deploy it to a server or hosting platform that can run
  a Node.js background process.
- The website at `https://xpenny.netlify.app` is static, so it cannot host this
  long-running Telegram bot by itself.
