package com.assr.signalengine.api;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight in-memory registry of strategy metadata ("publish a strategy
 * fingerprint" from the report). An on-chain strategy registry with
 * performance attestations is a future version (see plan V4), not V1.
 */
@Component
public class StrategyRegistry {

    public record RegisteredStrategy(String strategyId, String description, Instant registeredAt) {
    }

    private final Map<String, RegisteredStrategy> registered = new ConcurrentHashMap<>();

    public RegisteredStrategy register(String strategyId, String description) {
        RegisteredStrategy entry = new RegisteredStrategy(strategyId, description, Instant.now());
        registered.put(strategyId, entry);
        return entry;
    }

    public Map<String, RegisteredStrategy> all() {
        return Map.copyOf(registered);
    }
}
