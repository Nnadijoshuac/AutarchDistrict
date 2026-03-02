"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createAgents,
  listAgents,
  runDemo,
  setupDemo,
  stopDemo,
  type Agent,
  type DemoRunResponse
} from "../../lib/api";
import type { TxEvent } from "../../components/TxLog";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";

type BusyAction = "create" | "setup" | "run" | "stop" | null;

function shortPubkey(v: string) {
  return `${v.slice(0, 7)}...${v.slice(-5)}`;
}

function explorerUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"ok" | "error">("ok");
  const [wsConnected, setWsConnected] = useState(false);
  const [createCount, setCreateCount] = useState(3);
  const [setupAgents, setSetupAgents] = useState(5);
  const [rounds, setRounds] = useState(3);
  const [amount, setAmount] = useState(1000);

  useEffect(() => {
    void refreshAgents();
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (message) => {
      const evt = JSON.parse(message.data as string) as TxEvent;
      setEvents((prev) => [...prev, evt].slice(-120));
      void refreshAgents();
    };

    return () => ws.close();
  }, []);

  const selected = useMemo(
    () => agents.find((a) => a.agentId === selectedAgentId) ?? agents[0],
    [agents, selectedAgentId]
  );

  const okEvents = useMemo(() => events.filter((e) => e.status === "ok").length, [events]);
  const errorEvents = useMemo(() => events.filter((e) => e.status !== "ok").length, [events]);

  async function refreshAgents() {
    const next = await listAgents();
    setAgents(next);
  }

  function setStatus(message: string, type: "ok" | "error") {
    setStatusMessage(message);
    setStatusType(type);
  }

  function appendRunEvents(result: DemoRunResponse) {
    const now = new Date().toISOString();
    setEvents((prev) => [
      ...prev,
      ...result.signatures.map((signature) => ({
        timestamp: now,
        agentId: "demo-run",
        action: `swap:${result.amount}`,
        status: "ok",
        signature
      })),
      ...result.errors.map((e) => ({
        timestamp: now,
        agentId: e.agentId,
        action: `swap:${result.amount}`,
        status: "error",
        err: e.err
      }))
    ]);
  }

  return (
    <main className="dashboard-root">
      <div className="container">
        <header className="app-header">
          <div>
            <div className="pill">Autarch District Control Plane</div>
            <h1 className="display">Agent Wallet Dashboard</h1>
            <p>Provision, fund, execute, and monitor autonomous wallet activity on Solana devnet.</p>
          </div>
          <Link href="/" className="btn btn-ghost">
            Back to Landing
          </Link>
        </header>

        <section className="kpi-grid">
          <div className="card kpi">
            <div className="kpi-label">Active Agents</div>
            <div className="kpi-value">{agents.length}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">WebSocket</div>
            <div className="kpi-value" style={{ color: wsConnected ? "#238f5b" : "#d04747" }}>
              {wsConnected ? "Connected" : "Offline"}
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Successful Events</div>
            <div className="kpi-value">{okEvents}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Error Events</div>
            <div className="kpi-value">{errorEvents}</div>
          </div>
        </section>

        <section className="card controls">
          <div className="controls-row">
            <div className="field">
              <label htmlFor="createCount">Create Count</label>
              <input
                id="createCount"
                type="number"
                min={1}
                max={20}
                value={createCount}
                onChange={(e) => setCreateCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <button
              className="btn btn-ghost"
              disabled={busyAction !== null}
              onClick={async () => {
                try {
                  setBusyAction("create");
                  await createAgents(createCount);
                  await refreshAgents();
                  setStatus(`Created ${createCount} agents.`, "ok");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Create Agents
            </button>

            <div className="field">
              <label htmlFor="setupAgents">Setup Agents</label>
              <input
                id="setupAgents"
                type="number"
                min={1}
                max={50}
                value={setupAgents}
                onChange={(e) => setSetupAgents(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={busyAction !== null}
              onClick={async () => {
                try {
                  setBusyAction("setup");
                  await setupDemo({ numAgents: setupAgents });
                  await refreshAgents();
                  setStatus(`Setup complete for ${setupAgents} agents.`, "ok");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Fund/Setup Demo
            </button>

            <div className="field">
              <label htmlFor="rounds">Rounds</label>
              <input
                id="rounds"
                type="number"
                min={1}
                max={30}
                value={rounds}
                onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="field">
              <label htmlFor="amount">Amount</label>
              <input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={busyAction !== null}
              onClick={async () => {
                try {
                  setBusyAction("run");
                  const result = await runDemo(rounds, amount);
                  appendRunEvents(result);
                  await refreshAgents();
                  setStatus(
                    `Run complete: ${result.signatures.length} signatures, ${result.errors.length} errors.`,
                    result.errors.length > 0 ? "error" : "ok"
                  );
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Run Demo
            </button>
            <button
              className="btn btn-ghost"
              disabled={busyAction !== null}
              onClick={async () => {
                try {
                  setBusyAction("stop");
                  await stopDemo();
                  setStatus("Demo stopped.", "ok");
                  await refreshAgents();
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Stop Demo
            </button>
          </div>
          {statusMessage ? (
            <div className={`status-banner ${statusType === "ok" ? "status-ok" : "status-error"}`}>{statusMessage}</div>
          ) : null}
        </section>

        <section className="app-grid">
          <article className="card panel">
            <h3 className="display">Agent Fleet</h3>
            {agents.length === 0 ? (
              <p className="subtle">No agents yet. Create agents or run setup.</p>
            ) : (
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Pubkey</th>
                    <th>Status</th>
                    <th>Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr
                      key={agent.agentId}
                      className={`agent-row ${selected?.agentId === agent.agentId ? "active" : ""}`}
                      onClick={() => setSelectedAgentId(agent.agentId)}
                    >
                      <td>{agent.agentId}</td>
                      <td className="mono">{shortPubkey(agent.publicKey)}</td>
                      <td>
                        <span className={`status-chip ${agent.lastStatus}`}>{agent.lastStatus}</span>
                      </td>
                      <td>{agent.strategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="card panel">
            <h3 className="display">Agent Detail</h3>
            {!selected ? (
              <p className="subtle">Select an agent to inspect details.</p>
            ) : (
              <div className="detail-list">
                <div className="detail-item">
                  <small>Agent ID</small>
                  <div className="mono">{selected.agentId}</div>
                </div>
                <div className="detail-item">
                  <small>Public Key</small>
                  <div className="mono">{selected.publicKey}</div>
                </div>
                <div className="detail-item">
                  <small>Last Status</small>
                  <div>{selected.lastStatus}</div>
                </div>
                <div className="detail-item">
                  <small>Last Signature</small>
                  {selected.lastSignature ? (
                    <a href={explorerUrl(selected.lastSignature)} target="_blank" rel="noreferrer" className="mono">
                      {selected.lastSignature}
                    </a>
                  ) : (
                    <div className="subtle">n/a</div>
                  )}
                </div>
                <div className="detail-item">
                  <small>Error</small>
                  <div>{selected.lastError ?? "none"}</div>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="card panel" style={{ marginTop: 14 }}>
          <h3 className="display">Transaction Log</h3>
          {events.length === 0 ? (
            <p className="subtle">No events yet. Run setup and execution to populate the log.</p>
          ) : (
            <ul className="log-list">
              {events
                .slice(-30)
                .reverse()
                .map((evt, index) => (
                  <li key={`${evt.timestamp}-${index}`} className="log-item">
                    <div>
                      <span className="subtle">{new Date(evt.timestamp).toLocaleString()}</span> ·{" "}
                      <span className="mono">{evt.agentId}</span> · {evt.action}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <strong className={evt.status === "ok" ? "ok" : "error"}>{evt.status}</strong>{" "}
                      {evt.signature ? (
                        <a href={explorerUrl(evt.signature)} target="_blank" rel="noreferrer" className="mono">
                          {evt.signature}
                        </a>
                      ) : (
                        <span>{evt.err}</span>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
