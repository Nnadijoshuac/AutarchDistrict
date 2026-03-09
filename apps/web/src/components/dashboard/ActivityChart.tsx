import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TxEvent } from "../TxLog";
import type { PolicyViolation } from "../../lib/api";

type ActivityChartProps = {
  events: TxEvent[];
  violations: PolicyViolation[];
};

type Bucket = {
  time: string;
  executed: number;
  denied: number;
  policy: number;
};

export function ActivityChart({ events, violations }: ActivityChartProps) {
  const buckets = new Map<string, Bucket>();

  for (const evt of events) {
    const d = new Date(evt.timestamp);
    const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { time: key, executed: 0, denied: 0, policy: 0 };
    if (evt.status === "ok") bucket.executed += 1;
    else bucket.denied += 1;
    buckets.set(key, bucket);
  }

  for (const violation of violations) {
    const d = new Date(violation.createdAt);
    const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { time: key, executed: 0, denied: 0, policy: 0 };
    bucket.policy += 1;
    buckets.set(key, bucket);
  }

  const data = Array.from(buckets.values()).slice(-20);

  return (
    <div className="p-6 pt-0">
      <div className="skeuo-card rounded-xl p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Activity Vectors</h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="px-2 py-1 rounded skeuo-inset text-[#f97316]">Executed</span>
            <span className="px-2 py-1 rounded skeuo-inset text-zinc-300">Denied</span>
            <span className="px-2 py-1 rounded skeuo-inset text-zinc-500">Policy</span>
          </div>
        </div>

        <div className="h-[220px] w-full skeuo-inset p-3">
          {data.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-[11px] text-zinc-500">
              No activity yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 9, fontFamily: "JetBrains Mono" }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1e",
                    border: "1px solid #ffffff10",
                    borderRadius: "8px",
                    fontSize: "10px"
                  }}
                />
                <Line type="monotone" dataKey="executed" stroke="#f97316" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="denied" stroke="#d4d4d8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="policy" stroke="#71717a" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
