import { Kafka } from "kafkajs";
import {
  emergencyPauseOnChain,
  ensureAgentInitialized,
  fetchAgentConfig,
  getAssrProgram,
  logSignalOnChain,
} from "./anchor-client/assrClient.js";
import { getPaperFillQuote } from "./execution/jupiterClient.js";
import { planAtomicBundle } from "./execution/jitoBundle.js";
import { recordPaperTrade } from "./execution/paperTradeRecorder.js";
import { calculatePositionSizeUsdc } from "./risk/kellySizing.js";
import { isStale } from "./risk/riskManager.js";
import { createCircuitBreakerGate } from "./risk/circuitBreakerGate.js";
import type { StrategySignal } from "./types.js";

const KAFKA_BOOTSTRAP_SERVERS = process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:9092";
const SPORTS_SIGNALS_TOPIC = "sports.signals";
const BANKROLL_USDC_MICROS = Number(process.env.BANKROLL_USDC_MICROS ?? 10_000_000_000); // $10,000
const MAX_STALE_MS = Number(process.env.MAX_STALE_MS ?? 120_000);

async function main() {
  console.log("execution-client starting (paper mode)");

  const { program, authority } = getAssrProgram();
  console.log("using authority:", authority.publicKey.toBase58());
  await ensureAgentInitialized(program, authority);

  const agentConfig = await fetchAgentConfig(program, authority);
  console.log("agent config:", agentConfig);

  // Wired and ready for when a settlement feed exists (update_performance
  // isn't called from anywhere yet — P&L settlement is future work) —
  // the first drawdown breach beyond agentConfig.maxDrawdownBps will pause
  // the agent on-chain exactly once.
  const circuitBreaker = createCircuitBreakerGate(agentConfig.maxDrawdownBps, async () => {
    console.warn("drawdown circuit breaker tripped — pausing agent on-chain");
    const signature = await emergencyPauseOnChain(program, authority);
    console.warn("emergency_pause tx:", signature);
  });
  void circuitBreaker; // silence unused-until-a-settlement-feed-exists lint

  const kafka = new Kafka({ clientId: "execution-client", brokers: [KAFKA_BOOTSTRAP_SERVERS] });
  const consumer = kafka.consumer({ groupId: "execution-client" });
  await consumer.connect();
  // Not fromBeginning: a live trading system shouldn't act on a backlog of
  // historical signals on restart — isStale() would reject most of them
  // anyway, but replaying them still bursts RPC calls into rate limits.
  await consumer.subscribe({ topic: SPORTS_SIGNALS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const signal: StrategySignal = JSON.parse(message.value.toString());
      console.log(`received signal: ${signal.strategyId} ${signal.fixtureId} edge=${signal.edge}`);

      if (isStale(signal.timestampMillis, MAX_STALE_MS)) {
        console.warn(`skipping stale signal (age > ${MAX_STALE_MS}ms):`, signal.fixtureId);
        return;
      }
      if (!agentConfig.active) {
        console.warn("agent is paused — skipping signal");
        return;
      }

      const sizeUsdcMicros = calculatePositionSizeUsdc(
        signal.candidateImpliedProb,
        signal.edge,
        BANKROLL_USDC_MICROS,
        agentConfig.maxPosUsdc,
      );
      if (sizeUsdcMicros <= 0) {
        console.log("Kelly sizing returned 0 — skipping signal");
        return;
      }

      const quote = await getPaperFillQuote(sizeUsdcMicros / 1_000_000);
      const executionPriceMicros = quote ? Math.round(quote.solPriceUsdc * 1_000_000) : 0;
      if (!quote) {
        console.warn("Jupiter paper quote unavailable — logging with executionPrice=0");
      }

      const bundlePlan = planAtomicBundle(signal);
      console.log("atomic bundle plan:", bundlePlan);

      try {
        const { signature, signalLogPda } = await logSignalOnChain(
          program,
          authority,
          signal,
          sizeUsdcMicros,
          executionPriceMicros,
        );
        console.log(
          `logged on-chain: ${signature} size=$${(sizeUsdcMicros / 1_000_000).toFixed(2)} ` +
            `paperFillSolPrice=$${quote?.solPriceUsdc.toFixed(2) ?? "n/a"}`,
        );
        recordPaperTrade({
          signalPda: signalLogPda,
          fixtureId: signal.fixtureId,
          strategyId: signal.strategyId,
          direction: signal.direction,
          sizeUsdc: sizeUsdcMicros / 1_000_000,
          assumedFillPrice: quote?.solPriceUsdc ?? 0,
          logSignalTxSignature: signature,
        });
      } catch (err) {
        console.error("failed to log signal on-chain", err);
      }
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
