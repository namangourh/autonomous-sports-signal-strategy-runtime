import { PublicKey } from "@solana/web3.js";
import { fetchPerformance, fetchSignals } from "@/lib/api";
import { deriveSignalLogPda, derivePerformancePda, explorerAddressUrl } from "@/lib/solana";
import { AutoRefresh } from "./AutoRefresh";

// Our devnet wallet, used as the agent authority throughout development
// (see docs/oracle-hash-spec.md for the wider proof-chain context).
const DEFAULT_AGENT_ID = process.env.NEXT_PUBLIC_ASSR_AGENT_ID ?? "BYU9QBDGsseuxWFE8UJZTyH7zt13dezWno6vtbWtqFq9";

export default async function DashboardPage() {
  const agent = new PublicKey(DEFAULT_AGENT_ID);
  const [signals, performance] = await Promise.all([
    fetchSignals(DEFAULT_AGENT_ID),
    fetchPerformance(DEFAULT_AGENT_ID),
  ]);

  const performancePda = derivePerformancePda(agent);

  return (
    <main>
      <AutoRefresh intervalMs={5000} />
      <h1>ASSR — Live Signals</h1>
      <p>
        Agent:{" "}
        <a href={explorerAddressUrl(agent)} target="_blank" rel="noreferrer">
          {DEFAULT_AGENT_ID}
        </a>
      </p>

      <section>
        <h2>Performance</h2>
        {performance ? (
          <ul>
            <li>Total signals: {performance.totalSignals}</li>
            <li>Cumulative P&amp;L (USDC): {performance.cumulativePnlUsdc}</li>
            <li>Win / Loss: {performance.winCount} / {performance.lossCount}</li>
            <li>
              On-chain record:{" "}
              <a href={explorerAddressUrl(performancePda)} target="_blank" rel="noreferrer">
                {performancePda.toBase58().slice(0, 12)}…
              </a>
            </li>
          </ul>
        ) : (
          <p>No performance data yet — agent may not be initialized on-chain.</p>
        )}
      </section>

      <section>
        <h2>Recent signals</h2>
        {signals.length === 0 ? (
          <p>No signals yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fixture</th>
                <th>Strategy</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Oracle hash</th>
                <th>On-chain proof</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => {
                const signalLogPda = deriveSignalLogPda(
                  agent,
                  signal.fixtureId,
                  signal.timestampMillis,
                  signal.signalType,
                );
                return (
                  <tr key={`${signal.fixtureId}-${signal.timestampMillis}`}>
                    <td>{signal.fixtureId}</td>
                    <td>{signal.strategyId}</td>
                    <td>{signal.signalType}</td>
                    <td>{signal.direction > 0 ? "long" : "short"}</td>
                    <td>{signal.oracleHash.slice(0, 12)}…</td>
                    <td>
                      <a href={explorerAddressUrl(signalLogPda)} target="_blank" rel="noreferrer">
                        view
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
