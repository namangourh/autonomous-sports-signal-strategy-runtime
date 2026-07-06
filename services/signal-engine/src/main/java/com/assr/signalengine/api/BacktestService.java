package com.assr.signalengine.api;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import com.assr.signalengine.strategy.RecentEventBuffer;
import com.assr.signalengine.strategy.SignalPublisher;
import com.assr.signalengine.strategy.Strategy;
import com.assr.signalengine.strategy.StrategySignal;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

/**
 * Minimal backtest: replays the buffered recent raw-event history through
 * one named strategy and publishes any resulting signals exactly like the
 * live path does — so they get logged on-chain via the same execution-client
 * consumer, no separate on-chain-write path needed here.
 *
 * Replayed events get a single synthetic fixture_id ("backtest-<strategyId>-<runId>")
 * so a) they don't share MomentumSignal's live rolling-history state for the
 * real fixture, and b) they're clearly distinguishable on-chain from live
 * signals. Timestamps are also synthetic (current time, monotonically
 * increasing by 1ms per event) so replayed signals aren't rejected by the
 * execution client's staleness check or collide on signal_seq — the
 * oracle_hash is untouched and still represents the real original data.
 */
@Component
public class BacktestService {

    private final List<Strategy> strategies;
    private final RecentEventBuffer eventBuffer;
    private final SignalPublisher signalPublisher;

    public BacktestService(List<Strategy> strategies, RecentEventBuffer eventBuffer, SignalPublisher signalPublisher) {
        this.strategies = strategies;
        this.eventBuffer = eventBuffer;
        this.signalPublisher = signalPublisher;
    }

    public record BacktestResult(String strategyId, int eventsReplayed, int signalsGenerated) {
    }

    public BacktestResult run(String strategyId) {
        Strategy strategy = strategies.stream()
                .filter(s -> s.id().equals(strategyId))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("unknown strategy: " + strategyId));

        List<RawTxLineEvent> events = eventBuffer.recent();
        String backtestFixtureId = "backtest-" + strategyId + "-" + System.currentTimeMillis();
        long syntheticTimestampBase = System.currentTimeMillis();

        int signalsGenerated = 0;
        for (int i = 0; i < events.size(); i++) {
            RawTxLineEvent original = events.get(i);
            RawTxLineEvent backtestEvent = new RawTxLineEvent(
                    backtestFixtureId,
                    original.eventType(),
                    original.rawPayloadBase64(),
                    syntheticTimestampBase + i,
                    original.oracleHash());

            Optional<StrategySignal> signal = strategy.evaluate(backtestEvent);
            if (signal.isPresent()) {
                signalPublisher.publish(signal.get());
                signalsGenerated++;
            }
        }
        return new BacktestResult(strategyId, events.size(), signalsGenerated);
    }
}
