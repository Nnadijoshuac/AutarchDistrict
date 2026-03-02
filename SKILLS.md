# SKILLS.md

Purpose: runtime instructions for autonomous agents operating wallet accounts in this repository.

## Mission

Operate Solana devnet agent wallets safely:

- create agent accounts
- fund accounts
- execute policy-gated trades
- report signatures, status, and errors

## Guardrails

1. Network:
- `devnet` only
- never use `mainnet-beta`

2. Program allowlist:
- System Program: `11111111111111111111111111111111`
- SPL Token Program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Associated Token Program: `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`
- Compute Budget Program: `ComputeBudget111111111111111111111111111111`
- Autarch District mock trading program: `PROGRAM_ID` from env

3. Spend limits:
- enforce max lamports per transfer (policy config)
- enforce max swap size (policy config)
- enforce per-agent daily volume cap

4. Secrets:
- never print private keys or secret bytes
- never commit `.env` secrets or wallet private keys
- only read signer keys from configured secure paths

## Agent Workflow

1. Bootstrap
- create agent wallet account programmatically
- register account in keystore

2. Funding
- transfer SOL to agent signer
- provision SPL ATAs where needed

3. Decision
- use strategy module to produce `{ direction, amount }`
- optionally provide confidence/reason metadata

4. Execution
- build instruction
- policy-check instruction + amount
- simulate transaction
- sign and submit
- confirm and emit event

5. Reporting
- store `lastStatus`, `lastSignature`, `lastError`
- stream events to `/ws`

## Commands

- start backend: `corepack pnpm --filter backend dev`
- start web: `corepack pnpm --filter web dev`
- run backend tests: `corepack pnpm --filter backend test`
- setup demo (API): `POST /demo/setup`
- run demo (API): `POST /demo/run`
- stop demo (API): `POST /demo/stop`

## File Pointers

- wallet signing and tx submit: `apps/backend/src/wallet`
- policy engine: `apps/backend/src/wallet/txPolicy.ts`
- signer/keystore: `apps/backend/src/keystore` and `apps/backend/src/wallet/signerImpl.ts`
- agent runner: `apps/backend/src/agents/agentRunner.ts`
- strategies: `apps/backend/src/agents/strategies`
- demo orchestration: `apps/backend/src/routes/demo.ts`

## Strategy Contract

Strategies must:

- be deterministic enough to debug
- return `null` when confidence is too low (hold)
- keep amount within policy bounds
- avoid side effects outside strategy state
