# Deep Dive: Autarch Agentic Wallet Design

## 1. Objective

Autarch provides wallet infrastructure for autonomous AI agents on Solana devnet.  
Each agent receives a dedicated account, signs automatically through backend policy controls, and executes protocol interactions without manual wallet confirmation.

## 2. System Design

Autarch is split into four concerns:

1. **Agent logic**: generates decisions (`trade` or `hold`) with confidence/reason metadata.
2. **Wallet execution**: builds instructions, simulates, signs, submits, confirms.
3. **Policy controls**: program allowlist, per-action size caps, daily volume caps.
4. **Observability**: API responses + WebSocket stream + dashboard event timeline.

This separation ensures AI decisioning does not bypass safety checks.

## 3. Key Management

### Approach

- signers are generated programmatically
- secret key bytes are encrypted at rest with AES-256-GCM in local keystore
- master key is supplied through environment config
- decrypted key material exists only in process memory during signing

### Why this matters

Agent autonomy requires unattended signing; encrypted keystore storage prevents plain-text key persistence in repository data files.

## 4. Transaction Security Flow

For every trade:

1. strategy emits decision (`action`, `confidence`, `reason`)
2. wallet executor builds tx instruction
3. policy checks run:
   - program allowlist
   - amount limits
   - daily volume
4. transaction is simulated
5. signer signs
6. tx is submitted and confirmed with retry-safe blockhash logic

If simulation/policy fails, execution is blocked and error is logged.

## 5. AI Interaction Model

Current prototype uses `heuristic_ai` strategy to simulate AI decisioning:

- generates a synthetic market signal per agent over time buckets
- derives momentum and confidence
- returns `hold` when confidence is below threshold
- returns directional swap when confidence is above threshold

This provides an explainable AI-like loop suitable for hackathon demonstration while preserving deterministic debugging.

## 6. Protocol Interaction

Autarch interacts with a devnet Anchor mock DeFi program:

- initializes pool state
- derives PDA authority/vault accounts
- performs A->B and B->A swap instructions

All protocol calls are constrained by allowlist and policy layers.

## 7. Scalability Characteristics

- supports multiple independent agents
- per-agent state tracking (`lastStatus`, `lastSignature`, `lastError`)
- bounded concurrency via limiter and queue controls
- shared API/WS stream for fleet observability

## 8. Threat Model and Mitigations

### Threats

- secret leakage
- unauthorized program invocation
- overspend by faulty strategy logic
- stale blockhash / flaky tx confirmation

### Mitigations

- encrypted keystore + in-memory decrypt-only
- strict program allowlist
- per-transfer/swap/daily caps
- simulation-first submit path
- confirmation and retry handling

## 9. Limitations

- devnet-focused; not production custody
- heuristic AI simulation, not full market ML model
- local keystore (no external KMS/HSM yet)

## 10. Roadmap After Hackathon

1. plug external data feeds for real market context
2. add model adapter interface (local model / hosted LLM)
3. add persistent risk ledger and PnL accounting
4. integrate managed KMS signer backend
5. expand policy layer with session and strategy constraints
