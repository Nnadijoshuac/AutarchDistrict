import type { ReactNode } from "react";

export type FeatureItem = {
  title: string;
  description: string;
  icon: ReactNode;
};

export type EdgeItem = {
  title: string;
  copy: string;
};

export const FEATURES: FeatureItem[] = [
  {
    title: "Provision",
    description: "Create isolated agent wallets with deterministic identities and policy defaults.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Zm0 4h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Zm13 3a1.5 1.5 0 1 0 0 3h2v-3h-2Z" />
      </svg>
    )
  },
  {
    title: "Fund",
    description: "Allocate SOL and SPL balances per agent so strategies operate with isolated risk.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 3 6v6c0 5.25 3.45 8.95 9 10 5.55-1.05 9-4.75 9-10V6l-9-4Zm1 5h4v2h-4V7Zm-6 0h4v2H7V7Zm0 4h10v2H7v-2Zm0 4h10v2H7v-2Z" />
      </svg>
    )
  },
  {
    title: "Execute",
    description: "Run automated transactions with guardrails, limits, and protocol-level checks.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a6 6 0 0 0-6 6v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V8a6 6 0 0 0-6-6Zm-4 9V8a4 4 0 1 1 8 0v3H8Z" />
      </svg>
    )
  },
  {
    title: "Monitor",
    description: "Inspect live transaction logs, signatures, and execution outcomes in one timeline.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3h18v2H3V3Zm2 4h14v14H5V7Zm2 2v10h10V9H7Zm2 2h2v6H9v-6Zm4 2h2v4h-2v-4Z" />
      </svg>
    )
  }
];

export const EDGE_ITEMS: EdgeItem[] = [
  {
    title: "Policy-Safe Execution",
    copy: "Each agent action is validated against spend limits and allowed-program controls before it is signed."
  },
  {
    title: "Autonomous Wallet Lifecycle",
    copy: "Provision, fund, run, stop, and restore agent wallets with encrypted key custody and deterministic flows."
  },
  {
    title: "Operator Visibility",
    copy: "Every run is observable via dashboard state, tx log traces, and optional Telegram notifications."
  }
];
