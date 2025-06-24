use anchor_lang::prelude::*;

declare_id!("89oT3JtfnGATv6hTyzt3fD3y95JNrmEzDRRMYrJ8X53R");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod dol_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.user.key();
        counter.count = 0;
        msg!("Counter initialized with authority: {:?}", counter.authority);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented to: {}", counter.count);
        Ok(())
    }

    pub fn get_count(ctx: Context<View>) -> Result<()> {
        let counter = &ctx.accounts.counter;
        msg!("Current count: {}", counter.count);
        Ok(())
    }
}

#[account]
pub struct Counter {
    pub authority: Pubkey,
    pub count: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = ANCHOR_DISCRIMINATOR + 32 + ANCHOR_DISCRIMINATOR)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut, has_one = authority)]
    pub counter: Account<'info, Counter>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct View<'info> {
    pub counter: Account<'info, Counter>,
}
