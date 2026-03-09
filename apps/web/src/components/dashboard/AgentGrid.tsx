"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Agent } from "../../lib/api";
import { cn } from "../../lib/utils";

type AgentGridProps = {
  agents: Agent[];
  linkToAgentsPage?: boolean;
};

export function AgentGrid({ agents, linkToAgentsPage = true }: AgentGridProps) {
  const [balances, setBalances] = useState<Record<string, number | null>>({});

  const publicKeys = useMemo(() => agents.map((agent) => agent.publicKey), [agents]);

  useEffect(() => {
    if (publicKeys.length === 0) {
      setBalances({});
      return;
    }

    let active = true;
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

    const fetchBalances = async () => {
      try {
        const requests = publicKeys.map((publicKey, idx) =>
          fetch(rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: idx + 1,
              method: "getBalance",
              params: [publicKey, { commitment: "confirmed" }]
            })
          })
        );

        const responses = await Promise.all(requests);
        const payloads = await Promise.all(
          responses.map(async (res) => {
            if (!res.ok) return null;
            const body = (await res.json()) as { result?: { value?: number } };
            return body.result?.value ?? null;
          })
        );

        if (!active) return;
        const next: Record<string, number | null> = {};
        agents.forEach((agent, index) => {
          const lamports = payloads[index];
          next[agent.agentId] = lamports == null ? null : lamports / 1_000_000_000;
        });
        setBalances(next);
      } catch {
        if (!active) return;
        const next: Record<string, number | null> = {};
        agents.forEach((agent) => {
          next[agent.agentId] = null;
        });
        setBalances(next);
      }
    };

    void fetchBalances();
    const timer = setInterval(() => void fetchBalances(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [agents, publicKeys]);

  if (agents.length === 0) {
    return null;
  }

  const short = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;
  const lamportsToSol = (lamports?: number) => (lamports ? lamports / 1_000_000_000 : 0);

  return (
    <div className="p-6">
      <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-4 uppercase">Agent Portfolio</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent, index) => (
          <Link
            key={agent.agentId}
            href={linkToAgentsPage ? `/app/agents?agentId=${encodeURIComponent(agent.agentId)}` : "#"}
            className="skeuo-card rounded-xl p-5 relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-300 block"
            aria-label={`Open ${agent.displayName?.trim() || `Agent ${index + 1}`} details`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-white",
                    "shadow-[2px_2px_4px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)]",
                    "bg-[#f97316]"
                  )}
                >
                  {(agent.displayName || agent.agentId)
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 3)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white uppercase tracking-tight truncate">
                    {agent.displayName?.trim() || `Agent ${index + 1}`}
                  </h4>
                  <p className="text-[10px] font-mono text-zinc-500 truncate">{short(agent.agentId)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full skeuo-inset border border-[#f97316]/20 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] shadow-[0_0_8px_rgba(249,115,22,0.55)] animate-pulse" />
                <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-tighter">
                  {agent.lastStatus || "active"}
                </span>
              </div>
            </div>

            <div className="skeuo-inset p-4 mb-3">
              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Portfolio Value</div>
              <div className="mt-1 text-2xl font-mono font-bold text-white">
                {balances[agent.agentId] == null ? "Loading..." : `${balances[agent.agentId]!.toFixed(4)} SOL`}
              </div>
              <div className="mt-2 text-[10px] text-zinc-500">Current on-chain SOL holdings</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="skeuo-inset p-3">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Strategy</div>
                <div className="text-[11px] font-mono font-bold text-white truncate">{agent.strategy || "n/a"}</div>
              </div>
              <div className="skeuo-inset p-3">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Per-Tx Limit</div>
                <div className="text-[11px] font-mono font-bold text-white">
                  {lamportsToSol(agent.policyProfile?.maxLamportsPerTx).toFixed(2)} SOL
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Policy</div>
                <div className="text-[10px] text-zinc-400 truncate font-mono">{agent.policyProfile?.name ?? "sandbox"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Wallet</div>
                <div className="text-[10px] text-zinc-400 truncate font-mono">{short(agent.publicKey)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
