import { fetchPerformance, fetchSignals } from "@/lib/api";

const DEFAULT_AGENT_ID = "assr-agent-1";

export default async function DashboardPage() {
  const [signals, performance] = await Promise.all([
    fetchSignals(DEFAULT_AGENT_ID),
    fetchPerformance(DEFAULT_AGENT_ID),
  ]);

  return (
    <main>
      <h1>ASSR — Live Signals</h1>

      <section>
        <h2>Performance</h2>
        {performance ? (
          <ul>
            <li>Total signals: {performance.totalSignals}</li>
            <li>Cumulative P&amp;L (USDC): {performance.cumulativePnlUsdc}</li>
            <li>Win / Loss: {performance.winCount} / {performance.lossCount}</li>
          </ul>
        ) : (
          <p>No performance data yet.</p>
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
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => (
                <tr key={`${signal.fixtureId}-${signal.timestampMillis}`}>
                  <td>{signal.fixtureId}</td>
                  <td>{signal.strategyId}</td>
                  <td>{signal.signalType}</td>
                  <td>{signal.direction > 0 ? "long" : "short"}</td>
                  <td>{signal.oracleHash.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
