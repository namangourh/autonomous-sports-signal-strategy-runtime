package com.assr.signalengine.ingestion;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OracleHashUtilTest {

    /**
     * Cross-language conformance vector — the TypeScript equivalent lives at
     * services/execution-client/src/oracle-hash/oracleHash.test.ts. Both
     * MUST assert the same expectedHash for these inputs (see
     * docs/oracle-hash-spec.md). If you change the canonical format, update
     * both tests together.
     */
    @Test
    void matchesCrossLanguageConformanceVector() {
        String fixtureId = "wc2026-fixture-001";
        String rawPayload = "{\"home\":1.85,\"draw\":3.40,\"away\":4.20}";
        long timestampMillis = 1751328000000L;
        String expectedHash = "07412353647fd859890792dddc12b7db547ae1bddba93d79841b7214853cba38";

        String actual = OracleHashUtil.compute(fixtureId, rawPayload.getBytes(StandardCharsets.UTF_8), timestampMillis);

        assertEquals(expectedHash, actual);
    }
}
