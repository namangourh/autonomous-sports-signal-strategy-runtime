package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Optional;

/**
 * Flags a value bet when TxLINE's snapshot price implies a fair probability
 * meaningfully below the de-vigged consensus across the books in the same
 * snapshot (report's "de-vig using Pinnacle line as benchmark" strategy).
 *
 * TODO: field names below (home/draw/away/book) are placeholders pending
 * real TxLINE /odds response docs. Wire up once a developer account is set up.
 */
@Component
public class ValueBetDetector implements Strategy {

    private static final double EDGE_THRESHOLD = 0.03;
    private static final String BENCHMARK_BOOK = "pinnacle";

    private final ObjectMapper objectMapper;

    public ValueBetDetector(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String id() {
        return "value-bet";
    }

    @Override
    public Optional<StrategySignal> evaluate(RawTxLineEvent event) {
        if (!"ODDS_SNAPSHOT".equals(event.eventType())) {
            return Optional.empty();
        }

        try {
            byte[] raw = Base64.getDecoder().decode(event.rawPayloadBase64());
            JsonNode root = objectMapper.readTree(raw);
            JsonNode benchmark = TxLinePayloadParser.findBook(root, BENCHMARK_BOOK);
            JsonNode candidate = TxLinePayloadParser.findBook(root, tradingBookName());
            if (benchmark == null || candidate == null) {
                return Optional.empty();
            }

            OddsDevigCalculator.FairProbabilities fair = OddsDevigCalculator.devig(
                    benchmark.get("home").asDouble(),
                    benchmark.get("draw").asDouble(),
                    benchmark.get("away").asDouble());

            double candidateHomeOdds = candidate.get("home").asDouble();
            double homeEdge = OddsDevigCalculator.edge(candidateHomeOdds, fair.home());
            if (homeEdge > EDGE_THRESHOLD) {
                double candidateImpliedProb = 1.0 / candidateHomeOdds;
                return Optional.of(new StrategySignal(
                        id(), event.fixtureId(), SignalType.VALUE_BET, 1, homeEdge, candidateImpliedProb,
                        event.oracleHash(), event.timestampMillis()));
            }
        } catch (Exception e) {
            // malformed/unexpected payload shape — skip this event rather than fail the batch
            return Optional.empty();
        }
        return Optional.empty();
    }

    private String tradingBookName() {
        return "txline";
    }
}
