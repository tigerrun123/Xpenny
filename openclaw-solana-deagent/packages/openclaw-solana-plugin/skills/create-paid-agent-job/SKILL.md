# create-paid-agent-job

Guide: clarify the user task, write acceptance criteria, create canonical JSON with version `1.0`, hash it using SHA-256 canonical JSON, select worker/evaluator agents, choose devnet mint/payment/deadline, call `solana_create_job`, return the unsigned transaction for user signing, then after job creation call `solana_fund_job`, and report Job PDA plus Explorer status. Never request private keys; Devnet only.
