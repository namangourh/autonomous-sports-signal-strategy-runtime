package com.assr.signalengine.strategy;

/**
 * A strategy's raw call on a single TxLINE event, before position sizing.
 * The execution client applies Kelly sizing and risk gating downstream
 * (see services/execution-client) before anything is logged on-chain.
 *
 * @param direction +1 for long, -1 for short
 * @param edge      estimated edge as a fraction (e.g. 0.04 = 4%), strategy-specific meaning
 */
public record StrategySignal(
        String strategyId,
        String fixtureId,
        SignalType signalType,
        int direction,
        double edge,
        String oracleHash,
        long timestampMillis) {
}
