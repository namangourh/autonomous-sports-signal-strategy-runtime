import type { PaperTrade } from "../types.js";

/**
 * Records the paper trade + fill assumptions paired with a log_signal call.
 * TODO: persist to Oracle SQL (db/migrations/V1__init_schema.sql already
 * has a paper_trades table) once the signal-engine's datasource is wired up
 * from the execution client's side — for now this is a structured log, not
 * a database write.
 */
export function recordPaperTrade(trade: PaperTrade): void {
  console.log("paper trade:", trade);
}
