import { DrawdownCircuitBreaker } from "./riskManager.js";

export interface CircuitBreakerGate {
  /** Feeds a new cumulative P&L reading; calls onTrip exactly once, the first time drawdown breaches the threshold. */
  recordSettlement(cumulativePnlUsdc: number): Promise<boolean>;
  isTripped(): boolean;
}

/**
 * Wires the pure DrawdownCircuitBreaker logic to the on-chain kill switch:
 * the first settlement that breaches maxDrawdownBps triggers onTrip exactly
 * once (subsequent settlements are no-ops since the breaker stays tripped).
 */
export function createCircuitBreakerGate(maxDrawdownBps: number, onTrip: () => Promise<void>): CircuitBreakerGate {
  const breaker = new DrawdownCircuitBreaker(maxDrawdownBps);

  return {
    async recordSettlement(cumulativePnlUsdc: number): Promise<boolean> {
      const wasTrippedBefore = breaker.isTripped();
      const tripped = breaker.recordPnl(cumulativePnlUsdc);
      if (tripped && !wasTrippedBefore) {
        await onTrip();
      }
      return tripped;
    },
    isTripped(): boolean {
      return breaker.isTripped();
    },
  };
}
