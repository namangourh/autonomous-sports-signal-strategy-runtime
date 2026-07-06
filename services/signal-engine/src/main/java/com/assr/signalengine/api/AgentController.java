package com.assr.signalengine.api;

import com.assr.signalengine.strategy.RecentSignalBuffer;
import com.assr.signalengine.strategy.StrategySignal;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AgentController {

    /** assr_v1's program ID (see Anchor.toml / programs/assr_v1/src/lib.rs declare_id!). */
    private static final String PROGRAM_ID = "2QwzfNdZx8DGbeu6VbSzcn9jaNidstZbC2XRL8Vy9ZrB";
    /** Base58 of PerformancePda's 8-byte Anchor account discriminator (see target/idl/assr_v1.json). */
    private static final String PERFORMANCE_PDA_DISCRIMINATOR_BASE58 = "E7VDf28WsbP";

    private final RecentSignalBuffer recentSignalBuffer;
    private final SolanaRpcClient solanaRpcClient;

    public AgentController(RecentSignalBuffer recentSignalBuffer, SolanaRpcClient solanaRpcClient) {
        this.recentSignalBuffer = recentSignalBuffer;
        this.solanaRpcClient = solanaRpcClient;
    }

    /**
     * Recently *detected* signals — the strategy engine's own view, not a
     * confirmed on-chain read. Cross-check a signal's oracleHash against
     * Solana Explorer to verify it was actually logged.
     */
    @GetMapping("/api/v1/agent/{agentId}/signals")
    public List<StrategySignal> signals(@PathVariable String agentId, @RequestParam(defaultValue = "50") int limit) {
        return recentSignalBuffer.recent(limit);
    }

    /** Real on-chain read of the agent's PerformancePda — not a local cache. */
    @GetMapping("/api/v1/agent/{agentId}/performance")
    public ResponseEntity<?> performance(@PathVariable String agentId) {
        List<SolanaRpcClient.AccountEntry> accounts = solanaRpcClient.getProgramAccountsByAgent(
                PROGRAM_ID, PERFORMANCE_PDA_DISCRIMINATOR_BASE58, agentId);

        if (accounts.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        PerformancePdaDecoder.Decoded decoded = PerformancePdaDecoder.decode(accounts.get(0).data());
        return ResponseEntity.ok(new PerformanceResponse(
                agentId,
                decoded.totalSignals(),
                decoded.cumulativePnlUsdc(),
                decoded.winCount(),
                decoded.lossCount(),
                decoded.maxDrawdownBps(),
                decoded.peakPnlUsdc(),
                decoded.lastUpdated()));
    }

    public record PerformanceResponse(
            String agent,
            long totalSignals,
            long cumulativePnlUsdc,
            long winCount,
            long lossCount,
            int maxDrawdownBps,
            long peakPnlUsdc,
            long lastUpdated) {
    }
}
