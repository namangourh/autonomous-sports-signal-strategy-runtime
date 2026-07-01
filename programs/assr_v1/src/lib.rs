use anchor_lang::prelude::*;

declare_id!("82uF2pCgDACbpuXW1tDSDCQJ7PYUKtETE1GoRSAL4Tdj");

#[program]
pub mod assr_v1 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
