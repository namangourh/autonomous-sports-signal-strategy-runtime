package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Optional;

/**
 * Flags a position adjustment when a goal is scored late in the match
 * (minutes 60–90) — report's "GoalImpactSignal" strategy: back the scoring
 * team's continued dominance in a window where late goals are assumed to be
 * under-priced by the market.
 *
 * The assumed edge (EDGE_ESTIMATE) is a fixed heuristic, not derived from a
 * de-vig calculation like ValueBetDetector — the report doesn't specify the
 * exact math for this strategy, and validating a real number needs
 * historical goal-minute odds-movement data we don't have yet.
 *
 * TODO: field names below are placeholders pending real TxLINE /scores docs.
 */
@Component
public class GoalImpactSignal implements Strategy {

    private static final int WINDOW_START_MINUTE = 60;
    private static final int WINDOW_END_MINUTE = 90;
    private static final double EDGE_ESTIMATE = 0.04;

    private final ObjectMapper objectMapper;

    public GoalImpactSignal(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String id() {
        return "goal-impact";
    }

    @Override
    public Optional<StrategySignal> evaluate(RawTxLineEvent event) {
        if (!"SCORE_EVENT".equals(event.eventType())) {
            return Optional.empty();
        }

        try {
            byte[] raw = Base64.getDecoder().decode(event.rawPayloadBase64());
            JsonNode root = objectMapper.readTree(raw);

            JsonNode minuteNode = root.get("minute");
            JsonNode scoringTeamNode = root.get("scoringTeam");
            JsonNode candidateOddsNode = root.get("candidateOdds");
            if (minuteNode == null || scoringTeamNode == null || candidateOddsNode == null) {
                return Optional.empty();
            }

            int minute = minuteNode.asInt();
            if (minute < WINDOW_START_MINUTE || minute > WINDOW_END_MINUTE) {
                return Optional.empty();
            }

            int direction = "home".equalsIgnoreCase(scoringTeamNode.asText()) ? 1 : -1;
            double candidateImpliedProb = 1.0 / candidateOddsNode.asDouble();

            return Optional.of(new StrategySignal(
                    id(), event.fixtureId(), SignalType.GOAL_IMPACT, direction, EDGE_ESTIMATE, candidateImpliedProb,
                    event.oracleHash(), event.timestampMillis()));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
