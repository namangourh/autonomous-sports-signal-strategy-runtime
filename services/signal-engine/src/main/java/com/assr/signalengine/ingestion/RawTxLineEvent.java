package com.assr.signalengine.ingestion;

public record RawTxLineEvent(
        String fixtureId,
        String eventType,
        String rawPayloadBase64,
        long timestampMillis,
        String oracleHash) {
}
