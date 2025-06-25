use anchor_lang::prelude::*;

declare_id!("DoLotrsAZR2JYa4tjue2c5q4EYKMbm6kxcrvjbU5cxX5");

#[program]
pub mod dol_program {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("DoL program initialized!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}