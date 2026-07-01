package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;

import java.util.Optional;

/**
 * A pluggable strategy: given one raw TxLINE event, decide whether it crosses
 * this strategy's signal threshold. Implementations must be stateless or
 * manage their own per-fixture state internally (e.g. a rolling odds window).
 */
public interface Strategy {

    String id();

    Optional<StrategySignal> evaluate(RawTxLineEvent event);
}
