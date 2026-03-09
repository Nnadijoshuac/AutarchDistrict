import type { TxEvent } from "../TxLog";
import type { PolicyViolation } from "../../lib/api";
import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

type RecentDecisionsProps = {
  events: TxEvent[];
  violations: PolicyViolation[];
  tone?: "default" | "neutral";
};

export function RecentDecisions({ events, violations, tone = "default" }: RecentDecisionsProps) {
  const explorerUrl = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  const [tab, setTab] = useState<"all" | "executed" | "denied">("all");

  const combined = useMemo(() => {
    const eventItems = events.map((evt) => ({ type: "event" as const, timestamp: evt.timestamp, evt }));
    const violationItems = violations.map((violation) => ({
      type: "violation" as const,
      timestamp: violation.createdAt,
      violation
    }));
    return [...eventItems, ...violationItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, violations]);

  const executedCount = useMemo(() => events.filter((evt) => evt.status === "ok").length, [events]);
  const deniedCount = useMemo(() => events.filter((evt) => evt.status !== "ok").length + violations.length, [events, violations]);

  const filtered = useMemo(() => {
    if (tab === "executed") return combined.filter((item) => item.type === "event" && item.evt.status === "ok");
    if (tab === "denied") return combined.filter((item) => item.type === "violation" || (item.type === "event" && item.evt.status !== "ok"));
    return combined;
  }, [combined, tab]);

  const activeTabClass = tone === "neutral" ? "text-white bg-zinc-800" : "text-[#f97316] bg-zinc-900";
  const passiveTabClass = "text-zinc-500 hover:text-zinc-300";

  return (
    <aside className="w-80 border-l border-white/5 bg-[#0f0f11] flex flex-col h-screen sticky top-0 overflow-y-auto shrink-0">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-tight">Transactions</h3>
        <div className="flex items-center gap-2 p-1 skeuo-inset">
          <button type="button" className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded ${tab === "all" ? activeTabClass : passiveTabClass}`} onClick={() => setTab("all")}>All ({combined.length})</button>
          <button type="button" className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded ${tab === "executed" ? activeTabClass : passiveTabClass}`} onClick={() => setTab("executed")}>Executed ({executedCount})</button>
          <button type="button" className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded ${tab === "denied" ? activeTabClass : passiveTabClass}`} onClick={() => setTab("denied")}>Denied ({deniedCount})</button>
        </div>
      </div>

      <div className="flex-1 divide-y divide-white/5">
        {filtered.slice(0, 40).map((item, index) =>
          item.type === "event" ? (
            <div key={`${item.evt.timestamp}-${index}`} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-white truncate">{item.evt.agentId === "demo-run" ? "System" : item.evt.agentId.slice(0, 10)}</span>
                <span className="text-[9px] font-mono text-zinc-600">{new Date(item.evt.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 font-mono">{item.evt.action}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] text-zinc-500">{item.evt.status}</span>
                {item.evt.signature ? (
                  <a href={explorerUrl(item.evt.signature)} target="_blank" rel="noreferrer" className="p-1 skeuo-button text-zinc-500 hover:text-white inline-flex" title="Verify on Solana Explorer">
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div key={`${item.violation.id}-${index}`} className="p-3">
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[10px] font-semibold text-white truncate">{item.violation.code}</span>
                <span className="text-[9px] font-mono text-zinc-600">{new Date(item.violation.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">{item.violation.message}</p>
            </div>
          )
        )}
      </div>

      {filtered.length === 0 && <div className="p-4 text-[10px] text-zinc-500">No items for this filter yet.</div>}
    </aside>
  );
}
