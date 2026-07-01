package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import com.assr.signalengine.kafka.KafkaTopics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Consumes raw TxLINE events and runs every registered {@link Strategy}
 * against each one. Qualifying signals are published to
 * {@link KafkaTopics#SPORTS_SIGNALS} for the execution client to size and
 * (paper-)execute.
 */
@Component
public class StrategyRunner {

    private static final Logger log = LoggerFactory.getLogger(StrategyRunner.class);

    private final List<Strategy> strategies;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public StrategyRunner(List<Strategy> strategies, KafkaTemplate<String, String> kafkaTemplate,
                           ObjectMapper objectMapper) {
        this.strategies = strategies;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = KafkaTopics.SPORTS_EVENTS_RAW, groupId = "signal-engine")
    public void onRawEvent(String json) {
        try {
            RawTxLineEvent event = objectMapper.readValue(json, RawTxLineEvent.class);
            for (Strategy strategy : strategies) {
                strategy.evaluate(event).ifPresent(this::publishSignal);
            }
        } catch (Exception e) {
            log.error("failed to process raw event", e);
        }
    }

    private void publishSignal(StrategySignal signal) {
        try {
            String json = objectMapper.writeValueAsString(signal);
            kafkaTemplate.send(KafkaTopics.SPORTS_SIGNALS, signal.fixtureId(), json);
        } catch (Exception e) {
            log.error("failed to publish strategy signal", e);
        }
    }
}
