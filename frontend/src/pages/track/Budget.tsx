import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import {
  CATEGORY_LABELS,
  budgetAlerts,
  categoryTotalsWithRecurring,
  currentYearMonth,
} from "../../lib/trackFinance";
import { InsightPanel, LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

export function TrackBudget() {
  const { state, updateBudget } = useTrackFinance();
  const ym = currentYearMonth();
  const actual = categoryTotalsWithRecurring(state, ym);
  const alerts = budgetAlerts(state, ym);

  const chartData = useMemo(
    () =>
      state.budgets
        .slice()
        .sort((a, b) => actual[b.category] - actual[a.category])
        .map((b) => ({
          name: CATEGORY_LABELS[b.category],
          Budget: Math.round(b.monthlyLimit),
          Actual: Math.round(actual[b.category]),
          key: b.category,
        })),
    [state.budgets, actual],
  );

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Budget"
        title="Budget vs actual"
        subtitle="Bars compare your plan to real outflows (including recurring subscriptions in each category)."
      />

      {alerts.length > 0 ? (
        <InsightPanel
          title="Over-budget alerts"
          lines={alerts.map((a) => `⚠ ${a}`)}
        />
      ) : (
        <p className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200/90">
          No category is over budget this month — nice discipline.
        </p>
      )}

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Comparison chart</h2>
        <div className="mt-6 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(v: number) => fmtMoney(v)}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
              />
              <Legend />
              <Bar dataKey="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Actual" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Edit monthly limits</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.budgets.map((b) => (
            <label key={b.category} className="block text-sm text-zinc-400">
              {CATEGORY_LABELS[b.category]}
              <input
                type="number"
                min={0}
                step={25}
                value={b.monthlyLimit}
                onChange={(e) => updateBudget(b.category, Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Spent {fmtMoney(actual[b.category])} ·{" "}
                {actual[b.category] > b.monthlyLimit ? (
                  <span className="text-rose-400">
                    {(((actual[b.category] - b.monthlyLimit) / b.monthlyLimit) * 100).toFixed(0)}% over
                  </span>
                ) : (
                  <span className="text-emerald-400/90">on track</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      <LinkToInvest
        headline="Fix leaks, then invest the slack"
        body="Each 10% you pull back from an over-budget category is money you can auto-route to your portfolio next month."
      />
    </div>
  );
}
