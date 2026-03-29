use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("So1VoteXProgram11111111111111111111111111111");

// No hardcoded admin — any registered admin can create polls with their server-generated wallet

#[program]
pub mod solvotex {
    use super::*;

    /// Admin creates a new SPL token mint for voting
    /// Any signer can create a mint — the admin identity is managed by the backend
    pub fn create_vote_mint(
        ctx: Context<CreateVoteMint>,
        decimals: u8,
    ) -> Result<()> {
        msg!("Vote mint created by {}: {}", ctx.accounts.admin.key(), ctx.accounts.mint.key());
        Ok(())
    }

    /// Admin mints tokens to their supply wallet
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let seeds = &[
            b"mint_authority",
            mint_key.as_ref(),
            &[ctx.bumps.mint_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.admin_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        msg!("Minted {} tokens to {}", amount, ctx.accounts.admin.key());
        Ok(())
    }

    /// Admin creates a new poll with voting period
    /// The poll stores the admin's public key — only this admin can add candidates
    pub fn initialize_poll(
        ctx: Context<InitializePoll>,
        poll_id: u64,
        description: String,
        poll_start: u64,
        poll_end: u64,
    ) -> Result<()> {
        require!(poll_end > poll_start, SolVoteXError::InvalidTimeRange);
        require!(description.len() <= 280, SolVoteXError::DescriptionTooLong);

        let poll = &mut ctx.accounts.poll;
        poll.poll_id = poll_id;
        poll.admin = ctx.accounts.admin.key();
        poll.description = description;
        poll.poll_start = poll_start;
        poll.poll_end = poll_end;
        poll.candidate_amount = 0;
        poll.total_votes = 0;
        poll.mint = ctx.accounts.mint.key();

        msg!("Poll {} created by {}", poll_id, ctx.accounts.admin.key());
        Ok(())
    }

    /// Admin adds a candidate to a poll (only the poll's admin can do this)
    pub fn initialize_candidate(
        ctx: Context<InitializeCandidate>,
        poll_id: u64,
        candidate_name: String,
        party: String,
        symbol_image: String,
    ) -> Result<()> {
        // Verify the signer is the poll's admin
        require!(
            ctx.accounts.admin.key() == ctx.accounts.poll.admin,
            SolVoteXError::Unauthorized
        );
        require!(candidate_name.len() <= 64, SolVoteXError::NameTooLong);
        require!(party.len() <= 64, SolVoteXError::NameTooLong);

        let poll = &mut ctx.accounts.poll;
        poll.candidate_amount += 1;

        let candidate = &mut ctx.accounts.candidate;
        candidate.poll = ctx.accounts.poll.key();
        candidate.poll_id = poll_id;
        candidate.candidate_name = candidate_name.clone();
        candidate.party = party;
        candidate.symbol_image = symbol_image;
        candidate.votes = 0;

        msg!("Candidate '{}' added to poll {}", candidate_name, poll_id);
        Ok(())
    }

    /// Voter casts a vote — transfers 1 token to poll vault, records vote on-chain
    pub fn vote(
        ctx: Context<Vote>,
        poll_id: u64,
        candidate_name: String,
    ) -> Result<()> {
        let poll = &ctx.accounts.poll;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;

        // Time-based checks
        require!(current_time >= poll.poll_start, SolVoteXError::VotingNotStarted);
        require!(current_time <= poll.poll_end, SolVoteXError::VotingEnded);

        // Verify mint matches poll's mint
        require!(
            ctx.accounts.mint.key() == poll.mint,
            SolVoteXError::InvalidMintAddress
        );

        // Transfer 1 token from voter to poll vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.voter_token_account.to_account_info(),
                    to: ctx.accounts.poll_vault.to_account_info(),
                    authority: ctx.accounts.voter.to_account_info(),
                },
            ),
            1, // 1 token per vote (no decimals needed — we use raw units)
        )?;

        // Record the vote (VoteRecord PDA prevents double voting)
        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.poll_id = poll_id;
        vote_record.candidate_name = candidate_name.clone();
        vote_record.timestamp = clock.unix_timestamp;

        // Increment candidate votes
        let candidate = &mut ctx.accounts.candidate;
        candidate.votes += 1;

        // Increment poll total votes
        let poll = &mut ctx.accounts.poll.to_account_info();
        let mut poll_data = ctx.accounts.poll.clone();
        // We need to re-borrow mutably
        // Actually, let's handle this differently

        msg!(
            "Vote cast! Voter: {} -> Candidate: '{}' in Poll {}",
            ctx.accounts.voter.key(),
            candidate_name,
            poll_id
        );

        Ok(())
    }

    /// Update poll total votes (called internally, or can be a separate ix)
    pub fn update_poll_votes(
        ctx: Context<UpdatePollVotes>,
        poll_id: u64,
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        poll.total_votes += 1;
        Ok(())
    }
}

// ═══════════════════════════════════════════════════════════
// ACCOUNT STRUCTS
// ═══════════════════════════════════════════════════════════

#[account]
#[derive(InitSpace)]
pub struct Poll {
    pub poll_id: u64,
    pub admin: Pubkey,
    #[max_len(280)]
    pub description: String,
    pub poll_start: u64,
    pub poll_end: u64,
    pub candidate_amount: u64,
    pub total_votes: u64,
    pub mint: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Candidate {
    pub poll: Pubkey,
    pub poll_id: u64,
    #[max_len(64)]
    pub candidate_name: String,
    #[max_len(64)]
    pub party: String,
    #[max_len(256)]
    pub symbol_image: String,
    pub votes: u64,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub poll_id: u64,
    #[max_len(64)]
    pub candidate_name: String,
    pub timestamp: i64,
}

// ═══════════════════════════════════════════════════════════
// INSTRUCTION CONTEXTS
// ═══════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct CreateVoteMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        mint::decimals = 0,
        mint::authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA used as mint authority
    #[account(
        seeds = [b"mint_authority", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA mint authority
    #[account(
        seeds = [b"mint_authority", mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Poll::INIT_SPACE,
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    /// The SPL token mint for this poll
    pub mint: Account<'info, Mint>,

    /// Poll vault — PDA-owned token account that receives vote tokens
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = vault_authority,
        seeds = [b"vault", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the vault
    #[account(
        seeds = [b"vault_authority", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate_name: String)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        init,
        payer = admin,
        space = 8 + Candidate::INIT_SPACE,
        seeds = [b"candidate", poll_id.to_le_bytes().as_ref(), candidate_name.as_bytes()],
        bump,
    )]
    pub candidate: Account<'info, Candidate>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate_name: String)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        mut,
        seeds = [b"candidate", poll_id.to_le_bytes().as_ref(), candidate_name.as_bytes()],
        bump,
    )]
    pub candidate: Account<'info, Candidate>,

    /// Poll vault receives the vote token
    #[account(
        mut,
        seeds = [b"vault", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_vault: Account<'info, TokenAccount>,

    /// CHECK: Vault authority PDA
    #[account(
        seeds = [b"vault_authority", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The SPL token mint
    pub mint: Account<'info, Mint>,

    /// Voter's token account (must hold >= 1 token)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = voter,
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    /// Vote record PDA — prevents double voting
    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote_record", poll_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct UpdatePollVotes<'info> {
    #[account(
        mut,
        seeds = [b"poll", poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll: Account<'info, Poll>,
}

// ═══════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════

#[error_code]
pub enum SolVoteXError {
    #[msg("Voting has not started yet")]
    VotingNotStarted,
    #[msg("Voting has ended")]
    VotingEnded,
    #[msg("Invalid mint address for this poll")]
    InvalidMintAddress,
    #[msg("Unauthorized — admin only")]
    Unauthorized,
    #[msg("Invalid time range — end must be after start")]
    InvalidTimeRange,
    #[msg("Description too long (max 280 chars)")]
    DescriptionTooLong,
    #[msg("Name too long (max 64 chars)")]
    NameTooLong,
    #[msg("You have already voted in this poll")]
    AlreadyVoted,
}
