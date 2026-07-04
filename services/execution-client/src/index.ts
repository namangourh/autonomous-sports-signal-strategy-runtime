import { Kafka } from "kafkajs";
import { ensureAgentInitialized, getAssrProgram, logSignalOnChain } from "./anchor-client/assrClient.js";
import type { StrategySignal } from "./types.js";

const KAFKA_BOOTSTRAP_SERVERS = process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:9092";
const SPORTS_SIGNALS_TOPIC = "sports.signals";

async function main() {
  console.log("execution-client starting (paper mode)");

  const { program, authority } = getAssrProgram();
  console.log("using authority:", authority.publicKey.toBase58());
  await ensureAgentInitialized(program, authority);

  const kafka = new Kafka({ clientId: "execution-client", brokers: [KAFKA_BOOTSTRAP_SERVERS] });
  const consumer = kafka.consumer({ groupId: "execution-client" });
  await consumer.connect();
  await consumer.subscribe({ topic: SPORTS_SIGNALS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const signal: StrategySignal = JSON.parse(message.value.toString());
      console.log(`received signal: ${signal.strategyId} ${signal.fixtureId} edge=${signal.edge}`);
      try {
        const signature = await logSignalOnChain(program, authority, signal);
        console.log(`logged on-chain: ${signature}`);
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
