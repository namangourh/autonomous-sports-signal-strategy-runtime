package com.assr.signalengine.ingestion;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Reference implementation of the oracle_hash canonical spec (docs/oracle-hash-spec.md).
 * Hashes the untouched raw TxLINE payload bytes, never a re-serialized object, so a
 * TypeScript implementation given the same inputs produces a byte-identical digest.
 */
public final class OracleHashUtil {

    private static final byte[] DELIMITER = { '|' };

    private OracleHashUtil() {
    }

    public static String compute(String fixtureId, byte[] rawPayloadBytes, long timestampMillis) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(fixtureId.getBytes(StandardCharsets.UTF_8));
            digest.update(DELIMITER);
            digest.update(rawPayloadBytes);
            digest.update(DELIMITER);
            digest.update(Long.toString(timestampMillis).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
