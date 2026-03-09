import { LayoutDashboard, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Agent } from "../../lib/api";
import Link from "next/link";
import Image from "next/image";

type SidebarProps = {
  agents: Agent[];
  selectedAgentId?: string;
  onSelectAgent?: (id: string) => void;
  activePage?: "dashboard" | "agents";
};

export function Sidebar({ agents, selectedAgentId, onSelectAgent, activePage = "dashboard" }: SidebarProps) {
  const activeAgents = agents.slice(0, 3);

  return (
    <aside className="w-60 border-r border-white/5 bg-[#0f0f11] flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-4 flex items-center gap-2">
        <Image src="/autarchlogo.png" alt="Autarch District" width={64} height={64} className="rounded-md object-contain -translate-x-1" priority />
        <h1 className="font-bold text-lg tracking-tight text-white" style={{ fontFamily: "var(--font-logo), sans-serif" }}>
          Autarch
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        <nav className="space-y-1">
          <Link
            href="/app"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium",
              activePage === "dashboard"
                ? "bg-[#f97316] text-white"
                : "text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/app/agents"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              activePage === "agents"
                ? "bg-[#f97316] text-white"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Agents</span>
            {agents.length > 0 && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{agents.length}</span>}
          </Link>
        </nav>

        <div className="space-y-2">
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-2">Active</div>
          {activeAgents.map((agent, index) =>
            activePage === "agents" ? (
              <button
                key={agent.agentId}
                type="button"
                onClick={() => onSelectAgent?.(agent.agentId)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] text-zinc-400 hover:text-white skeuo-button group",
                  selectedAgentId === agent.agentId ? "ring-1 ring-[#f97316] text-white" : undefined
                )}
              >
                <div className="w-6 h-6 rounded bg-[#f97316] flex items-center justify-center text-[8px] font-bold text-white">
                  {agent.displayName?.[0]?.toUpperCase() ?? `A${index + 1}`}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium truncate">{agent.displayName?.trim() || `Agent ${index + 1}`}</div>
                </div>
              </button>
            ) : (
              <Link
                key={agent.agentId}
                href={`/app/agents?agentId=${encodeURIComponent(agent.agentId)}`}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] text-zinc-400 hover:text-white skeuo-button group"
              >
                <div className="w-6 h-6 rounded bg-[#f97316] flex items-center justify-center text-[8px] font-bold text-white">
                  {agent.displayName?.[0]?.toUpperCase() ?? `A${index + 1}`}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium truncate">{agent.displayName?.trim() || `Agent ${index + 1}`}</div>
                </div>
              </Link>
            )
          )}
        </div>
      </div>
    </aside>
  );
}
