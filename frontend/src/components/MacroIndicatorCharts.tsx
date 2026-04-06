import { Loader2 } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MacroHistoryPoint = { date: string; value: number };

export type MacroHistorySeries = {
  key: string;
  fred_id?: string;
  label?: string;
  points?: MacroHistoryPoint[];
  point_count?: number;
};

export type MacroHistoryPayload = {
  window_years?: number;
  start?: string;
  end?: string;
  series?: MacroHistorySeries[];
};

function formatTick(d: string) {
  if (!d || d.length < 7) return d;
  return d.slice(0, 7);
}

export function MacroIndicatorCharts({
  data,
  loading,
}: {
  data: MacroHistoryPayload | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading macro trends…
      </div>
    );
  }

  const rows = data?.series ?? [];
  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-zinc-500">
        No macro history loaded. FRED data uses the public CSV feed without a key; add{" "}
        <code className="rounded bg-zinc-200/80 px-1 text-xs dark:bg-zinc-800">FRED_API_KEY</code> for
        higher limits.
      </p>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((s) => {
        const pts = (s.points ?? []).map((p) => ({
          ...p,
          x: p.date,
        }));
        const empty = pts.length === 0;
        return (
          <div
            key={s.key}
            className="glass rounded-2xl border border-zinc-200/70 p-4 dark:border-zinc-800/90"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {s.fred_id ?? s.key}
                </p>
                <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{s.label}</p>
              </div>
              <span className="text-[10px] tabular-nums text-zinc-400">
                {data?.window_years != null ? `${data.window_years}y window` : "1y"}
              </span>
            </div>
            {empty ? (
              <p className="mt-6 text-xs text-amber-600 dark:text-amber-400">No observations in range.</p>
            ) : (
              <div className="mt-3 h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pts} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "currentColor" }}
                      className="text-zinc-500"
                      tickFormatter={formatTick}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      width={44}
                      tick={{ fontSize: 9, fill: "currentColor" }}
                      className="text-zinc-500"
                      tickFormatter={(v) =>
                        typeof v === "number" && Math.abs(v) >= 1000
                          ? `${(v / 1000).toFixed(1)}k`
                          : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(24,24,27,0.95)",
                        border: "1px solid rgba(63,63,70,0.8)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelFormatter={(l) => `Date: ${l}`}
                      formatter={(v: number) => [v.toLocaleString(), "Value"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={pts.length < 400}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-[10px] text-zinc-500">
              Source: FRED · frequency varies (e.g. GDP quarterly, CPI monthly).
            </p>
          </div>
        );
      })}
    </div>
  );
}
