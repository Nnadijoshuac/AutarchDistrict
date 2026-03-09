"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createAgents,
  deleteAgent,
  listAgents,
  listPolicyViolations,
  listStrategies,
  listTransactions,
  resolveWsUrl,
  runDemo,
  setupDemo,
  stopDemo,
  updateAgentName,
  updateAgentPolicy,
  updateAgentStrategy,
  type Agent,
  type DemoRunResponse,
  type PolicyProfile,
  type PolicyViolation
} from "../../../lib/api";
import type { TxEvent } from "../../../components/TxLog";
import { Sidebar } from "../../../components/dashboard/Sidebar";
import { DashboardHeader } from "../../../components/dashboard/DashboardHeader";
import { AgentGrid } from "../../../components/dashboard/AgentGrid";
import { RecentDecisions } from "../../../components/dashboard/RecentDecisions";

const WS_URL = resolveWsUrl();

type BusyAction = "create" | "setup" | "run" | "stop" | null;
type JudgeStep = "idle" | "agents" | "setup" | "running" | "completed";

function shortId(v?: string | null) {
  if (!v) return "n/a";
  if (v.length <= 20) return v;
  return `${v.slice(0, 14)}...${v.slice(-6)}`;
}

function explorerUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
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

export default function AgentsPage() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [createCount, setCreateCount] = useState(3);
  const [setupAgents, setSetupAgents] = useState(5);
  const [rounds, setRounds] = useState(3);
  const [amount, setAmount] = useState(1000);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [judgeStep, setJudgeStep] = useState<JudgeStep>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"ok" | "error">("ok");
  const [statusVisible, setStatusVisible] = useState(false);
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const EVENT_CACHE_KEY = "autarch-events-cache-v2";
  const VIOLATION_CACHE_KEY = "autarch-violations-cache-v2";

  const selected = useMemo(() => agents.find((a) => a.agentId === selectedAgentId) ?? agents[0], [agents, selectedAgentId]);

  const selectedAgentEvents = useMemo(() => {
    if (!selected) return [];
    return events
      .filter((evt) => evt.agentId === selected.agentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, selected]);
  const selectedOkCount = useMemo(() => selectedAgentEvents.filter((evt) => evt.status === "ok").length, [selectedAgentEvents]);
  const selectedErrorCount = useMemo(() => selectedAgentEvents.filter((evt) => evt.status !== "ok").length, [selectedAgentEvents]);

  useEffect(() => {
    const fromUrl = searchParams.get("agentId");
    if (!fromUrl) return;
    if (agents.some((a) => a.agentId === fromUrl)) setSelectedAgentId(fromUrl);
  }, [agents, searchParams]);

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
        const [agentRows, strategyRows, policyRows, txRows] = await Promise.all([
          listAgents(),
          listStrategies(),
          listPolicyViolations(),
          listTransactions()
        ]);
        setAgents(agentRows);
        setStrategies(strategyRows);
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
        if (strategyRows.length > 0) setSelectedStrategy(strategyRows[0]);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "error");
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refreshTransactions(), 12000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (disposed) return;
      const agentQuery = selectedAgentId ? `?agentId=${encodeURIComponent(selectedAgentId)}` : "";
      ws = new WebSocket(`${WS_URL}${agentQuery}`);
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
        void refreshAgents();
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      ws?.close();
    };
  }, [selectedAgentId]);

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
    if (selected?.policyProfile) setPolicyForm(selected.policyProfile);
    if (selected?.strategy) setSelectedStrategy(selected.strategy);
    setDisplayNameInput(selected?.displayName ?? "");
  }, [selected]);

  async function refreshAgents() {
    setAgents(await listAgents());
  }

  async function refreshTransactions() {
    const txRows = await listTransactions();
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

  async function refreshViolations() {
    setViolations(await listPolicyViolations());
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

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      await refreshTransactions();
      await refreshViolations();

      setJudgeStep("completed");
      setStatus(`Quick demo done: ${result.signatures.length} successful, ${result.errors.length} failed.`, result.errors.length > 0 ? "error" : "ok");
    } catch (err) {
      setJudgeStep("idle");
      setStatus(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusyAction(null);
    }
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

  const activeControlStep = useMemo(() => {
    if (busyAction === "create") return 1;
    if (busyAction === "setup") return 2;
    if (busyAction === "run" || busyAction === "stop") return 3;
    return null;
  }, [busyAction]);
  const stopReady = busyAction === "run" || judgeStep === "running";

  return (
    <main className="admin-shell min-h-screen bg-[#0f0f11] text-zinc-100 agents-skeuo">
      <div className="flex min-h-screen">
        <Sidebar agents={agents} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} activePage="agents" />

        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto p-6 agents-content">
              <section className="card controls agents-controls">
                <div className="agents-section-head">
                  <h3 className="display">Agent Controls</h3>
                  <ol className="controls-stepper" aria-label="Agent control steps">
                    <li className={judgeStep === "agents" || judgeStep === "setup" || judgeStep === "running" || judgeStep === "completed" || busyAction === "create" ? "active" : ""}>Create</li>
                    <li className={judgeStep === "setup" || judgeStep === "running" || judgeStep === "completed" || busyAction === "setup" ? "active" : ""}>Setup</li>
                    <li className={judgeStep === "running" || judgeStep === "completed" || busyAction === "run" || busyAction === "stop" ? "active" : ""}>Run</li>
                    <li className={judgeStep === "completed" ? "active" : ""}>Verify</li>
                  </ol>
                </div>
                <div className="controls-layout">
                  <div className={`control-group${activeControlStep === 1 ? " is-live" : ""}`}>
                    <div className="control-group-head">
                      <span className="step-badge">1</span>
                      <h4>Provision Wallets</h4>
                    </div>
                    <div className="control-inline control-inline-single">
                      <div className="field">
                        <label htmlFor="createCount">Wallets to create</label>
                        <input id="createCount" type="number" min={1} max={20} value={createCount} onChange={(e) => setCreateCount(Math.max(1, Number(e.target.value) || 1))} />
                      </div>
                      <button className="btn btn-ghost" disabled={busyAction !== null} onClick={async () => {
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
                      }}>{busyAction === "create" ? "Creating..." : "Create Wallets"}</button>
                    </div>
                  </div>

                  <div className={`control-group${activeControlStep === 2 ? " is-live" : ""}`}>
                    <div className="control-group-head">
                      <span className="step-badge">2</span>
                      <h4>Setup & Funding</h4>
                    </div>
                    <div className="control-inline control-inline-single">
                      <div className="field">
                        <label htmlFor="setupAgents">Agents to fund</label>
                        <input id="setupAgents" type="number" min={1} max={50} value={setupAgents} onChange={(e) => setSetupAgents(Math.max(1, Number(e.target.value) || 1))} />
                      </div>
                      <button className="btn btn-primary btn-setup" disabled={busyAction !== null} onClick={async () => {
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
                      }}>{busyAction === "setup" ? "Funding..." : "Fund Agents"}</button>
                    </div>
                  </div>

                  <div className={`control-group${activeControlStep === 3 ? " is-live" : ""}`}>
                    <div className="control-group-head">
                      <span className="step-badge">3</span>
                      <h4>Run & Stop</h4>
                    </div>
                    <div className="control-inline control-inline-run">
                      <div className="control-inputs">
                        <div className="field">
                          <label htmlFor="rounds">Rounds</label>
                          <input id="rounds" type="number" min={1} max={30} value={rounds} onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 1))} />
                        </div>
                        <div className="field">
                          <label htmlFor="amount">Amount</label>
                          <input id="amount" type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} />
                        </div>
                      </div>
                      <div className="control-actions">
                        <button className="btn btn-primary btn-run" disabled={busyAction !== null} onClick={async () => {
                          try {
                            setBusyAction("run");
                            const result = await runDemo(rounds, amount);
                            appendRunEvents(result);
                            await refreshAgents();
                            await refreshTransactions();
                            await refreshViolations();
                            setStatus(`Run complete: ${result.signatures.length} successful, ${result.errors.length} failed.`, result.errors.length > 0 ? "error" : "ok");
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : String(err), "error");
                          } finally {
                            setBusyAction(null);
                          }
                        }}>{busyAction === "run" ? "Running..." : "Run Rounds"}</button>
                        <button className="btn btn-primary btn-demo" disabled={busyAction !== null} onClick={() => void runJudgeMode()}>Quick Demo</button>
                        <button
                          className={`btn btn-ghost ${stopReady ? "btn-stop-live" : ""}`}
                          disabled={busyAction === "create" || busyAction === "setup" || busyAction === "stop"}
                          onClick={async () => {
                          try {
                            setBusyAction("stop");
                            await stopDemo();
                            setStatus("Stopped.", "ok");
                            setJudgeStep("idle");
                            await refreshAgents();
                            await refreshTransactions();
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : String(err), "error");
                          } finally {
                            setBusyAction(null);
                          }
                        }}
                        >
                          {busyAction === "stop" ? "Stopping..." : stopReady ? "Stop Now" : "Stop Run"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {statusMessage ? (
                  <div className={`status-banner ${statusType === "ok" ? "status-ok" : "status-error"} ${statusVisible ? "status-show" : "status-hide"}`}>
                    {statusMessage}
                  </div>
                ) : null}
              </section>

              <section className="social-layout agents-social">
                <article className="card social-panel social-feed">
                  <h3 className="display">Live Activity</h3>
                  {!selected ? (
                    <p className="subtle">Select an agent to see activity.</p>
                  ) : (
                    <>
                      <div className="feed-head feed-head-portfolio">
                        <div>
                          <strong>{shortId(selected.agentId)}</strong>
                        </div>
                        <div className="feed-metrics">
                          <div className="skeuo-inset metric-chip">
                            <small>Executed</small>
                            <strong>{selectedOkCount}</strong>
                          </div>
                          <div className="skeuo-inset metric-chip">
                            <small>Denied</small>
                            <strong>{selectedErrorCount}</strong>
                          </div>
                        </div>
                      </div>

                      <ul className="chat-feed-list">
                        {selectedAgentEvents.length === 0 ? (
                          <li className="chat-placeholder">No messages yet. Run a demo to see trade updates.</li>
                        ) : (
                          selectedAgentEvents.slice(0, 40).map((evt, index) => (
                            <li key={`${evt.timestamp}-${index}`} className={`chat-bubble ${evt.status === "ok" ? "chat-ok" : "chat-error"}`}>
                              <div className="chat-meta">
                                <span>{evt.agentId === "demo-run" ? "System" : shortId(evt.agentId)}</span>
                                <span>{relativeTime(evt.timestamp)}</span>
                              </div>
                              <p>{evt.status === "ok" ? `Completed ${evt.action}.` : `Failed ${evt.action}: ${evt.err ?? "Unknown error"}`}</p>
                              <p className="mono" style={{ marginTop: 6, fontSize: 11 }}>{new Date(evt.timestamp).toLocaleString()}</p>
                              {evt.signature ? <a href={explorerUrl(evt.signature)} target="_blank" rel="noreferrer" className="mono">View transaction</a> : null}
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
                      <div className="detail-item profile-edit-group">
                        <small>Agent Name</small>
                        <div className="rename-row">
                          <input type="text" value={displayNameInput} placeholder="e.g. agent 001" onChange={(e) => setDisplayNameInput(e.target.value)} />
                          <button className="btn btn-ghost" disabled={!selected || busyAction !== null || displayNameInput.trim().length === 0} onClick={async () => {
                            if (!selected) return;
                            try {
                              await updateAgentName(selected.agentId, displayNameInput.trim());
                              await refreshAgents();
                              setStatus("Agent name updated.", "ok");
                            } catch (err) {
                              setStatus(err instanceof Error ? err.message : String(err), "error");
                            }
                          }}>Save Name</button>
                        </div>
                      </div>
                      <div className="detail-item profile-edit-group">
                        <small>Agent ID</small>
                        <div className="copy-cell">
                          <div className="mono">{selected.agentId}</div>
                          <button type="button" className="copy-btn" aria-label="Copy selected wallet ID" onClick={() => void copyText(selected.agentId, "detail-agent-id")}><CopyIcon /><span>{copiedField === "detail-agent-id" ? "Copied" : "Copy"}</span></button>
                        </div>
                      </div>
                      <div className="detail-item profile-edit-group">
                        <small>Public Key</small>
                        <div className="copy-cell">
                          <div className="mono">{selected.publicKey}</div>
                          <button type="button" className="copy-btn" aria-label="Copy selected public key" onClick={() => void copyText(selected.publicKey, "detail-pubkey")}><CopyIcon /><span>{copiedField === "detail-pubkey" ? "Copied" : "Copy"}</span></button>
                        </div>
                      </div>
                      <div className="detail-item profile-edit-group">
                        <small>Trading Style</small>
                        <div className="field">
                          <select value={selectedStrategy} onChange={(e) => setSelectedStrategy(e.target.value)}>
                            {strategies.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </div>
                        <button className="btn btn-ghost" disabled={!selected || busyAction !== null} onClick={async () => {
                          if (!selected) return;
                          try {
                            await updateAgentStrategy(selected.agentId, selectedStrategy);
                            await refreshAgents();
                            setStatus(`Strategy updated to ${selectedStrategy}.`, "ok");
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : String(err), "error");
                          }
                        }}>Apply Style</button>
                      </div>
                      <div className="detail-item profile-edit-group">
                        <small>Safety Limits</small>
                        <div className="mini-fields">
                          <label>Max per trade<input type="number" min={1} value={policyForm.maxLamportsPerTx} onChange={(e) => setPolicyForm((prev) => ({ ...prev, maxLamportsPerTx: Math.max(1, Number(e.target.value) || 1) }))} /></label>
                          <label>Daily cap<input type="number" min={1} value={policyForm.maxDailyLamports} onChange={(e) => setPolicyForm((prev) => ({ ...prev, maxDailyLamports: Math.max(1, Number(e.target.value) || 1) }))} /></label>
                          <label>Slippage bps<input type="number" min={0} max={10000} value={policyForm.slippageBps} onChange={(e) => setPolicyForm((prev) => ({ ...prev, slippageBps: Math.max(0, Number(e.target.value) || 0) }))} /></label>
                        </div>
                        <button className="btn btn-ghost" disabled={!selected || busyAction !== null} onClick={async () => {
                          if (!selected) return;
                          try {
                            await updateAgentPolicy(selected.agentId, policyForm);
                            await refreshAgents();
                            setStatus(`Safety limits updated for ${selected.agentId}.`, "ok");
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : String(err), "error");
                          }
                        }}>Save Limits</button>
                      </div>
                      <div className="detail-item profile-danger-action">
                        <small>Danger Zone</small>
                        <button className="btn btn-danger" disabled={!selected || busyAction !== null} onClick={async () => {
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
                        }}>Delete Agent</button>
                      </div>
                    </div>
                  )}
                </aside>
              </section>

              <AgentGrid agents={agents} />

              <div className="lg:hidden mt-4">
                <RecentDecisions events={events} violations={violations} tone="neutral" />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <RecentDecisions events={events} violations={violations} tone="neutral" />
        </div>
      </div>
    </main>
  );
}
