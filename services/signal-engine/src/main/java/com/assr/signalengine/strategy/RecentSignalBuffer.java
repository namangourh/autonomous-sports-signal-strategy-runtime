package com.assr.signalengine.strategy;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Bounded recent history of detected signals, served by GET
 * /api/v1/agent/{id}/signals. This reflects what the strategy engine
 * detected, not confirmed on-chain state — cross-check a signal's
 * oracle_hash against Solana Explorer for on-chain proof.
 */
@Component
public class RecentSignalBuffer {

    private static final int MAX_SIZE = 200;

    private final ConcurrentLinkedDeque<StrategySignal> buffer = new ConcurrentLinkedDeque<>();

    public void add(StrategySignal signal) {
        buffer.addLast(signal);
        while (buffer.size() > MAX_SIZE) {
            buffer.pollFirst();
        }
    }

    public List<StrategySignal> recent(int limit) {
        List<StrategySignal> all = List.copyOf(buffer);
        int from = Math.max(0, all.size() - limit);
        return all.subList(from, all.size());
    }
}
