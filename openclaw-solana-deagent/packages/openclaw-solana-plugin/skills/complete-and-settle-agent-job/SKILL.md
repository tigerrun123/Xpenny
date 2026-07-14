# complete-and-settle-agent-job

Guide: fetch the job, verify assignment/status, accept and start, perform off-chain work, create a canonical result manifest, hash evidence/result files, call `solana_submit_result`, request evaluation, call `solana_submit_evaluation`, prepare or call `solana_settle_job`, verify final on-chain state, and return Explorer references plus a concise audit summary. Never expose secrets; Devnet only.
