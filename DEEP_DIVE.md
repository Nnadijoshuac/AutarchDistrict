# Deep Dive: Autarch District Agentic Wallet System

## 1) Problem and Goal

AI agents can only be autonomous on Solana if they can own wallets, sign transactions, and execute protocol interactions without human wallet popups.

Autarch District is a devnet prototype that demonstrates this end-to-end in a controlled environment:
- Provision wallets for agents
- Fund and seed them
- Execute repeatable protocol interactions
- Monitor and notify operational activity

## 2) System Design

The design is split into clear responsibility layers:

1. Agent logic: chooses actions (strategy)
2. Wallet execution: builds/simulates/signs/sends transactions
3. Policy gate: enforces spend and program constraints
4. Protocol client: constructs Anchor-compatible instructions
5. Observability: dashboard, event stream, Telegram

This keeps decision-making separate from key custody and signing.

## 3) Key Management and Security

### Keystore model
- Agent keys are generated programmatically.
- Secret keys are encrypted at rest with AES-256-GCM.
- Master key comes from environment (`KEYSTORE_MASTER_KEY`).
- Decryption occurs only in memory at signing time.

### Threat model focus
- Prevent accidental mainnet execution.
- Limit damage from rogue strategies.
- Avoid plaintext key persistence.

### Controls implemented
- Devnet-only RPC validation in config load path.
- Program allowlist checks in policy engine.
- Amount caps and daily spend guardrails.
- Transaction simulation before send.

## 4) Transaction Execution Flow

For each action:

1. Strategy emits action intent (e.g., swap amount + direction).
2. Wallet layer builds instruction(s).
3. Policy engine validates program + amount limits.
4. Transaction is simulated.
5. Transaction is signed by agent wallet.
6. Send + confirmation/retry logic executes.
7. Result event is emitted for UI/logs/notifications.

This flow provides deterministic behavior and safer automated execution.

## 5) Multi-Agent Scalability

Scalability primitives:
- In-memory registry of agents
- Per-agent execution loop
- Global RPC limiter
- Bounded concurrency via `p-limit`
- Event emission for external consumers

Additionally, agent identities are restored from the encrypted keystore on startup, so restarts do not wipe wallet inventory.

## 6) Protocol Integration

The prototype integrates with an Anchor mock DeFi program:
- Pool initialization with PDA authority
- Vault ATAs for pool custody
- A/B token swap instructions

This satisfies the “interact with a test protocol” requirement while keeping the environment sandboxed on devnet.

## 7) Operational Visibility

Visibility surfaces:
- REST endpoints for control actions
- WebSocket event stream (local deployment)
- Dashboard transaction log and agent status
- Optional Telegram notifications for provisioning/setup/run/stop and runtime events

## 8) Deployment Considerations

### Backend
- Render is used for long-running Fastify deployment.
- Persistent disk should be used:
  - `DATA_DIR=/var/data/autarch-data`
- This preserves keystore and spend DB across restarts.

### Frontend
- Next.js frontend proxies backend calls through `/api/backend/[...path]` to avoid browser CORS fragility.

## 9) Why This Meets the Bounty

- Programmatic wallets: yes
- Autonomous signing: yes
- SOL/SPL handling: yes
- Protocol interaction: yes
- Security controls and clear architecture: yes
- Multi-agent independent operation: yes
- Devnet prototype: yes

## 10) Next Iteration Roadmap

1. Persist transaction/event history (currently session-oriented in UI).
2. Replace local master-key model with external KMS/HSM.
3. Add per-agent policy profiles and richer risk rules.
4. Add signed action-intent audit trail for forensic replay.
