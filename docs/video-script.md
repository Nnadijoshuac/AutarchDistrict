# Demo Video Script (Devnet)

1. Intro: Autarch District is a devnet-only autonomous wallet execution layer for AI agents.
2. Show `.env` with `PROGRAM_ID` and `KEYSTORE_MASTER_KEY`.
3. Run `solana config set -ud` and verify wallet balance.
4. Deploy Anchor program on devnet: `anchor deploy --provider.cluster devnet`.
5. Update `.env` `PROGRAM_ID` with deployed address.
6. Run backend + web (`pnpm dev`) and open dashboard.
7. Create agents from UI or `POST /agents`.
8. Run `POST /demo/setup`: explain mint A/B, ATA creation, PDA-owned vaults, token seeding.
9. Run `POST /demo/run`: fixed rounds, fixed amount swaps, collect signatures.
10. Show tx signatures and final agent balances.
11. Show policy rejection example (amount above cap).
12. Close with security posture: encrypted keystore, devnet-only guard, allowlist and spend limits.
