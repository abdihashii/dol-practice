use anchor_lang::prelude::*;

declare_id!("55wZTBRpDdCt5tEz9dpsKgwmrATUZc6v2237cXQkTgX");

#[program]
pub mod dol_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
