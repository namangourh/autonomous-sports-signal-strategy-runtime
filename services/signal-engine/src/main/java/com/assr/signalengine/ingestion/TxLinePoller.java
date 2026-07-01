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
 */
@Component
public class TxLinePoller {

    private static final Logger log = LoggerFactory.getLogger(TxLinePoller.class);

    private final TxLineProperties properties;
    private final RestClient restClient;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

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
