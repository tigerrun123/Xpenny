# OpenClaw Solana Blinks

An OpenClaw plugin that exposes a public Solana Action for SOL payments. It creates an unsigned transaction for the requesting wallet; it never stores a seed phrase or private key.

Required gateway environment:

```sh
SOLANA_BLINK_BASE_URL=https://your-lightsail-dashboard-host
SOLANA_BLINK_RECIPIENT=your_solana_public_key
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
- `GET /api/actions/xpenny-icon.svg`

Example Blink:

```text
https://dial.to/?action=solana-action%3Ahttps%3A%2F%2FYOUR_HOST%2Fapi%2Factions%2Fpay
```
