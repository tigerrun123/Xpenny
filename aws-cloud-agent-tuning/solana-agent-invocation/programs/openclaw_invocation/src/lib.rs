use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5SfS5maRBYUE3sEnfRX4xjNzRpPNhXPEsQjboCVKb41e");

const MAX_SLUG_BYTES: usize = 32;
const MAX_URI_BYTES: usize = 200;

#[program]
pub mod openclaw_invocation {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        slug: String,
        manifest_uri: String,
        manifest_hash: [u8; 32],
        agent_signer: Pubkey,
        price_lamports: u64,
    ) -> Result<()> {
        require!(slug.as_bytes().len() <= MAX_SLUG_BYTES, InvocationError::SlugTooLong);
        require!(
            manifest_uri.as_bytes().len() <= MAX_URI_BYTES,
            InvocationError::UriTooLong
        );

        let agent = &mut ctx.accounts.agent;
        agent.owner = ctx.accounts.owner.key();
        agent.agent_signer = agent_signer;
        agent.slug = slug;
        agent.manifest_uri = manifest_uri;
        agent.manifest_hash = manifest_hash;
        agent.price_lamports = price_lamports;
        agent.active = true;
        agent.bump = ctx.bumps.agent;

        emit!(AgentRegistered {
            agent: agent.key(),
            owner: agent.owner,
            agent_signer,
            price_lamports,
        });

        Ok(())
    }

    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        manifest_uri: String,
        manifest_hash: [u8; 32],
        agent_signer: Pubkey,
        price_lamports: u64,
        active: bool,
    ) -> Result<()> {
        require!(
            manifest_uri.as_bytes().len() <= MAX_URI_BYTES,
            InvocationError::UriTooLong
        );

        let agent = &mut ctx.accounts.agent;
        agent.manifest_uri = manifest_uri;
        agent.manifest_hash = manifest_hash;
        agent.agent_signer = agent_signer;
        agent.price_lamports = price_lamports;
        agent.active = active;

        emit!(AgentUpdated {
            agent: agent.key(),
            active,
            price_lamports,
        });

        Ok(())
    }

    pub fn create_invocation(
        ctx: Context<CreateInvocation>,
        nonce: u64,
        input_hash: [u8; 32],
        input_uri: String,
    ) -> Result<()> {
        require!(ctx.accounts.agent.active, InvocationError::AgentInactive);
        require!(
            input_uri.as_bytes().len() <= MAX_URI_BYTES,
            InvocationError::UriTooLong
        );

        let price_lamports = ctx.accounts.agent.price_lamports;
        if price_lamports > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.requester.to_account_info(),
                        to: ctx.accounts.invocation.to_account_info(),
                    },
                ),
                price_lamports,
            )?;
        }

        let clock = Clock::get()?;
        let invocation = &mut ctx.accounts.invocation;
        invocation.agent = ctx.accounts.agent.key();
        invocation.requester = ctx.accounts.requester.key();
        invocation.input_hash = input_hash;
        invocation.input_uri = input_uri;
        invocation.result_hash = None;
        invocation.result_uri = String::new();
        invocation.status = InvocationStatus::Pending;
        invocation.escrow_lamports = price_lamports;
        invocation.created_at = clock.unix_timestamp;
        invocation.completed_at = None;
        invocation.nonce = nonce;
        invocation.bump = ctx.bumps.invocation;

        emit!(InvocationCreated {
            invocation: invocation.key(),
            agent: invocation.agent,
            requester: invocation.requester,
            nonce,
            input_hash,
        });

        Ok(())
    }

    pub fn complete_invocation(
        ctx: Context<CompleteInvocation>,
        result_hash: [u8; 32],
        result_uri: String,
    ) -> Result<()> {
        require!(
            result_uri.as_bytes().len() <= MAX_URI_BYTES,
            InvocationError::UriTooLong
        );

        let invocation = &mut ctx.accounts.invocation;
        require!(
            invocation.status == InvocationStatus::Pending,
            InvocationError::InvocationNotPending
        );

        let escrow_lamports = invocation.escrow_lamports;
        if escrow_lamports > 0 {
            **invocation.to_account_info().try_borrow_mut_lamports()? -= escrow_lamports;
            **ctx.accounts.agent_owner.try_borrow_mut_lamports()? += escrow_lamports;
        }

        let clock = Clock::get()?;
        invocation.result_hash = Some(result_hash);
        invocation.result_uri = result_uri;
        invocation.status = InvocationStatus::Completed;
        invocation.escrow_lamports = 0;
        invocation.completed_at = Some(clock.unix_timestamp);

        emit!(InvocationCompleted {
            invocation: invocation.key(),
            agent: invocation.agent,
            requester: invocation.requester,
            result_hash,
        });

        Ok(())
    }

    pub fn cancel_invocation(ctx: Context<CancelInvocation>) -> Result<()> {
        let invocation = &mut ctx.accounts.invocation;
        require!(
            invocation.status == InvocationStatus::Pending,
            InvocationError::InvocationNotPending
        );

        let escrow_lamports = invocation.escrow_lamports;
        if escrow_lamports > 0 {
            **invocation.to_account_info().try_borrow_mut_lamports()? -= escrow_lamports;
            **ctx.accounts.requester.to_account_info().try_borrow_mut_lamports()? += escrow_lamports;
        }

        invocation.status = InvocationStatus::Cancelled;
        invocation.escrow_lamports = 0;
        invocation.completed_at = Some(Clock::get()?.unix_timestamp);

        emit!(InvocationCancelled {
            invocation: invocation.key(),
            agent: invocation.agent,
            requester: invocation.requester,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(slug: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = Agent::SPACE,
        seeds = [b"agent", owner.key().as_ref(), slug.as_bytes()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        has_one = owner,
        seeds = [b"agent", owner.key().as_ref(), agent.slug.as_bytes()],
        bump = agent.bump
    )]
    pub agent: Account<'info, Agent>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateInvocation<'info> {
    #[account(mut)]
    pub agent: Account<'info, Agent>,
    #[account(
        init,
        payer = requester,
        space = Invocation::SPACE,
        seeds = [
            b"invocation",
            agent.key().as_ref(),
            requester.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub invocation: Account<'info, Invocation>,
    #[account(mut)]
    pub requester: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteInvocation<'info> {
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
    pub invocation: Account<'info, Invocation>,
    #[account(has_one = agent_signer)]
    pub agent: Account<'info, Agent>,
    pub agent_signer: Signer<'info>,
    /// CHECK: The program only credits lamports to the owner recorded on the agent account.
    #[account(mut, address = agent.owner)]
    pub agent_owner: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelInvocation<'info> {
    #[account(
        mut,
        has_one = requester,
        seeds = [
            b"invocation",
            invocation.agent.as_ref(),
            requester.key().as_ref(),
            &invocation.nonce.to_le_bytes()
        ],
        bump = invocation.bump
    )]
    pub invocation: Account<'info, Invocation>,
    #[account(mut)]
    pub requester: Signer<'info>,
}

#[account]
pub struct Agent {
    pub owner: Pubkey,
    pub agent_signer: Pubkey,
    pub slug: String,
    pub manifest_uri: String,
    pub manifest_hash: [u8; 32],
    pub price_lamports: u64,
    pub active: bool,
    pub bump: u8,
}

impl Agent {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 4 + MAX_SLUG_BYTES
        + 4 + MAX_URI_BYTES
        + 32
        + 8
        + 1
        + 1;
}

#[account]
pub struct Invocation {
    pub agent: Pubkey,
    pub requester: Pubkey,
    pub input_hash: [u8; 32],
    pub input_uri: String,
    pub result_hash: Option<[u8; 32]>,
    pub result_uri: String,
    pub status: InvocationStatus,
    pub escrow_lamports: u64,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub nonce: u64,
    pub bump: u8,
}

impl Invocation {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 32
        + 4 + MAX_URI_BYTES
        + 1 + 32
        + 4 + MAX_URI_BYTES
        + 1
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
    Cancelled,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub agent_signer: Pubkey,
    pub price_lamports: u64,
}

#[event]
pub struct AgentUpdated {
    pub agent: Pubkey,
    pub active: bool,
    pub price_lamports: u64,
}

#[event]
pub struct InvocationCreated {
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub requester: Pubkey,
    pub nonce: u64,
    pub input_hash: [u8; 32],
}

#[event]
pub struct InvocationCompleted {
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub requester: Pubkey,
    pub result_hash: [u8; 32],
}

#[event]
pub struct InvocationCancelled {
    pub invocation: Pubkey,
    pub agent: Pubkey,
    pub requester: Pubkey,
}

#[error_code]
pub enum InvocationError {
    #[msg("Agent slug is too long.")]
    SlugTooLong,
    #[msg("URI is too long.")]
    UriTooLong,
    #[msg("Agent is inactive.")]
    AgentInactive,
    #[msg("Invocation is not pending.")]
    InvocationNotPending,
}
