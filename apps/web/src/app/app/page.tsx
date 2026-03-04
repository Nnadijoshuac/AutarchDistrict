"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAgents,
  listAgents,
  listPolicyViolations,
  listStrategies,
  runDemo,
  setupDemo,
  stopDemo,
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
  const [judgeStep, setJudgeStep] = useState<JudgeStep>("idle");
  const [theme, setTheme] = useState<"light" | "dark">("light");
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

  useEffect(() => {
    if (selected?.policyProfile) {
      setPolicyForm(selected.policyProfile);
    }
    if (selected?.strategy) {
      setSelectedStrategy(selected.strategy);
    }
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
        `Judge mode complete: ${result.signatures.length} signatures, ${result.errors.length} errors.`,
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

  return (
    <main className={`dashboard-root ${theme === "dark" ? "dashboard-dark" : "dashboard-light"}`}>
      <div className="container">
        <header className="app-header">
          <div>
            <div className="pill">Autarch District Control Plane</div>
            <h1 className="display">Agent Wallet Dashboard</h1>
            <p>Provision, fund, execute, and monitor autonomous wallet activity on Solana devnet.</p>
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
              <label htmlFor="strategy">Strategy</label>
              <select
                id="strategy"
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
              >
                {strategies.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

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
                  await refreshViolations();
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
                  await refreshViolations();
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
            <button className="btn btn-primary" disabled={busyAction !== null} onClick={() => void runJudgeMode()}>
              Run Full Demo
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
                  await refreshViolations();
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
          <div className="controls-row controls-policy">
            <div className="field">
              <label htmlFor="maxPerTx">Max / Tx (lamports)</label>
              <input
                id="maxPerTx"
                type="number"
                min={1}
                value={policyForm.maxLamportsPerTx}
                onChange={(e) =>
                  setPolicyForm((prev) => ({ ...prev, maxLamportsPerTx: Math.max(1, Number(e.target.value) || 1) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="maxDaily">Daily Cap (lamports)</label>
              <input
                id="maxDaily"
                type="number"
                min={1}
                value={policyForm.maxDailyLamports}
                onChange={(e) =>
                  setPolicyForm((prev) => ({ ...prev, maxDailyLamports: Math.max(1, Number(e.target.value) || 1) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="slippage">Slippage (bps)</label>
              <input
                id="slippage"
                type="number"
                min={0}
                max={10000}
                value={policyForm.slippageBps}
                onChange={(e) =>
                  setPolicyForm((prev) => ({ ...prev, slippageBps: Math.max(0, Number(e.target.value) || 0) }))
                }
              />
            </div>
            <button
              className="btn btn-ghost"
              disabled={!selected || busyAction !== null}
              onClick={async () => {
                if (!selected) return;
                try {
                  await updateAgentPolicy(selected.agentId, policyForm);
                  await refreshAgents();
                  setStatus(`Policy updated for ${selected.agentId}.`, "ok");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                }
              }}
            >
              Save Policy
            </button>
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
              Apply Strategy
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
          <h3 className="display">Denied Transactions</h3>
          {violations.length === 0 ? (
            <p className="subtle">No policy violations yet.</p>
          ) : (
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
                    <td className="mono">{item.agentId}</td>
                    <td>{item.code}</td>
                    <td>{item.message}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
