package com.assr.signalengine.strategy;

import com.assr.signalengine.kafka.KafkaTopics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/** Shared by live detection (StrategyRunner) and backtest replay (BacktestService). */
@Component
public class SignalPublisher {

    private static final Logger log = LoggerFactory.getLogger(SignalPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public SignalPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(StrategySignal signal) {
        try {
            String json = objectMapper.writeValueAsString(signal);
            kafkaTemplate.send(KafkaTopics.SPORTS_SIGNALS, signal.fixtureId(), json);
        } catch (Exception e) {
            log.error("failed to publish strategy signal", e);
        }
    }
}
