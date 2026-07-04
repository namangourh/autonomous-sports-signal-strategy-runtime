use anchor_lang::prelude::*;

declare_id!("2QwzfNdZx8DGbeu6VbSzcn9jaNidstZbC2XRL8Vy9ZrB");

const MAX_FIXTURE_ID_LEN: usize = 40;

#[program]
pub mod assr_v1 {
    use super::*;

    pub fn initialize_agent(
        ctx: Context<InitializeAgent>,
        strategy_id: u64,
        risk_params: RiskParams,
    ) -> Result<()> {
        let agent_config = &mut ctx.accounts.agent_config;
        agent_config.authority = ctx.accounts.authority.key();
        agent_config.strategy_id = strategy_id;
        agent_config.risk_params = risk_params;
        agent_config.active = true;
        agent_config.bump = ctx.bumps.agent_config;

        let performance = &mut ctx.accounts.performance;
        performance.agent = ctx.accounts.authority.key();
        performance.total_signals = 0;
        performance.cumulative_pnl_usdc = 0;
        performance.win_count = 0;
        performance.loss_count = 0;
        performance.max_drawdown_bps = 0;
        performance.last_updated = Clock::get()?.unix_timestamp;
        performance.bump = ctx.bumps.performance;

        Ok(())
    }

    /// `signal_seq` is caller-supplied (the execution client uses the source
    /// event's timestamp_millis) and must be unique per (agent, fixture_id) —
    /// reusing one fails account creation rather than overwriting, since
    /// signal logs are append-only.
    pub fn log_signal(
        ctx: Context<LogSignal>,
        fixture_id: String,
        signal_seq: u64,
        signal_type: u8,
        direction: i8,
        size_usdc: u64,
        oracle_hash: [u8; 32],
        execution_price: u64,
        tx_signature: Pubkey,
    ) -> Result<()> {
        require!(ctx.accounts.agent_config.active, AssrError::AgentPaused);
        require!(
            fixture_id.len() <= MAX_FIXTURE_ID_LEN,
            AssrError::FixtureIdTooLong
        );
        require!(direction == 1 || direction == -1, AssrError::InvalidDirection);

        let signal = &mut ctx.accounts.signal_log;
        signal.agent = ctx.accounts.authority.key();
        signal.fixture_id = fixture_id;
        signal.signal_seq = signal_seq;
        signal.signal_type = signal_type;
        signal.direction = direction;
        signal.size_usdc = size_usdc;
        signal.oracle_hash = oracle_hash;
        signal.signal_timestamp = Clock::get()?.unix_timestamp;
        signal.execution_price = execution_price;
        signal.tx_signature = tx_signature;
        signal.bump = ctx.bumps.signal_log;

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct RiskParams {
    pub max_pos_usdc: u64,
    pub max_drawdown_bps: u16,
}

#[account]
#[derive(InitSpace)]
pub struct AgentConfig {
    pub authority: Pubkey,
    pub strategy_id: u64,
    pub risk_params: RiskParams,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PerformancePda {
    pub agent: Pubkey,
    pub total_signals: u64,
    pub cumulative_pnl_usdc: i64,
    pub win_count: u64,
    pub loss_count: u64,
    pub max_drawdown_bps: u16,
    pub last_updated: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SignalLog {
    pub agent: Pubkey,
    #[max_len(40)]
    pub fixture_id: String,
    pub signal_seq: u64,
    pub signal_type: u8,
    pub direction: i8,
    pub size_usdc: u64,
    pub oracle_hash: [u8; 32],
    pub signal_timestamp: i64,
    pub execution_price: u64,
    pub tx_signature: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + AgentConfig::INIT_SPACE,
        seeds = [b"agent", authority.key().as_ref()],
        bump
    )]
    pub agent_config: Account<'info, AgentConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + PerformancePda::INIT_SPACE,
        seeds = [b"perf", authority.key().as_ref()],
        bump
    )]
    pub performance: Account<'info, PerformancePda>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(fixture_id: String, signal_seq: u64)]
pub struct LogSignal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"agent", authority.key().as_ref()],
        bump = agent_config.bump,
        has_one = authority,
    )]
    pub agent_config: Account<'info, AgentConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + SignalLog::INIT_SPACE,
        seeds = [b"signal", authority.key().as_ref(), fixture_id.as_bytes(), &signal_seq.to_le_bytes()],
        bump
    )]
    pub signal_log: Account<'info, SignalLog>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum AssrError {
    #[msg("agent is paused")]
    AgentPaused,
    #[msg("fixture id too long")]
    FixtureIdTooLong,
    #[msg("direction must be 1 or -1")]
    InvalidDirection,
}
