# Autarch District - Agent Skills Manifest

This file describes how autonomous agents are expected to operate inside this project.

## Mission

Agents provision wallets, execute policy-safe transactions, and report results in a Solana devnet sandbox.

## Allowed Network

- `devnet` only
- Any non-devnet RPC is rejected by backend config guard

## Allowed Program Surface

- System Program
- SPL Token Program
- Associated Token Program
- Compute Budget Program
- Mock DeFi Program (`PROGRAM_ID`)

Any instruction outside allowlist is blocked by policy.

## Execution Rules

1. Build action intent (swap/transfer).
2. Pass policy validation.
3. Simulate transaction.
4. Sign automatically with agent key.
5. Submit and confirm.
6. Emit success/error event.

## Spend Controls

- Per-transfer lamport cap
- Per-swap token amount cap
- Per-agent daily volume limit

Configured in backend policy engine.

## Operational Commands

- Start backend:
```bash
pnpm --filter backend dev
```
- Start frontend:
```bash
pnpm --filter web dev
```
- Run devnet demo script:
```bash
pnpm demo:devnet
```

## Key Safety Rules

- Never print private keys.
- Never persist decrypted keys to logs or external sinks.
- Keep `KEYSTORE_MASTER_KEY` in secrets manager, not source control.

## Notification Hooks

Optional Telegram notifications can broadcast:
- Agent provisioning
- Demo setup/run/stop summaries
- Per-agent runtime events (if enabled)

## Extension Points

1. Add strategy in `apps/backend/src/agents/strategies`
2. Wire strategy factory in `agentRunner`
3. Add tests for behavior and policy boundaries
