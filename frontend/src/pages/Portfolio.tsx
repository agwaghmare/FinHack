import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { demoHoldings } from "../lib/mock";

const COLORS = ["#18181b", "#a1a1aa", "#52525b", "#e4e4e7"];

export function Portfolio() {
  const pieData = demoHoldings.map((h) => ({
    name: h.symbol,
    value: Math.round(h.weight * 100),
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Allocation
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Portfolio
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-200/60 px-6 py-4 dark:border-zinc-800/80">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Holdings
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Symbol</th>
                  <th className="px-6 py-3 font-medium">Weight</th>
                  <th className="px-6 py-3 font-medium">Value</th>
                  <th className="px-6 py-3 font-medium">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/80">
                {demoHoldings.map((h) => (
                  <tr
                    key={h.symbol}
                    className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {h.symbol}
                    </td>
                    <td className="px-6 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {(h.weight * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-3 tabular-nums text-zinc-700 dark:text-zinc-200">
                      ${h.value.toLocaleString()}
                    </td>
                    <td
                      className={`px-6 py-3 tabular-nums ${
                        h.pnl >= 0 ? "text-emerald-500" : "text-rose-400"
                      }`}
                    >
                      {h.pnl >= 0 ? "+" : ""}
                      {h.pnl.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Allocation
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={COLORS[index % COLORS.length]}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(9,9,11,0.92)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-500">
            <div className="rounded-lg bg-zinc-900/5 p-3 dark:bg-white/5">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                Risk breakdown
              </p>
              <p className="mt-1">
                Equity beta 0.92 · Duration 6.2y · FX 4%
              </p>
            </div>
            <div className="rounded-lg bg-zinc-900/5 p-3 dark:bg-white/5">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                Concentration
              </p>
              <p className="mt-1">Herfindahl 0.31 · Top name 42%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
