"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAgents,
  deleteAgent,
  listAgents,
  listPolicyViolations,
  listStrategies,
  runDemo,
  setupDemo,
  stopDemo,
  updateAgentName,
  updateAgentPolicy,
  updateAgentStrategy,
  wakeBackend,
  type Agent,
  type DemoRunResponse,
  type PolicyProfile,
  type PolicyViolation
} from "../../lib/api";
import type { TxEvent } from "../../components/TxLog";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";

type BusyAction = "create" | "setup" | "run" | "stop" | null;
type JudgeStep = "idle" | "agents" | "setup" | "running" | "completed";

function shortPubkey(v: string) {
  return `${v.slice(0, 7)}...${v.slice(-5)}`;
}

function shortId(v: string) {
  return `${v.slice(0, 14)}...${v.slice(-6)}`;
}

function explorerUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function agentPurpose(strategy: string) {
  if (strategy.toLowerCase().includes("random")) {
    return "Explores swap opportunities and executes safe demo trades.";
  }
  if (strategy.toLowerCase().includes("dca")) {
    return "Splits trades over time for smoother entries.";
  }
  return "Follows the configured strategy and reports each trade.";
}

function relativeTime(timestamp: string) {
  const ms = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.max(1, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z" />
    </svg>
  );
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"ok" | "error">("ok");
  const [statusVisible, setStatusVisible] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [createCount, setCreateCount] = useState(3);
  const [setupAgents, setSetupAgents] = useState(5);
  const [rounds, setRounds] = useState(3);
  const [amount, setAmount] = useState(1000);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [policyForm, setPolicyForm] = useState<PolicyProfile>({
    name: "sandbox",
    maxLamportsPerTx: 2_000_000_000,
    maxDailyLamports: 20_000_000_000,
    allowedPrograms: [],
    maxConcurrentTx: 5,
    slippageBps: 500
  });
  const [selectedStrategy, setSelectedStrategy] = useState("randomSwap");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [judgeStep, setJudgeStep] = useState<JudgeStep>("idle");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setStatus("Reaching Autarch District...", "ok");
        await wakeBackend();
        await refreshAgents();
        const [availableStrategies, policyRows] = await Promise.all([listStrategies(), listPolicyViolations()]);
        setStrategies(availableStrategies);
        setViolations(policyRows);
        if (availableStrategies.length > 0) {
          setSelectedStrategy(availableStrategies[0]);
        }
        setStatus("Autarch District is live.", "ok");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "error");
      }
    })();
  }, []);

  useEffect(() => {
    if (!statusMessage) {
      setStatusVisible(false);
      return;
    }
    setStatusVisible(true);
    const fadeTimer = setTimeout(() => setStatusVisible(false), 2600);
    const clearTimer = setTimeout(() => setStatusMessage(""), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [statusMessage]);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (disposed) return;
      const agentQuery = selectedAgentId ? `?agentId=${encodeURIComponent(selectedAgentId)}` : "";
      ws = new WebSocket(`${WS_URL}${agentQuery}`);

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
      };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => {
        setWsConnected(false);
        if (disposed) return;
        const delay = Math.min(16000, 1000 * 2 ** reconnectAttemptRef.current);
        reconnectAttemptRef.current = Math.min(reconnectAttemptRef.current + 1, 4);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
      ws.onmessage = (message) => {
        const evt = JSON.parse(message.data as string) as TxEvent;
        setEvents((prev) => [...prev, evt].slice(-120));
        void refreshAgents();
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
  }, [selectedAgentId]);

  const selected = useMemo(
    () => agents.find((a) => a.agentId === selectedAgentId) ?? agents[0],
    [agents, selectedAgentId]
  );

  const selectedAgentEvents = useMemo(() => {
    if (!selected) return events;
    return events.filter((evt) => evt.agentId === selected.agentId || evt.agentId === "demo-run");
  }, [events, selected]);

  useEffect(() => {
    if (selected?.policyProfile) {
      setPolicyForm(selected.policyProfile);
    }
    if (selected?.strategy) {
      setSelectedStrategy(selected.strategy);
    }
    setDisplayNameInput(selected?.displayName ?? "");
  }, [selected]);

  useEffect(() => {
    const stored = localStorage.getItem("autarch-theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("autarch-theme", theme);
  }, [theme]);

  const okEvents = useMemo(() => events.filter((e) => e.status === "ok").length, [events]);
  const errorEvents = useMemo(() => events.filter((e) => e.status !== "ok").length, [events]);

  async function refreshAgents() {
    const next = await listAgents();
    setAgents(next);
  }

  async function refreshViolations() {
    const next = await listPolicyViolations();
    setViolations(next);
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

  async function runJudgeMode() {
    try {
      setBusyAction("run");
      setJudgeStep("agents");
      await createAgents(3);
      await refreshAgents();
      await wait(350);

      setJudgeStep("setup");
      await setupDemo({ numAgents: 3 });
      await refreshAgents();
      await wait(350);

      setJudgeStep("running");
      const result = await runDemo(20, amount);
      appendRunEvents(result);
      await refreshAgents();
      await refreshViolations();

      setJudgeStep("completed");
      setStatus(
        `Quick demo done: ${result.signatures.length} successful, ${result.errors.length} failed.`,
        result.errors.length > 0 ? "error" : "ok"
      );
    } catch (err) {
      setJudgeStep("idle");
      setStatus(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusyAction(null);
    }
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function copyText(value: string, fieldId: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField((current) => (current === fieldId ? null : current)), 1200);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to copy value.", "error");
    }
  }

  return (
    <main className={`dashboard-root ${theme === "dark" ? "dashboard-dark" : "dashboard-light"}`}>
      <div className="container">
        <header className="app-header">
          <div>
            <div className="pill">Autarch District Control Plane</div>
            <h1 className="display">Agent Chat Dashboard</h1>
            <p>Pick an agent, see its role, and follow every trade like a live conversation.</p>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            <Link href="/" className="btn btn-ghost">
              Back to Landing
            </Link>
          </div>
        </header>

        <section className="kpi-grid">
          <div className="card kpi">
            <div className="kpi-label">Agents</div>
            <div className="kpi-value">{agents.length}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Connection</div>
            <div className="kpi-value" style={{ color: wsConnected ? "#238f5b" : "#d04747" }}>
              {wsConnected ? "Live" : "Offline"}
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Successful</div>
            <div className="kpi-value">{okEvents}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Errors</div>
            <div className="kpi-value">{errorEvents}</div>
          </div>
        </section>

        <section className="card controls">
          <div className="control-inline">
            <div className="field">
              <label htmlFor="createCount">Wallets to create</label>
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
              <label htmlFor="setupAgents">Agents to fund</label>
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
                  await refreshViolations();
                  setStatus(`Setup complete for ${setupAgents} agents.`, "ok");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Fund Agents
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
                  await refreshViolations();
                  setStatus(
                    `Run complete: ${result.signatures.length} successful, ${result.errors.length} failed.`,
                    result.errors.length > 0 ? "error" : "ok"
                  );
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Run Trades
            </button>
            <button className="btn btn-primary" disabled={busyAction !== null} onClick={() => void runJudgeMode()}>
              Quick Demo
            </button>
            <button
              className="btn btn-ghost"
              disabled={busyAction !== null}
              onClick={async () => {
                try {
                  setBusyAction("stop");
                  await stopDemo();
                  setStatus("Stopped.", "ok");
                  await refreshAgents();
                  await refreshViolations();
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Stop
            </button>
          </div>

          <div className="progress-track">
            <span className={judgeStep === "agents" || judgeStep === "setup" || judgeStep === "running" || judgeStep === "completed" ? "active" : ""}>
              Agents created
            </span>
            <span className={judgeStep === "setup" || judgeStep === "running" || judgeStep === "completed" ? "active" : ""}>
              Pool ready
            </span>
            <span className={judgeStep === "running" || judgeStep === "completed" ? "active" : ""}>Swaps running</span>
            <span className={judgeStep === "completed" ? "active" : ""}>Completed</span>
          </div>

          {statusMessage ? (
            <div
              className={`status-banner ${statusType === "ok" ? "status-ok" : "status-error"} ${
                statusVisible ? "status-show" : "status-hide"
              }`}
            >
              {statusMessage}
            </div>
          ) : null}
        </section>

        <section className="social-layout">
          <aside className="card social-panel social-agents">
            <h3 className="display">Agents</h3>
            {agents.length === 0 ? (
              <p className="subtle">No agents yet.</p>
            ) : (
              <ul className="agent-chat-list">
                {agents.map((agent, index) => (
                  <li key={agent.agentId}>
                    <button
                      className={`agent-chat-card ${selected?.agentId === agent.agentId ? "active" : ""}`}
                      onClick={() => setSelectedAgentId(agent.agentId)}
                    >
                      <span className="avatar">A{index + 1}</span>
                      <span className="agent-chat-meta">
                        <strong>{agent.displayName?.trim() || `Agent ${index + 1}`}</strong>
                        <small>{shortId(agent.agentId)}</small>
                        <small>{agentPurpose(agent.strategy)}</small>
                      </span>
                      <span className={`status-chip ${agent.lastStatus}`}>{agent.lastStatus}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <article className="card social-panel social-feed">
            <h3 className="display">Live Activity</h3>
            {!selected ? (
              <p className="subtle">Select an agent to see activity.</p>
            ) : (
              <>
                <div className="feed-head">
                  <div>
                    <strong>Agent Role</strong>
                    <p>{agentPurpose(selected.strategy)}</p>
                  </div>
                  <div className="feed-copy-actions">
                    <button
                      type="button"
                      className="copy-btn"
                      aria-label="Copy selected agent ID"
                      onClick={() => void copyText(selected.agentId, "feed-agent-id")}
                    >
                      <CopyIcon />
                      <span>{copiedField === "feed-agent-id" ? "Copied" : "Copy ID"}</span>
                    </button>
                    <button
                      type="button"
                      className="copy-btn"
                      aria-label="Copy selected agent public key"
                      onClick={() => void copyText(selected.publicKey, "feed-pubkey")}
                    >
                      <CopyIcon />
                      <span>{copiedField === "feed-pubkey" ? "Copied" : "Copy Key"}</span>
                    </button>
                  </div>
                </div>

                <ul className="chat-feed-list">
                  {selectedAgentEvents.length === 0 ? (
                    <li className="chat-placeholder">No messages yet. Run a demo to see trade updates.</li>
                  ) : (
                    selectedAgentEvents
                      .slice(-40)
                      .reverse()
                      .map((evt, index) => (
                        <li
                          key={`${evt.timestamp}-${index}`}
                          className={`chat-bubble ${evt.status === "ok" ? "chat-ok" : "chat-error"}`}
                        >
                          <div className="chat-meta">
                            <span>{evt.agentId === "demo-run" ? "System" : shortId(evt.agentId)}</span>
                            <span>{relativeTime(evt.timestamp)}</span>
                          </div>
                          <p>
                            {evt.status === "ok"
                              ? `Completed ${evt.action}.`
                              : `Failed ${evt.action}: ${evt.err ?? "Unknown error"}`}
                          </p>
                          {evt.signature ? (
                            <a href={explorerUrl(evt.signature)} target="_blank" rel="noreferrer" className="mono">
                              View transaction
                            </a>
                          ) : null}
                        </li>
                      ))
                  )}
                </ul>
              </>
            )}
          </article>

          <aside className="card social-panel social-profile">
            <h3 className="display">Profile</h3>
            {!selected ? (
              <p className="subtle">Select an agent.</p>
            ) : (
              <div className="profile-stack">
                <div className="detail-item">
                  <small>What this agent is for</small>
                  <p>{agentPurpose(selected.strategy)}</p>
                </div>
                <div className="detail-item">
                  <small>Agent Name</small>
                  <div className="rename-row">
                    <input
                      type="text"
                      value={displayNameInput}
                      placeholder="e.g. Momentum Trader"
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                    />
                    <button
                      className="btn btn-ghost"
                      disabled={!selected || busyAction !== null || displayNameInput.trim().length === 0}
                      onClick={async () => {
                        if (!selected) return;
                        try {
                          await updateAgentName(selected.agentId, displayNameInput.trim());
                          await refreshAgents();
                          setStatus("Agent name updated.", "ok");
                        } catch (err) {
                          setStatus(err instanceof Error ? err.message : String(err), "error");
                        }
                      }}
                    >
                      Save Name
                    </button>
                  </div>
                  <button
                    className="btn btn-danger"
                    disabled={!selected || busyAction !== null}
                    onClick={async () => {
                      if (!selected) return;
                      const proceed = window.confirm(`Delete ${selected.displayName ?? selected.agentId}?`);
                      if (!proceed) return;
                      try {
                        await deleteAgent(selected.agentId);
                        await refreshAgents();
                        setSelectedAgentId(undefined);
                        setStatus("Agent deleted.", "ok");
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : String(err), "error");
                      }
                    }}
                  >
                    Delete Agent
                  </button>
                </div>
                <div className="detail-item">
                  <small>Agent ID</small>
                  <div className="copy-cell">
                    <div className="mono">{selected.agentId}</div>
                    <button
                      type="button"
                      className="copy-btn"
                      aria-label="Copy selected wallet ID"
                      onClick={() => void copyText(selected.agentId, "detail-agent-id")}
                    >
                      <CopyIcon />
                      <span>{copiedField === "detail-agent-id" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
                <div className="detail-item">
                  <small>Public Key</small>
                  <div className="copy-cell">
                    <div className="mono">{selected.publicKey}</div>
                    <button
                      type="button"
                      className="copy-btn"
                      aria-label="Copy selected public key"
                      onClick={() => void copyText(selected.publicKey, "detail-pubkey")}
                    >
                      <CopyIcon />
                      <span>{copiedField === "detail-pubkey" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
                <div className="detail-item">
                  <small>Trading Style</small>
                  <div className="field">
                    <select value={selectedStrategy} onChange={(e) => setSelectedStrategy(e.target.value)}>
                      {strategies.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn btn-ghost"
                    disabled={!selected || busyAction !== null}
                    onClick={async () => {
                      if (!selected) return;
                      try {
                        await updateAgentStrategy(selected.agentId, selectedStrategy);
                        await refreshAgents();
                        setStatus(`Strategy updated to ${selectedStrategy}.`, "ok");
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : String(err), "error");
                      }
                    }}
                  >
                    Apply Style
                  </button>
                </div>
                <div className="detail-item">
                  <small>Safety Limits</small>
                  <div className="mini-fields">
                    <label>
                      Max per trade
                      <input
                        type="number"
                        min={1}
                        value={policyForm.maxLamportsPerTx}
                        onChange={(e) =>
                          setPolicyForm((prev) => ({ ...prev, maxLamportsPerTx: Math.max(1, Number(e.target.value) || 1) }))
                        }
                      />
                    </label>
                    <label>
                      Daily cap
                      <input
                        type="number"
                        min={1}
                        value={policyForm.maxDailyLamports}
                        onChange={(e) =>
                          setPolicyForm((prev) => ({ ...prev, maxDailyLamports: Math.max(1, Number(e.target.value) || 1) }))
                        }
                      />
                    </label>
                    <label>
                      Slippage bps
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={policyForm.slippageBps}
                        onChange={(e) =>
                          setPolicyForm((prev) => ({ ...prev, slippageBps: Math.max(0, Number(e.target.value) || 0) }))
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="btn btn-ghost"
                    disabled={!selected || busyAction !== null}
                    onClick={async () => {
                      if (!selected) return;
                      try {
                        await updateAgentPolicy(selected.agentId, policyForm);
                        await refreshAgents();
                        setStatus(`Safety limits updated for ${selected.agentId}.`, "ok");
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : String(err), "error");
                      }
                    }}
                  >
                    Save Limits
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>

        <section className="card panel" style={{ marginTop: 14 }}>
          <h3 className="display">Transaction Log</h3>
          {events.length === 0 ? (
            <p className="subtle">No activity yet. Run funding and trades to populate this log.</p>
          ) : (
            <div className="table-wrap">
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {events
                    .slice(-35)
                    .reverse()
                    .map((evt, index) => (
                      <tr key={`${evt.timestamp}-${index}`}>
                        <td className="mono">{evt.agentId === "demo-run" ? "system" : shortId(evt.agentId)}</td>
                        <td>{evt.action}</td>
                        <td>
                          <span className={`status-chip ${evt.status === "ok" ? "running" : "error"}`}>
                            {evt.status}
                          </span>
                        </td>
                        <td>
                          {evt.signature ? (
                            <a href={explorerUrl(evt.signature)} target="_blank" rel="noreferrer" className="mono">
                              {shortId(evt.signature)}
                            </a>
                          ) : (
                            <span>{evt.err ?? "No error details"}</span>
                          )}
                        </td>
                        <td>{new Date(evt.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card panel" style={{ marginTop: 14 }}>
          <h3 className="display">Denied Transactions</h3>
          {violations.length === 0 ? (
            <p className="subtle">No blocked transactions yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Code</th>
                    <th>Reason</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.slice(0, 20).map((item) => (
                    <tr key={item.id}>
                      <td className="mono">{shortId(item.agentId)}</td>
                      <td>{item.code}</td>
                      <td>{item.message}</td>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
