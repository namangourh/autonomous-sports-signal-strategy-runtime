/** Refuses to trade on data older than maxStaleMs (report's max_stale_ms check). */
export function isStale(timestampMillis: number, maxStaleMs: number, now = Date.now()): boolean {
  return now - timestampMillis > maxStaleMs;
}

/**
 * Tracks cumulative P&L against its running peak and trips once drawdown
 * from that peak exceeds maxDrawdownBps. Once tripped, stays tripped until
 * explicitly reset (mirrors the on-chain emergency_pause instruction, which
 * an operator/agent must explicitly call to clear).
 */
export class DrawdownCircuitBreaker {
  private peakPnlUsdc = 0;
  private tripped = false;

  constructor(private readonly maxDrawdownBps: number) {}

  isTripped(): boolean {
    return this.tripped;
  }

  recordPnl(cumulativePnlUsdc: number): boolean {
    if (this.tripped) {
      return true;
    }

    this.peakPnlUsdc = Math.max(this.peakPnlUsdc, cumulativePnlUsdc);
    const drawdown = this.peakPnlUsdc - cumulativePnlUsdc;
    const referenceBase = Math.max(this.peakPnlUsdc, 1);
    const drawdownBps = (drawdown / referenceBase) * 10_000;

    if (drawdownBps >= this.maxDrawdownBps) {
      this.tripped = true;
    }
    return this.tripped;
  }

  reset(): void {
    this.tripped = false;
    this.peakPnlUsdc = 0;
  }
}
