"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listAgents,
  listPolicyViolations,
  listTransactions,
  resolveWsUrl,
  wakeBackend,
  type Agent,
  type PolicyViolation
} from "../../lib/api";
import type { TxEvent } from "../../components/TxLog";
import { Sidebar } from "../../components/dashboard/Sidebar";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { StatsGrid } from "../../components/dashboard/StatsGrid";
import { ActivityChart } from "../../components/dashboard/ActivityChart";
import { AgentGrid } from "../../components/dashboard/AgentGrid";
import { RecentDecisions } from "../../components/dashboard/RecentDecisions";

const WS_URL = resolveWsUrl();
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

type PhantomProvider = {
  publicKey?: { toString(): string } | null;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
};

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletSol, setWalletSol] = useState<number | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const EVENT_CACHE_KEY = "autarch-events-cache-v2";
  const VIOLATION_CACHE_KEY = "autarch-violations-cache-v2";

  async function refreshDashboardData(): Promise<void> {
    const [freshAgents, policyRows, txRows] = await Promise.all([
      listAgents(),
      listPolicyViolations(),
      listTransactions()
    ]);
    setAgents(freshAgents);
    setViolations(policyRows);
    setEvents((prev) => {
      if (txRows.length === 0 && prev.length > 0) {
        return prev;
      }
      return txRows
        .slice()
        .reverse()
        .map((tx) => ({
          timestamp: tx.createdAt,
          agentId: tx.agentId,
          action: tx.action ?? "unknown",
          status: tx.status,
          signature: tx.signature ?? undefined,
          err: tx.reason ?? undefined
        }));
    });
  }

  function getWalletProvider(): PhantomProvider | null {
    if (typeof window === "undefined") return null;
    const maybePhantom = window as Window & {
      solana?: PhantomProvider;
      phantom?: { solana?: PhantomProvider };
    };
    return maybePhantom.phantom?.solana ?? maybePhantom.solana ?? null;
  }

  async function fetchWalletBalance(address: string): Promise<number> {
    const res = await fetch(SOLANA_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address, { commitment: "confirmed" }]
      })
    });
    if (!res.ok) throw new Error(`Failed to fetch balance (${res.status})`);
    const payload = (await res.json()) as { result?: { value?: number }; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message ?? "RPC balance error");
    return (payload.result?.value ?? 0) / 1_000_000_000;
  }

  useEffect(() => {
    try {
      const rawEvents = sessionStorage.getItem(EVENT_CACHE_KEY);
      if (rawEvents) {
        const parsed = JSON.parse(rawEvents) as TxEvent[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed.slice(-120));
        }
      }
      const rawViolations = sessionStorage.getItem(VIOLATION_CACHE_KEY);
      if (rawViolations) {
        const parsed = JSON.parse(rawViolations) as PolicyViolation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setViolations(parsed.slice(0, 200));
        }
      }
    } catch {
      // ignore cache parse errors
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(events.slice(-120)));
    } catch {
      // ignore storage write failures
    }
  }, [events]);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIOLATION_CACHE_KEY, JSON.stringify(violations.slice(0, 200)));
    } catch {
      // ignore storage write failures
    }
  }, [violations]);

  useEffect(() => {
    void (async () => {
      try {
        await wakeBackend();
        await refreshDashboardData();
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshDashboardData();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
      };
      ws.onclose = () => {
        if (disposed) return;
        const delay = Math.min(16000, 1000 * 2 ** reconnectAttemptRef.current);
        reconnectAttemptRef.current = Math.min(reconnectAttemptRef.current + 1, 4);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
      ws.onmessage = (message) => {
        const evt = JSON.parse(message.data as string) as TxEvent;
        setEvents((prev) => [...prev, evt].slice(-120));
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      ws?.close();
    };
  }, []);

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider) return;
    if (provider.publicKey) {
      setWalletAddress(provider.publicKey.toString());
      return;
    }
    void provider
      .connect({ onlyIfTrusted: true })
      .then((connected) => setWalletAddress(connected.publicKey.toString()))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setWalletSol(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const balance = await fetchWalletBalance(walletAddress);
        if (alive) setWalletSol(balance);
      } catch {
        if (alive) setWalletSol(null);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [walletAddress]);

  const rejectedEvents = useMemo(() => events.filter((e) => e.status !== "ok").length, [events]);

  const connectWallet = async () => {
    const provider = getWalletProvider();
    if (!provider) {
      setStatusMessage("No wallet provider detected. Install or enable Phantom.");
      return;
    }
    setWalletBusy(true);
    try {
      const connected = await provider.connect();
      setWalletAddress(connected.publicKey.toString());
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setWalletBusy(false);
    }
  };

  const disconnectWallet = async () => {
    const provider = getWalletProvider();
    if (!provider) {
      setWalletAddress(null);
      setWalletSol(null);
      return;
    }
    setWalletBusy(true);
    try {
      await provider.disconnect();
      setWalletAddress(null);
      setWalletSol(null);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setWalletBusy(false);
    }
  };

  const refreshWalletBalance = async () => {
    if (!walletAddress) {
      setStatusMessage("Connect a wallet first.");
      return;
    }
    try {
      const balance = await fetchWalletBalance(walletAddress);
      setWalletSol(balance);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="admin-shell min-h-screen bg-[#0f0f11] text-zinc-100">
      <div className="flex min-h-screen">
        <Sidebar agents={agents} activePage="dashboard" />

        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader
            walletAddress={walletAddress}
            walletBusy={walletBusy}
            onWalletConnect={connectWallet}
            onWalletDisconnect={disconnectWallet}
            onWalletRefresh={refreshWalletBalance}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto">
              {statusMessage ? (
                <div className="status-banner status-error status-show" style={{ margin: "16px 24px 0" }}>
                  {statusMessage}
                </div>
              ) : null}

              <StatsGrid
                activeAgents={agents.length}
                totalTransactions={events.length}
                rejected={rejectedEvents}
                totalSol={walletSol}
              />

              <ActivityChart events={events} violations={violations} />

              <AgentGrid agents={agents} />
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <RecentDecisions events={events} violations={violations} />
        </div>
      </div>
    </main>
  );
}
