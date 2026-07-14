#!/usr/bin/env bash
set -euo pipefail
solana config set --url devnet
spl-token create-token
