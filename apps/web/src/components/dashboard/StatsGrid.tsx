import { cn } from "../../lib/utils";

type StatsGridProps = {
  activeAgents: number;
  totalTransactions: number;
  rejected: number;
  totalSol?: number | null;
};

export function StatsGrid({ activeAgents, totalTransactions, rejected, totalSol }: StatsGridProps) {
  const stats = [
    { label: "ACTIVE AGENTS", value: String(activeAgents), color: "text-[#f97316]" },
    { label: "TRANSACTIONS", value: String(totalTransactions), color: "text-white" },
    { label: "DENIED", value: String(rejected), color: "text-zinc-300" },
    { label: "TREASURY SOL", value: totalSol != null ? totalSol.toFixed(4) : "-", color: "text-white" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
      {stats.map((stat) => (
        <div key={stat.label} className="skeuo-card p-4 rounded-xl">
          <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-2 uppercase">{stat.label}</div>
          <div className="skeuo-inset p-3">
            <div className={cn("text-2xl font-mono font-bold leading-none", stat.color)}>{stat.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
