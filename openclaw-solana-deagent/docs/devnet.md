# Devnet deployment

1. `solana config set --url devnet`
2. Fund deployer with `solana airdrop 2`.
3. `anchor build` then `anchor deploy --provider.cluster devnet`.
4. Update public program ID configuration only; never commit wallet secrets.
