# OpenClaw Solana Blinks

An OpenClaw plugin that exposes a public Solana Action for SOL payments. It creates an unsigned transaction for the requesting wallet; it never stores a seed phrase or private key.

It also provides a FIFA 26 paid-result flow: a unique Blink deposits exactly 0.01 native USDC into the configured escrow wallet, an action-chain callback confirms the transaction, and Telegram consumes that payment receipt once before showing the requested result.

For smoke testing, `hello Solana` returns a memo-only Blink that transfers no SOL or tokens and completes with “Hello from Solana.” The wallet still pays the network fee.
The test UI is self-hosted at `/blinks/hello-solana`; it does not depend on Dialect's interstitial availability.

Required gateway environment:

```sh
SOLANA_BLINK_BASE_URL=https://your-lightsail-dashboard-host
SOLANA_BLINK_RECIPIENT=your_solana_public_key
SOLANA_USDC_ESCROW_RECIPIENT=your_escrow_owner_public_key
```

Optional:

```sh
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_BLINK_TITLE=Pay Xpenny with SOL
SOLANA_BLINK_DESCRIPTION=Review and sign this payment in your wallet.
```

Routes:

- `GET /actions.json`
- `GET|POST|OPTIONS /api/actions/pay`
- `GET|POST|OPTIONS /api/actions/fifa26`
- `POST /api/actions/fifa26/complete`
- `GET /api/actions/fifa26/verify?signature=...`
- `GET|POST|OPTIONS /api/actions/hello-solana`
- `POST /api/actions/hello-solana/complete`
- `GET /blinks/hello-solana`
- `GET /api/actions/xpenny-icon.svg`

Example Blink:

```text
https://dial.to/?action=solana-action%3Ahttps%3A%2F%2FYOUR_HOST%2Fapi%2Factions%2Fpay
```

The plugin verifies and consumes deposits but does not release or refund escrowed USDC. Point `SOLANA_USDC_ESCROW_RECIPIENT` only at a wallet or program-owned account governed by your actual escrow process.
