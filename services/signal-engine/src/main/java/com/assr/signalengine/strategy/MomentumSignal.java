package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Base64;
import java.util.Deque;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Flags a signal when a fixture's home-win odds move 10%+ within a 5-minute
 * rolling window (report's "MomentumSignal" strategy). Keeps a small
 * per-fixture in-memory history; fine for a single-instance signal engine,
 * would need externalizing (e.g. to the database) if this ever scales out.
 *
 * TODO: field name ("home") is a placeholder pending real TxLINE /odds docs.
 */
@Component
public class MomentumSignal implements Strategy {

    private static final double MOVE_THRESHOLD = 0.10;
    private static final Duration WINDOW = Duration.ofMinutes(5);

    private final ObjectMapper objectMapper;
    private final ConcurrentMap<String, Deque<Sample>> historyByFixture = new ConcurrentHashMap<>();

    public MomentumSignal(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private record Sample(long timestampMillis, double homeOdds) {
    }

    @Override
    public String id() {
        return "momentum";
    }

    @Override
    public Optional<StrategySignal> evaluate(RawTxLineEvent event) {
        if (!"ODDS_SNAPSHOT".equals(event.eventType())) {
            return Optional.empty();
        }

        Double homeOdds = extractHomeOdds(event);
        if (homeOdds == null) {
            return Optional.empty();
        }

        Deque<Sample> history = historyByFixture.computeIfAbsent(event.fixtureId(), k -> new ArrayDeque<>());
        pruneOldSamples(history, event.timestampMillis());

        Optional<StrategySignal> signal = history.stream()
                .filter(s -> Math.abs(homeOdds - s.homeOdds()) / s.homeOdds() >= MOVE_THRESHOLD)
                .findFirst()
                .map(oldest -> new StrategySignal(
                        id(), event.fixtureId(), SignalType.MOMENTUM,
                        homeOdds < oldest.homeOdds() ? 1 : -1,
                        Math.abs(homeOdds - oldest.homeOdds()) / oldest.homeOdds(),
                        event.oracleHash(), event.timestampMillis()));

        history.addLast(new Sample(event.timestampMillis(), homeOdds));
        return signal;
    }

    private void pruneOldSamples(Deque<Sample> history, long nowMillis) {
        while (!history.isEmpty() && nowMillis - history.peekFirst().timestampMillis() > WINDOW.toMillis()) {
            history.removeFirst();
        }
    }

    private Double extractHomeOdds(RawTxLineEvent event) {
        try {
            byte[] raw = Base64.getDecoder().decode(event.rawPayloadBase64());
            JsonNode root = objectMapper.readTree(raw);
            JsonNode home = root.at("/home");
            return home.isMissingNode() ? null : home.asDouble();
        } catch (Exception e) {
            return null;
        }
    }
}
