# Deployment

Backend (Kafka, signal-engine, execution-client) on Railway; dashboard on Vercel. Each backend service is a separate Railway service within one project, so they can reach each other over Railway's private network.

## 1. Railway project

Create one Railway project with three services, all from this GitHub repo:

### Kafka

- Deploy from the public Docker image `apache/kafka:3.7.0` directly (no Dockerfile needed — Railway supports "deploy from image").
- Environment variables (mirrors `infra/docker-compose.yml`, but `KAFKA_ADVERTISED_LISTENERS` must use Railway's private hostname instead of `localhost`):
  ```
  KAFKA_NODE_ID=1
  KAFKA_PROCESS_ROLES=broker,controller
  KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
  KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://<kafka-service-name>.railway.internal:9092
  KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER
  KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
  KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093
  KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1
  KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
  ```
  Replace `<kafka-service-name>` with whatever Railway names this service (shown in its settings) — other services reach it at `<that-name>.railway.internal:9092`. No public networking needed for this service.

### signal-engine

- Root directory: `services/signal-engine` (Railway will find the `Dockerfile` there).
- Environment variables:
  ```
  KAFKA_BOOTSTRAP_SERVERS=<kafka-service-name>.railway.internal:9092
  TXLINE_SIMULATE=true
  TXLINE_POLL_INTERVAL_MS=8000
  SOLANA_RPC_URL=https://api.devnet.solana.com
  SPRING_AUTOCONFIGURE_EXCLUDE=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration
  ```
  (The last one skips Oracle DB, which isn't deployed — persistence is still local-dev-only; see the README's status note.)
- Enable **public networking** on this service — the dashboard needs its public URL for `NEXT_PUBLIC_SIGNAL_ENGINE_URL`.

### execution-client

- Root directory: `services/execution-client` (Railway will find the `Dockerfile` there).
- Environment variables:
  ```
  KAFKA_BOOTSTRAP_SERVERS=<kafka-service-name>.railway.internal:9092
  SOLANA_RPC_URL=https://api.devnet.solana.com
  SOLANA_WALLET_SECRET_KEY=<paste the JSON array from `cat ~/.config/solana/id.json`>
  JUPITER_BASE_URL=https://lite-api.jup.ag
  ```
  `SOLANA_WALLET_SECRET_KEY` is a real secret — set it as a Railway secret variable, never commit it. This is the same devnet wallet used throughout development (`BYU9QBDGsseuxWFE8UJZTyH7zt13dezWno6vtbWtqFq9`); reuse it so the deployed agent has continuity with everything already logged on-chain, or generate + fund a fresh keypair if you'd rather start clean.
- No public networking needed — it only talks to Kafka and Solana RPC.

## 2. Vercel (dashboard)

- Import this repo, set the project root to `apps/dashboard`.
- Environment variables:
  ```
  NEXT_PUBLIC_SIGNAL_ENGINE_URL=<signal-engine's Railway public URL>
  NEXT_PUBLIC_ASSR_AGENT_ID=BYU9QBDGsseuxWFE8UJZTyH7zt13dezWno6vtbWtqFq9
  NEXT_PUBLIC_ASSR_PROGRAM_ID=2QwzfNdZx8DGbeu6VbSzcn9jaNidstZbC2XRL8Vy9ZrB
  NEXT_PUBLIC_SOLANA_CLUSTER=devnet
  ```
- Vercel auto-detects Next.js — no other config needed.

## Notes

- The on-chain program itself needs no deployment step here — it's already live on devnet.
- If the deployed execution-client's wallet differs from the one used during development, run `initializeAgent` for it once (it does this automatically on first startup — see `ensureAgentInitialized` in `services/execution-client/src/anchor-client/assrClient.ts`) and update `NEXT_PUBLIC_ASSR_AGENT_ID` to match.
- Oracle SQL persistence isn't part of this deployment — `services/signal-engine`'s REST API serves from its in-memory buffer and live on-chain reads, not a database (see `docs/oracle-hash-spec.md` and the README's status section).
