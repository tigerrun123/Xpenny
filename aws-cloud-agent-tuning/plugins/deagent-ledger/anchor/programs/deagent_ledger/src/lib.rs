use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("5SfS5maRBYUE3sEnfRX4xjNzRpPNhXPEsQjboCVKb41e");

const MAX_AGENT_ID_BYTES: usize = 64;
const MAX_METADATA_URI_BYTES: usize = 200;
const MAX_URI_BYTES: usize = 200;

#[program]
pub mod deagent_ledger {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: String,
        metadata_uri: String,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            agent_id.as_bytes().len() <= MAX_AGENT_ID_BYTES,
            DeAgentLedgerError::AgentIdTooLong
        );
        require!(
            metadata_uri.as_bytes().len() <= MAX_METADATA_URI_BYTES,
            DeAgentLedgerError::MetadataUriTooLong
        );

        let clock = Clock::get()?;
        let agent = &mut ctx.accounts.agent;
        agent.authority = ctx.accounts.authority.key();
        agent.agent_id = agent_id;
        agent.metadata_uri = metadata_uri;
        agent.metadata_hash = metadata_hash;
        agent.created_at = clock.unix_timestamp;
        agent.bump = ctx.bumps.agent;

        emit!(AgentRegistered {
            agent: agent.key(),
            authority: agent.authority,
            agent_id: agent.agent_id.clone(),
        });

        Ok(())
    }

    pub fn create_invocation(
        ctx: Context<CreateInvocation>,
        nonce: u64,
        task_hash: [u8; 32],
        input_uri: String,
    ) -> Result<()> {
        require!(
            input_uri.as_bytes().len() <= MAX_URI_BYTES,
            DeAgentLedgerError::UriTooLong
        );

        let clock = Clock::get()?;
        let invocation = &mut ctx.accounts.invocation;
        invocation.agent = ctx.accounts.agent.key();
        invocation.requester = ctx.accounts.requester.key();
        invocation.task_hash = task_hash;
        invocation.status = InvocationStatus::Pending;
        invocation.input_uri = input_uri;
        invocation.output_uri = String::new();
        invocation.created_at = clock.unix_timestamp;
        invocation.updated_at = clock.unix_timestamp;
        invocation.completed_at = None;
        invocation.nonce = nonce;
        invocation.bump = ctx.bumps.invocation;

        emit!(InvocationCreated {
            invocation: invocation.key(),
            agent: invocation.agent,
            requester: invocation.requester,
            task_hash,
            nonce,
        });

        Ok(())
    }

    pub fn submit_result(
        ctx: Context<SubmitResult>,
        output_uri: String,
    ) -> Result<()> {
        require!(
            output_uri.as_bytes().len() <= MAX_URI_BYTES,
            DeAgentLedgerError::UriTooLong
        );

        let invocation = &mut ctx.accounts.invocation;
        require!(
            invocation.status == InvocationStatus::Pending,
            DeAgentLedgerError::InvocationNotPending
        );

        let clock = Clock::get()?;
        invocation.output_uri = output_uri;
        invocation.status = InvocationStatus::Completed;
        invocation.updated_at = clock.unix_timestamp;
        invocation.completed_at = Some(clock.unix_timestamp);

        emit!(InvocationCompleted {
            invocation: invocation.key(),
            agent: invocation.agent,
            requester: invocation.requester,
        });

        Ok(())
    }

    pub fn initialize_reputation(ctx: Context<InitializeReputation>) -> Result<()> {
        let clock = Clock::get()?;
        let reputation = &mut ctx.accounts.reputation;
        reputation.agent = ctx.accounts.agent.key();
        reputation.score = 0;
        reputation.completed_invocations = 0;
        reputation.failed_invocations = 0;
        reputation.updated_at = clock.unix_timestamp;
        reputation.bump = ctx.bumps.reputation;

        emit!(ReputationInitialized {
            reputation: reputation.key(),
            agent: reputation.agent,
        });

        Ok(())
    }

    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        score_delta: i64,
        completed_delta: u64,
        failed_delta: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let reputation = &mut ctx.accounts.reputation;
        reputation.score = reputation
            .score
            .checked_add(score_delta)
            .ok_or(error!(DeAgentLedgerError::ReputationScoreOverflow))?;
        reputation.completed_invocations = reputation
            .completed_invocations
            .checked_add(completed_delta)
            .ok_or(error!(DeAgentLedgerError::ReputationCounterOverflow))?;
        reputation.failed_invocations = reputation
            .failed_invocations
            .checked_add(failed_delta)
            .ok_or(error!(DeAgentLedgerError::ReputationCounterOverflow))?;
        reputation.updated_at = clock.unix_timestamp;

        emit!(ReputationUpdated {
            reputation: reputation.key(),
            agent: reputation.agent,
            score: reputation.score,
            completed_invocations: reputation.completed_invocations,
            failed_invocations: reputation.failed_invocations,
        });

        Ok(())
    }

    pub fn deposit_escrow(ctx: Context<DepositEscrow>, amount: u64) -> Result<()> {
        require!(amount > 0, DeAgentLedgerError::InvalidEscrowAmount);

        let clock = Clock::get()?;
        let escrow = &mut ctx.accounts.escrow;
        escrow.invocation = ctx.accounts.invocation.key();
        escrow.agent = ctx.accounts.agent.key();
        escrow.requester = ctx.accounts.requester.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.vault = ctx.accounts.escrow_vault.key();
        escrow.amount = amount;
        escrow.status = EscrowStatus::Funded;
        escrow.created_at = clock.unix_timestamp;
        escrow.released_at = None;
        escrow.bump = ctx.bumps.escrow;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.requester_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.requester.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        emit!(EscrowDeposited {
            escrow: escrow.key(),
            invocation: escrow.invocation,
            requester: escrow.requester,
            mint: escrow.mint,
            amount,
        });

        Ok(())
    }

    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Funded,
            DeAgentLedgerError::EscrowNotFunded
        );

        let invocation_key = ctx.accounts.invocation.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"escrow",
            invocation_key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ]];

        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.agent_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            ctx.accounts.escrow.amount,
            ctx.accounts.mint.decimals,
        )?;

        let escrow = &mut ctx.accounts.escrow;
        escrow.status = EscrowStatus::Released;
        escrow.released_at = Some(Clock::get()?.unix_timestamp);

        emit!(PaymentReleased {
            escrow: escrow.key(),
            invocation: escrow.invocation,
            agent: escrow.agent,
            mint: escrow.mint,
            amount: escrow.amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = AgentAccount::SPACE,
        seeds = [b"agent", authority.key().as_ref(), agent_id.as_bytes()],
        bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateInvocation<'info> {
    pub agent: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = requester,
        space = InvocationAccount::SPACE,
        seeds = [
            b"invocation",
            agent.key().as_ref(),
            requester.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub invocation: Account<'info, InvocationAccount>,
    #[account(mut)]
    pub requester: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitResult<'info> {
    #[account(
        has_one = authority,
        seeds = [b"agent", authority.key().as_ref(), agent.agent_id.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(
        mut,
        has_one = agent,
        seeds = [
            b"invocation",
            agent.key().as_ref(),
            invocation.requester.as_ref(),
            &invocation.nonce.to_le_bytes()
        ],
        bump = invocation.bump
    )]
    pub invocation: Account<'info, InvocationAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(
        has_one = authority,
        seeds = [b"agent", authority.key().as_ref(), agent.agent_id.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = authority,
        space = ReputationAccount::SPACE,
        seeds = [b"reputation", agent.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        has_one = authority,
        seeds = [b"agent", authority.key().as_ref(), agent.agent_id.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(
        mut,
        has_one = agent,
        seeds = [b"reputation", agent.key().as_ref()],
        bump = reputation.bump
    )]
    pub reputation: Account<'info, ReputationAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(
        has_one = agent,
        has_one = requester,
        seeds = [
            b"invocation",
            agent.key().as_ref(),
            requester.key().as_ref(),
            &invocation.nonce.to_le_bytes()
        ],
        bump = invocation.bump
    )]
    pub invocation: Account<'info, InvocationAccount>,
    pub agent: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = requester,
        space = EscrowAccount::SPACE,
        seeds = [b"escrow", invocation.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = requester,
        token::mint = mint,
        token::authority = escrow
    )]
    pub escrow_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = requester_token_account.owner == requester.key(),
        constraint = requester_token_account.mint == mint.key()
    )]
    pub requester_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub requester: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReleasePayment<'info> {
    #[account(
        has_one = authority,
        seeds = [b"agent", authority.key().as_ref(), agent.agent_id.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(
        has_one = agent,
        seeds = [
            b"invocation",
            agent.key().as_ref(),
            invocation.requester.as_ref(),
            &invocation.nonce.to_le_bytes()
        ],
        bump = invocation.bump
    )]
    pub invocation: Account<'info, InvocationAccount>,
    #[account(
        mut,
        has_one = invocation,
        has_one = agent,
        has_one = mint,
        has_one = vault,
        seeds = [b"escrow", invocation.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut, address = escrow.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = escrow.mint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = agent_token_account.owner == authority.key(),
        constraint = agent_token_account.mint == mint.key()
    )]
    pub agent_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct AgentAccount {
    pub authority: Pubkey,
    pub agent_id: String,
    pub metadata_uri: String,
    pub metadata_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

impl AgentAccount {
    pub const SPACE: usize = 8
        + 32
        + 4 + MAX_AGENT_ID_BYTES
        + 4 + MAX_METADATA_URI_BYTES
        + 32
        + 8
        + 1;
}

#[account]
pub struct InvocationAccount {
    pub agent: Pubkey,
    pub requester: Pubkey,
    pub task_hash: [u8; 32],
    pub status: InvocationStatus,
    pub input_uri: String,
    pub output_uri: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
    pub nonce: u64,
    pub bump: u8,
}

impl InvocationAccount {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 32
        + 1
        + 4 + MAX_URI_BYTES
        + 4 + MAX_URI_BYTES
        + 8
        + 8
        + 1 + 8
        + 8
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum InvocationStatus {
    Pending,
    Completed,
}

#[account]
pub struct ReputationAccount {
    pub agent: Pubkey,
    pub score: i64,
    pub completed_invocations: u64,
    pub failed_invocations: u64,
    pub updated_at: i64,
    pub bump: u8,
}

impl ReputationAccount {
    pub const SPACE: usize = 8
        + 32
        + 8
        + 8
        + 8
        + 8
        + 1;
}

#[account]
pub struct EscrowAccount {
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub requester: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub status: EscrowStatus,
    pub created_at: i64,
    pub released_at: Option<i64>,
    pub bump: u8,
}

impl EscrowAccount {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 32
        + 32
        + 32
        + 8
        + 1
        + 8
        + 1 + 8
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Funded,
    Released,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub authority: Pubkey,
    pub agent_id: String,
}

#[event]
pub struct InvocationCreated {
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub requester: Pubkey,
    pub task_hash: [u8; 32],
    pub nonce: u64,
}

#[event]
pub struct InvocationCompleted {
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub requester: Pubkey,
}

#[event]
pub struct ReputationInitialized {
    pub reputation: Pubkey,
    pub agent: Pubkey,
}

#[event]
pub struct ReputationUpdated {
    pub reputation: Pubkey,
    pub agent: Pubkey,
    pub score: i64,
    pub completed_invocations: u64,
    pub failed_invocations: u64,
}

#[event]
pub struct EscrowDeposited {
    pub escrow: Pubkey,
    pub invocation: Pubkey,
    pub requester: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PaymentReleased {
    pub escrow: Pubkey,
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum DeAgentLedgerError {
    #[msg("Agent id is too long.")]
    AgentIdTooLong,
    #[msg("Metadata URI is too long.")]
    MetadataUriTooLong,
    #[msg("URI is too long.")]
    UriTooLong,
    #[msg("Invocation is not pending.")]
    InvocationNotPending,
    #[msg("Reputation score overflow.")]
    ReputationScoreOverflow,
    #[msg("Reputation counter overflow.")]
    ReputationCounterOverflow,
    #[msg("Escrow amount must be greater than zero.")]
    InvalidEscrowAmount,
    #[msg("Escrow is not funded.")]
    EscrowNotFunded,
}
