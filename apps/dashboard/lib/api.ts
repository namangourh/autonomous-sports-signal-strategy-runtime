const SIGNAL_ENGINE_BASE_URL = process.env.NEXT_PUBLIC_SIGNAL_ENGINE_URL ?? "http://localhost:8080";

export interface SignalRecord {
  strategyId: string;
  fixtureId: string;
  signalType: string;
  direction: number;
  oracleHash: string;
  timestampMillis: number;
}

export interface PerformanceRecord {
  totalSignals: number;
  cumulativePnlUsdc: number;
  winCount: number;
  lossCount: number;
}

// TODO: these hit REST endpoints that don't exist yet — see Day 7 (services/signal-engine api package).
export async function fetchSignals(agentId: string): Promise<SignalRecord[]> {
  const res = await fetch(`${SIGNAL_ENGINE_BASE_URL}/api/v1/agent/${agentId}/signals`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPerformance(agentId: string): Promise<PerformanceRecord | null> {
  const res = await fetch(`${SIGNAL_ENGINE_BASE_URL}/api/v1/agent/${agentId}/performance`);
  if (!res.ok) return null;
  return res.json();
}
