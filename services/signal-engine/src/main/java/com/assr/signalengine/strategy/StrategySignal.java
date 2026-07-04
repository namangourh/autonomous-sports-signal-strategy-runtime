package com.assr.signalengine.strategy;

/**
 * A strategy's raw call on a single TxLINE event, before position sizing.
 * The execution client applies Kelly sizing and risk gating downstream
 * (see services/execution-client) before anything is logged on-chain.
 *
 * @param direction              +1 for long, -1 for short
 * @param edge                   estimated edge as a fraction (e.g. 0.04 = 4%), strategy-specific meaning
 * @param candidateImpliedProb   implied probability of the price being traded (1 / decimal odds) —
 *                                the Kelly sizing input paired with edge; see
 *                                services/execution-client/src/risk/kellySizing.ts
 */
public record StrategySignal(
        String strategyId,
        String fixtureId,
        SignalType signalType,
        int direction,
        double edge,
        double candidateImpliedProb,
        String oracleHash,
        long timestampMillis) {
}
