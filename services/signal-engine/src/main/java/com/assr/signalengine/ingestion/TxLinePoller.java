package com.assr.signalengine.ingestion;

import com.assr.signalengine.kafka.KafkaTopics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

/**
 * Polls TxLINE's free World Cup REST tier and publishes each fixture's raw
 * odds/score payloads onto {@link KafkaTopics#SPORTS_EVENTS_RAW}, tagged with
 * an oracle_hash computed per docs/oracle-hash-spec.md.
 *
 * Fixture list and per-fixture polling are intentionally separated so a
 * single stale/slow fixture doesn't block the others.
 *
 * When {@code txline.simulate=true} (no TxLINE API key available yet), this
 * generates a synthetic odds snapshot with a deliberate value-bet edge
 * instead of calling the real API, so the rest of the pipeline (Kafka →
 * strategy detection → on-chain proof) can be proven end-to-end. The
 * oracle_hash is still computed for real over the synthetic bytes — only the
 * data source is fake, not the proof mechanics. Remove once real TxLINE
 * credentials are wired up.
 */
@Component
public class TxLinePoller {

    private static final Logger log = LoggerFactory.getLogger(TxLinePoller.class);
    private static final String SIMULATED_FIXTURE_ID = "sim-wc2026-fixture-001";
    private static final double SIMULATED_BASE_HOME_ODDS = 2.30;
    private static final double SIMULATED_DRIFT_PER_POLL = 0.03;

    private final TxLineProperties properties;
    private final RestClient restClient;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private long simulationStep = 0;

    @Autowired
    public TxLinePoller(TxLineProperties properties, KafkaTemplate<String, String> kafkaTemplate,
                         ObjectMapper objectMapper) {
        this.properties = properties;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .defaultHeader("Authorization", "Bearer " + properties.getApiKey())
                .build();
    }

    @Scheduled(fixedDelayString = "${txline.poll-interval-ms:60000}")
    public void pollActiveFixtures() {
        if (properties.isSimulate()) {
            publishSimulatedOddsSnapshot();
            publishSimulatedScoreEventEvery(10);
            return;
        }

        List<String> fixtureIds = fetchActiveFixtureIds();
        for (String fixtureId : fixtureIds) {
            try {
                pollFixture(fixtureId);
            } catch (Exception e) {
                // one fixture failing must not stop the others
                log.warn("failed to poll fixture {}", fixtureId, e);
            }
        }
    }

    private List<String> fetchActiveFixtureIds() {
        // TODO: parse the real TxLINE /fixtures response shape once API access is available.
        return List.of();
    }

    private void pollFixture(String fixtureId) {
        publishRawEvent(fixtureId, "ODDS_SNAPSHOT", properties.getOddsPath() + "/" + fixtureId);
        publishRawEvent(fixtureId, "SCORE_EVENT", properties.getScoresPath() + "/" + fixtureId);
    }

    private void publishRawEvent(String fixtureId, String eventType, String path) {
        byte[] rawBody = restClient.get().uri(path).retrieve().body(byte[].class);
        if (rawBody == null) {
            return;
        }
        publishEvent(fixtureId, eventType, rawBody);
    }

    /**
     * Synthetic 2-book odds snapshot where TxLINE's own home price implies a
     * lower probability than the de-vigged Pinnacle line — i.e. an intentional
     * value bet for ValueBetDetector to catch (edge ≈ 3.6%+, above its 3%
     * threshold; the edge only grows as home odds drift upward below).
     *
     * TxLINE's home price also drifts upward a little each poll so
     * MomentumSignal has real movement to detect (10%+ within its 5-minute
     * window) rather than a static price that only ValueBetDetector reacts to.
     */
    private void publishSimulatedOddsSnapshot() {
        double txlineHomeOdds = currentSimulatedHomeOdds();
        simulationStep++;

        String payload = """
                {"books":[
                  {"name":"pinnacle","home":2.00,"draw":3.20,"away":4.00},
                  {"name":"txline","home":%.4f,"draw":3.20,"away":4.00}
                ]}""".formatted(txlineHomeOdds);
        publishEvent(SIMULATED_FIXTURE_ID, "ODDS_SNAPSHOT", payload.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Every {@code interval}-th poll, simulates a late goal (minute cycles
     * through 60–90, scoring team alternates) so GoalImpactSignal has
     * something to detect — the real /scores feed doesn't exist yet either.
     */
    private void publishSimulatedScoreEventEvery(int interval) {
        if (simulationStep == 0 || simulationStep % interval != 0) {
            return;
        }

        long cycle = simulationStep / interval;
        int minute = 60 + (int) (cycle % 31);
        String scoringTeam = (cycle % 2 == 0) ? "home" : "away";

        String payload = """
                {"minute":%d,"scoringTeam":"%s","candidateOdds":%.4f}""".formatted(
                minute, scoringTeam, currentSimulatedHomeOdds());
        publishEvent(SIMULATED_FIXTURE_ID, "SCORE_EVENT", payload.getBytes(StandardCharsets.UTF_8));
    }

    private double currentSimulatedHomeOdds() {
        return SIMULATED_BASE_HOME_ODDS + (simulationStep * SIMULATED_DRIFT_PER_POLL);
    }

    private void publishEvent(String fixtureId, String eventType, byte[] rawBody) {
        long timestampMillis = Instant.now().toEpochMilli();
        String oracleHash = OracleHashUtil.compute(fixtureId, rawBody, timestampMillis);
        RawTxLineEvent event = new RawTxLineEvent(
                fixtureId,
                eventType,
                Base64.getEncoder().encodeToString(rawBody),
                timestampMillis,
                oracleHash);
        try {
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(KafkaTopics.SPORTS_EVENTS_RAW, fixtureId, json);
        } catch (Exception e) {
            log.error("failed to publish raw event for fixture {}", fixtureId, e);
        }
    }
}
