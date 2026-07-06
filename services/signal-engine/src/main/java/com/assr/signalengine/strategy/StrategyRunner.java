package com.assr.signalengine.strategy;

import com.assr.signalengine.ingestion.RawTxLineEvent;
import com.assr.signalengine.kafka.KafkaTopics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Consumes raw TxLINE events and runs every registered {@link Strategy}
 * against each one. Qualifying signals are published to
 * {@link KafkaTopics#SPORTS_SIGNALS} for the execution client to size and
 * (paper-)execute, and buffered locally for the REST API.
 */
@Component
public class StrategyRunner {

    private static final Logger log = LoggerFactory.getLogger(StrategyRunner.class);

    private final List<Strategy> strategies;
    private final ObjectMapper objectMapper;
    private final SignalPublisher signalPublisher;
    private final RecentEventBuffer recentEventBuffer;
    private final RecentSignalBuffer recentSignalBuffer;

    public StrategyRunner(List<Strategy> strategies, ObjectMapper objectMapper, SignalPublisher signalPublisher,
                           RecentEventBuffer recentEventBuffer, RecentSignalBuffer recentSignalBuffer) {
        this.strategies = strategies;
        this.objectMapper = objectMapper;
        this.signalPublisher = signalPublisher;
        this.recentEventBuffer = recentEventBuffer;
        this.recentSignalBuffer = recentSignalBuffer;
    }

    @KafkaListener(topics = KafkaTopics.SPORTS_EVENTS_RAW, groupId = "signal-engine")
    public void onRawEvent(String json) {
        try {
            RawTxLineEvent event = objectMapper.readValue(json, RawTxLineEvent.class);
            recentEventBuffer.add(event);
            for (Strategy strategy : strategies) {
                strategy.evaluate(event).ifPresent(signal -> {
                    recentSignalBuffer.add(signal);
                    signalPublisher.publish(signal);
                });
            }
        } catch (Exception e) {
            log.error("failed to process raw event", e);
        }
    }
}
