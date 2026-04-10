import { type FormEvent, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type SpendCategory,
  categoryTotalsWithRecurring,
  currentYearMonth,
  lastNYearMonths,
  spendingInsights,
} from "../../lib/trackFinance";
import { InsightPanel, LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

const CATEGORY_ORDER: SpendCategory[] = [
  "rent",
  "food",
  "dining",
  "subscriptions",
  "transport",
  "utilities",
  "travel",
  "other",
];

export function TrackSpending() {
  const { state, addTransaction } = useTrackFinance();
  const ym = currentYearMonth();
  const prevYm = lastNYearMonths(2, ym)[0];
  const totals = categoryTotalsWithRecurring(state, ym);
  const prevTotals = categoryTotalsWithRecurring(state, prevYm);
  const income = state.monthlyIncome;
  const insights = spendingInsights(state, ym);

  const pieData = useMemo(
    () =>
      CATEGORY_ORDER.filter((c) => totals[c] > 0).map((c) => ({
        name: CATEGORY_LABELS[c],
        value: Math.round(totals[c]),
        category: c,
      })),
    [totals],
  );

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<SpendCategory>("dining");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addTransaction({ date, amount: n, category, merchant: merchant || undefined });
    setAmount("");
    setMerchant("");
  }

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Spending"
        title="Smart spending breakdown"
        subtitle="Categories combine card/cash transactions plus recurring subscriptions. Percentages are vs monthly take-home."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">This month by category</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Monthly table</h2>
          <p className="mt-1 text-xs text-zinc-500">Current month: {ym} · vs {prevYm}</p>
          <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-900/95 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Spent</th>
                  <th className="px-3 py-2 text-right">% income</th>
                  <th className="px-3 py-2 text-right">vs last</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((c) => {
                  const spent = totals[c];
                  const was = prevTotals[c];
                  const pctInc = income > 0 ? (spent / income) * 100 : 0;
                  const delta = was > 0 ? ((spent - was) / was) * 100 : null;
                  if (spent <= 0 && was <= 0) return null;
                  return (
                    <tr key={c} className="border-t border-zinc-800/80">
                      <td className="px-3 py-2 text-zinc-200">{CATEGORY_LABELS[c]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{fmtMoney(spent)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{pctInc.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <InsightPanel title="Insights" lines={insights} />

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Add expense</h2>
        <form onSubmit={onAdd} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-zinc-400">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Amount
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-32 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SpendCategory)}
              className="mt-1 block rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[8rem] flex-1 text-sm text-zinc-400">
            Merchant (optional)
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
          >
            Add
          </button>
        </form>
      </section>

      <LinkToInvest
        headline="Trim a category → invest the difference"
        body="When you cut dining or subscriptions, redirect that monthly amount into your portfolio to connect habit change to compounding."
      />
    </div>
  );
}
