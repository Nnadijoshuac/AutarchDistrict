"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createWallet,
  executeWallet,
  fundWallet,
  getWalletMonitor,
  getWalletTransactions,
  listWallets,
  type WalletAccount,
  type WalletMonitor,
  type WalletTransaction
} from "../../lib/api";

type BusyAction = "create" | "fund" | "execute" | null;

function shortPubkey(v: string) {
  return `${v.slice(0, 7)}...${v.slice(-5)}`;
}

function explorerUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function lamportsToSol(lamports: number) {
  return (lamports / 1_000_000_000).toFixed(4);
}

export default function DashboardPage() {
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | undefined>(undefined);
  const [monitor, setMonitor] = useState<WalletMonitor | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"ok" | "error">("ok");

  const [walletName, setWalletName] = useState("Alpha Agent");
  const [strategy, setStrategy] = useState<"heuristic_ai" | "random">("heuristic_ai");
  const [fundLamports, setFundLamports] = useState(100_000_000);
  const [rounds, setRounds] = useState(3);
  const [amount, setAmount] = useState(1000);

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.walletId === selectedWalletId) ?? wallets[0],
    [wallets, selectedWalletId]
  );

  useEffect(() => {
    void refreshWallets();
  }, []);

  useEffect(() => {
    if (!selectedWallet?.walletId) {
      setMonitor(null);
      setTransactions([]);
      return;
    }
    void refreshWalletDetails(selectedWallet.walletId);
  }, [selectedWallet?.walletId]);

  async function refreshWallets() {
    const response = await listWallets();
    setWallets(response.wallets);
    if (!selectedWalletId && response.wallets[0]) {
      setSelectedWalletId(response.wallets[0].walletId);
    }
  }

  async function refreshWalletDetails(walletId: string) {
    const [m, tx] = await Promise.all([getWalletMonitor(walletId), getWalletTransactions(walletId)]);
    setMonitor(m);
    setTransactions(tx.transactions);
  }

  function setStatus(message: string, type: "ok" | "error") {
    setStatusMessage(message);
    setStatusType(type);
  }

  return (
    <main className="dashboard-root">
      <div className="container">
        <header className="app-header">
          <div>
            <div className="pill">Autarch District Control Plane</div>
            <h1 className="display">Named Wallet Accounts for AI Agents</h1>
            <p>Create one wallet, fund it, execute autonomous actions, and monitor every transaction.</p>
          </div>
          <Link href="/" className="btn btn-ghost">
            Back to Landing
          </Link>
        </header>

        <section className="kpi-grid">
          <div className="card kpi">
            <div className="kpi-label">Wallet Accounts</div>
            <div className="kpi-value">{wallets.length}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Selected Wallet</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>
              {selectedWallet ? selectedWallet.name : "None"}
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">SOL Balance</div>
            <div className="kpi-value">{monitor ? `${lamportsToSol(monitor.balances.solLamports)} SOL` : "0 SOL"}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Transactions</div>
            <div className="kpi-value">{monitor?.activity.totalTransactions ?? 0}</div>
          </div>
        </section>

        <section className="card controls">
          <div className="controls-row">
            <div className="field">
              <label htmlFor="walletName">Wallet Name</label>
              <input
                id="walletName"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                style={{ width: 180 }}
              />
            </div>
            <div className="field">
              <label htmlFor="strategy">Strategy</label>
              <select
                id="strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as "heuristic_ai" | "random")}
                style={{ width: 160, height: 42, borderRadius: 10, border: "1px solid rgba(143, 173, 223, 0.35)" }}
              >
                <option value="heuristic_ai">heuristic_ai</option>
                <option value="random">random</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              disabled={busyAction !== null || walletName.trim().length < 2}
              onClick={async () => {
                try {
                  setBusyAction("create");
                  const created = await createWallet(walletName, strategy);
                  await refreshWallets();
                  setSelectedWalletId(created.wallet.walletId);
                  setStatus(`Wallet "${created.wallet.name}" created.`, "ok");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Create Wallet
            </button>

            <div className="field">
              <label htmlFor="fundLamports">Fund (lamports)</label>
              <input
                id="fundLamports"
                type="number"
                min={1}
                value={fundLamports}
                onChange={(e) => setFundLamports(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 150 }}
              />
            </div>
            <button
              className="btn btn-ghost"
              disabled={busyAction !== null || !selectedWallet}
              onClick={async () => {
                if (!selectedWallet) return;
                try {
                  setBusyAction("fund");
                  const funded = await fundWallet(selectedWallet.walletId, fundLamports);
                  await refreshWalletDetails(selectedWallet.walletId);
                  setStatus(`Wallet funded. Signature: ${shortPubkey(funded.signature)}`, "ok");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Fund Wallet
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
              disabled={busyAction !== null || !selectedWallet}
              onClick={async () => {
                if (!selectedWallet) return;
                try {
                  setBusyAction("execute");
                  const result = await executeWallet(selectedWallet.walletId, rounds, amount);
                  await refreshWalletDetails(selectedWallet.walletId);
                  setStatus(
                    `Execution complete. ${result.signatures.length} tx, ${result.holds} holds, ${result.errors.length} errors.`,
                    result.errors.length > 0 ? "error" : "ok"
                  );
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setBusyAction(null);
                }
              }}
            >
              Execute Agent
            </button>
          </div>
          {statusMessage ? (
            <div className={`status-banner ${statusType === "ok" ? "status-ok" : "status-error"}`}>{statusMessage}</div>
          ) : null}
        </section>

        <section className="app-grid">
          <article className="card panel">
            <h3 className="display">Wallet Accounts</h3>
            {wallets.length === 0 ? (
              <p className="subtle">No wallet accounts yet. Create one wallet to begin.</p>
            ) : (
              <table className="agent-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Public Key</th>
                    <th>Strategy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <tr
                      key={wallet.walletId}
                      className={`agent-row ${selectedWallet?.walletId === wallet.walletId ? "active" : ""}`}
                      onClick={() => setSelectedWalletId(wallet.walletId)}
                    >
                      <td>{wallet.name}</td>
                      <td className="mono">{shortPubkey(wallet.publicKey)}</td>
                      <td>{wallet.strategy}</td>
                      <td>
                        <span className={`status-chip ${wallet.status}`}>{wallet.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="card panel">
            <h3 className="display">Wallet Monitor</h3>
            {!monitor ? (
              <p className="subtle">Select a wallet to inspect balances and activity.</p>
            ) : (
              <div className="detail-list">
                <div className="detail-item">
                  <small>Wallet ID</small>
                  <div className="mono">{monitor.wallet.walletId}</div>
                </div>
                <div className="detail-item">
                  <small>Public Key</small>
                  <div className="mono">{monitor.wallet.publicKey}</div>
                </div>
                <div className="detail-item">
                  <small>SOL Balance</small>
                  <div>{lamportsToSol(monitor.balances.solLamports)} SOL</div>
                </div>
                <div className="detail-item">
                  <small>Token Balances</small>
                  <div>A: {monitor.balances.tokenA}</div>
                  <div>B: {monitor.balances.tokenB}</div>
                </div>
                <div className="detail-item">
                  <small>Activity</small>
                  <div>Total: {monitor.activity.totalTransactions}</div>
                  <div>Ok: {monitor.activity.okCount}</div>
                  <div>Hold: {monitor.activity.holdCount}</div>
                  <div>Errors: {monitor.activity.errorCount}</div>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="card panel" style={{ marginTop: 14 }}>
          <h3 className="display">Transaction Monitor</h3>
          {transactions.length === 0 ? (
            <p className="subtle">No transactions yet for selected wallet.</p>
          ) : (
            <ul className="log-list">
              {transactions.slice(0, 40).map((tx, idx) => (
                <li key={`${tx.timestamp}-${idx}`} className="log-item">
                  <div>
                    <span className="subtle">{new Date(tx.timestamp).toLocaleString()}</span> ·{" "}
                    <span className="mono">{tx.action}</span> · amount {tx.amount}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong className={tx.status === "ok" ? "ok" : tx.status === "hold" ? "subtle" : "error"}>
                      {tx.status}
                    </strong>{" "}
                    {tx.signature ? (
                      <a href={explorerUrl(tx.signature)} target="_blank" rel="noreferrer" className="mono">
                        {tx.signature}
                      </a>
                    ) : (
                      <span>{tx.reason ?? tx.error ?? ""}</span>
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
