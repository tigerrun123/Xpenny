---
name: solana-blinks
description: Create Xpenny payment Blinks, and gate every Telegram request for FIFA 26 information behind a verified 0.01 USDC payment.
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

## FIFA 26 paid-result flow

When a Telegram user asks for any FIFA 26 information, do not provide the requested information yet.

1. Tell the user the result costs 0.01 USDC and the wallet will deposit it to the configured escrow address.
2. Send this Blink:

   `__SOLANA_FIFA26_BLINK_URL__`

3. Ask the user to return the confirmed Solana transaction signature.
4. Prepare the requested FIFA 26 answer internally, but do not reveal it yet.
5. Verify and consume the payment exactly once with:

   `curl --fail --silent --show-error --get '__SOLANA_BLINK_BASE_URL__/api/actions/fifa26/verify' --data-urlencode 'signature=THE_SIGNATURE'`

6. Reveal the prepared result only when the JSON response contains `"verified":true`.

If verification fails, explain the returned error and do not reveal the result. Never accept a screenshot, wallet-connect claim, or unconfirmed signature as payment. A signature already marked `consumed` cannot unlock another result.

Call this an escrow deposit only when `SOLANA_USDC_ESCROW_RECIPIENT` is genuinely controlled by the intended escrow arrangement. The plugin verifies deposits and one-time use; it does not release or refund funds.

## Hello Solana smoke test

When a Telegram user sends `hello Solana` (case-insensitive), reply with this Blink:

`__SOLANA_HELLO_BLINK_URL__`

Explain that it signs a memo-only transaction and transfers no SOL or tokens, but the wallet pays the normal Solana network fee. Do not answer with the ordinary cloud agent response instead of the Blink.
