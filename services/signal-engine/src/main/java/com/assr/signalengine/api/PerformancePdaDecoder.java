package com.assr.signalengine.api;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Hand-rolled decode of the PerformancePda account layout (see
 * programs/assr_v1/src/lib.rs). Borsh packs fixed-width fields back-to-back
 * with no padding, in declaration order, so this is just sequential reads —
 * no Borsh/Anchor library needed since every field here is fixed-width.
 */
public final class PerformancePdaDecoder {

    private static final int DISCRIMINATOR_LEN = 8;
    private static final int PUBKEY_LEN = 32;

    private PerformancePdaDecoder() {
    }

    public record Decoded(
            long totalSignals,
            long cumulativePnlUsdc,
            long winCount,
            long lossCount,
            int maxDrawdownBps,
            long peakPnlUsdc,
            long lastUpdated,
            int bump) {
    }

    /**
     * Reads defensively (0 past the end of the buffer) so this doesn't throw
     * on a short account, but be aware: accounts created before
     * {@code peak_pnl_usdc} was inserted mid-struct (Day 3) are not just
     * shorter, they're misaligned — everything from peak_pnl_usdc onward
     * (peakPnlUsdc, lastUpdated, bump) will decode as garbage or zero for
     * those, since a program upgrade doesn't retroactively resize or migrate
     * existing accounts. Re-initialize the agent to get a decodable account.
     */
    public static Decoded decode(byte[] data) {
        ByteBuffer buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
        buf.position(Math.min(DISCRIMINATOR_LEN + PUBKEY_LEN, data.length));

        long totalSignals = readLong(buf);
        long cumulativePnlUsdc = readLong(buf);
        long winCount = readLong(buf);
        long lossCount = readLong(buf);
        int maxDrawdownBps = readUnsignedShort(buf);
        long peakPnlUsdc = readLong(buf);
        long lastUpdated = readLong(buf);
        int bump = readUnsignedByte(buf);

        return new Decoded(totalSignals, cumulativePnlUsdc, winCount, lossCount, maxDrawdownBps, peakPnlUsdc,
                lastUpdated, bump);
    }

    private static long readLong(ByteBuffer buf) {
        return buf.remaining() >= Long.BYTES ? buf.getLong() : 0L;
    }

    private static int readUnsignedShort(ByteBuffer buf) {
        return buf.remaining() >= Short.BYTES ? Short.toUnsignedInt(buf.getShort()) : 0;
    }

    private static int readUnsignedByte(ByteBuffer buf) {
        return buf.remaining() >= Byte.BYTES ? Byte.toUnsignedInt(buf.get()) : 0;
    }
}
