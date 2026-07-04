/** Mirrors com.assr.signalengine.strategy.StrategySignal (services/signal-engine). */
export type SignalType = "VALUE_BET" | "MOMENTUM" | "GOAL_IMPACT";

export interface StrategySignal {
  strategyId: string;
  fixtureId: string;
  signalType: SignalType;
  direction: 1 | -1;
  edge: number;
  /** Implied probability of the price being traded (1 / decimal odds) — the Kelly sizing input paired with edge. */
  candidateImpliedProb: number;
  oracleHash: string;
  timestampMillis: number;
}

export interface PaperTrade {
  signalPda: string;
  fixtureId: string;
  strategyId: string;
  direction: 1 | -1;
  sizeUsdc: number;
  assumedFillPrice: number;
  logSignalTxSignature: string;
}
