import type { StrategySignal } from "../types.js";

/**
 * Paper-mode scaffold for the atomic [trade, log_signal] bundle pattern:
 * once real (non-paper) execution exists, the Jupiter/Drift trade
 * instruction would be submitted alongside log_signal in a single Jito
 * bundle, so a trade can never succeed on-chain without its proof being
 * logged (or vice versa). There's no real trade instruction to bundle in
 * paper mode, so this only documents the intended structure — it never
 * calls Jito's block engine.
 */
export interface AtomicBundlePlan {
  fixtureId: string;
  tradeLeg: string;
  proofLeg: "log_signal";
  note: string;
}

export function planAtomicBundle(signal: StrategySignal): AtomicBundlePlan {
  return {
    fixtureId: signal.fixtureId,
    tradeLeg: "paper (no real instruction submitted)",
    proofLeg: "log_signal",
    note:
      "Once real execution exists, bundle the trade instruction with log_signal via Jito " +
      "so they succeed or fail atomically, rather than as two independent transactions.",
  };
}
