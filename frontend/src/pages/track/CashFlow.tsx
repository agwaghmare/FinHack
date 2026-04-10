import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import { cashFlowSeries, subscriptionsMonthlyTotal } from "../../lib/trackFinance";
import { LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

function shortMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function TrackCashFlow() {
  const { state, setMonthlyIncome } = useTrackFinance();
  const series = cashFlowSeries(state, 8);
  const last = series[series.length - 1];
  const subM = subscriptionsMonthlyTotal(state.subscriptions);

  const data = series.map((r) => ({
    month: shortMonth(r.month),
    Income: Math.round(r.income),
    Expenses: Math.round(r.expenses),
    Net: Math.round(r.net),
  }));

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Cash flow"
        title="Income, expenses, net savings"
        subtitle="Expenses include all logged transactions plus recurring subscription equivalents each month."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Monthly income</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">{fmtMoney(state.monthlyIncome)}</p>
          <input
            type="number"
            min={0}
            step={100}
            value={state.monthlyIncome}
            onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          />
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Expenses (this month)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-200/90">{fmtMoney(last?.expenses ?? 0)}</p>
          <p className="mt-2 text-xs text-zinc-500">Includes ~{fmtMoney(subM)}/mo from subscription list</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Net (this month)</p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${(last?.net ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {fmtMoney(last?.net ?? 0)}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {(last?.net ?? 0) >= 0
              ? `You saved ${fmtMoney(last?.net ?? 0)} this month after expenses.`
              : "Negative net — revisit Budget and Subscriptions to free cash."}
          </p>
        </div>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Trend</h2>
        <div className="mt-6 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }} />
              <Legend />
              <Line type="monotone" dataKey="Income" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Expenses" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Net" stroke="#34d399" strokeWidth={2.5} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <LinkToInvest
        headline="Positive net cash flow → fund Invest"
        body="Use recurring surplus to dollar-cost into research positions — start small and scale with confidence."
      />
    </div>
  );
}
