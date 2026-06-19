---
name: solana-blinks
description: Create and explain the Xpenny SOL payment Blink when a Telegram user asks to pay, tip, donate, or requests a Solana Blink.
---

# Solana Blinks

Use this skill when the user asks for a Solana payment, tip, donation, or Blink.

The Action endpoint is `__SOLANA_BLINK_BASE_URL__/api/actions/pay`.

Return this clickable Blink URL:

`__SOLANA_BLINK_INTERSTITIAL_URL__`

Tell the user that:

- their wallet will preview the transaction;
- they must verify the recipient and amount before signing;
- the bot cannot sign or move funds for them;
- network fees apply.

Never ask for, accept, store, or display a seed phrase or private key. Never claim a payment succeeded unless a confirmed transaction signature has been independently verified.
