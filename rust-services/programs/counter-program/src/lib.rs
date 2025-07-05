use anchor_lang::prelude::*;

declare_id!("9muGHnxBxrwhTGzET1mxYdSpKxLcE5w9Kw9yHSvzTKEH");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod counter_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter: &mut Account<'_, Counter> = &mut ctx.accounts.counter;
        counter.authority = ctx.accounts.user.key();
        counter.count = 0;
        counter.bump = ctx.bumps.counter;
        msg!("Counter initialized with authority: {:?}", counter.authority);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter: &mut Account<'_, Counter> = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented to: {}", counter.count);
        Ok(())
    }

    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter: &mut Account<'_, Counter> = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_sub(1).unwrap();
        msg!("Counter decremented to: {}", counter.count);
        Ok(())
    }

    pub fn get_count(ctx: Context<View>) -> Result<()> {
        let counter: &Account<'_, Counter> = &ctx.accounts.counter;
        msg!("Current count: {}", counter.count);
        Ok(())
    }
}

#[account]
pub struct Counter {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 1,
        seeds = [b"counter", user.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [b"counter", authority.key().as_ref()],
        bump = counter.bump
    )]
    pub counter: Account<'info, Counter>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct View<'info> {
    pub counter: Account<'info, Counter>,
}
