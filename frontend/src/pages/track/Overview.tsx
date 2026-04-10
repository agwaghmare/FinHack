import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import {
  cashFlowSeries,
  categoryTotalsWithRecurring,
  computeFinancialHealthScore,
  currentYearMonth,
  spendingInsights,
  whatIfInvestMonthly,
} from "../../lib/trackFinance";
import { InsightPanel, LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

function shortMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

export function TrackOverview() {
  const { state, setMonthlyIncome, resetToDemo } = useTrackFinance();
  const ym = currentYearMonth();
  const health = computeFinancialHealthScore(state, ym);
  const flow = cashFlowSeries(state, 6);
  const insights = spendingInsights(state, ym);
  const netThisMonth = flow[flow.length - 1]?.net ?? 0;
  const diningActual = categoryTotalsWithRecurring(state, ym).dining;
  const reductionScenario = Math.max(50, diningActual * 0.1);

  const chartData = flow.map((r) => ({
    label: shortMonth(r.month),
    net: Math.round(r.net),
  }));

  const fiveYr = whatIfInvestMonthly(reductionScenario, 7, 5);

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Overview"
        title="Financial health & cash flow"
        subtitle="Control spending and savings before you size investments — scores and insights use your local Track data (demo)."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-2xl p-6 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Health score</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-semibold tabular-nums text-zinc-100">{health.score}</span>
            <span className="pb-2 text-lg text-zinc-500">/100</span>
          </div>
          <p className="mt-2 text-sm font-medium text-emerald-400/90">{health.label}</p>
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-zinc-400">
            {health.factors.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Monthly cash flow</p>
              <p className="mt-1 text-sm text-zinc-400">Income minus spending + subscriptions (last 6 months)</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-zinc-500">This month (net)</p>
              <p className={`text-xl font-semibold tabular-nums ${netThisMonth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {fmtMoney(netThisMonth)}
              </p>
              <p className="text-xs text-zinc-500">
                You saved about {fmtMoney(Math.max(0, netThisMonth))} after outflows — route some to Invest when ready.
              </p>
            </div>
          </div>
          <div className="mt-6 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v: number) => [fmtMoney(v), "Net"]}
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
                />
                <Bar dataKey="net" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InsightPanel title="Spending behavior (rule-based insights)" lines={insights} />
        <div className="space-y-4">
          <section className="glass rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quick inputs</p>
            <label className="mt-4 block text-sm text-zinc-400">
              Monthly take-home (used for % of income)
              <input
                type="number"
                min={0}
                step={100}
                value={state.monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              />
            </label>
          </section>
          <section className="glass rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">What-if (5 years @ 7%)</p>
            <p className="mt-2 text-sm text-zinc-300">
              Reducing dining ~{fmtMoney(reductionScenario)}/mo → portfolio ≈{" "}
              <span className="font-semibold text-sky-300">{fmtMoney(fiveYr)}</span> in five years (illustrative).
            </p>
            <Link
              to="/track/what-if"
              className="mt-3 inline-block text-sm font-semibold text-sky-400 underline-offset-2 hover:underline"
            >
              Open full simulator
            </Link>
          </section>
          <LinkToInvest
            headline={netThisMonth > 0 ? `You have ~${fmtMoney(netThisMonth)} left this month` : "Tight month — still plan the next dollar"}
            body={
              netThisMonth > 300
                ? "Consider moving a slice into long-term investments once your emergency fund is on track."
                : "When cash flow turns positive again, use Invest to put savings to work."
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => resetToDemo()}
          className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        >
          Reset demo Track data
        </button>
        <Link className="rounded-full border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-800" to="/track/spending">
          Spending
        </Link>
        <Link className="rounded-full border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-800" to="/track/budget">
          Budget
        </Link>
        <Link className="rounded-full border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-800" to="/track/cash-flow">
          Cash flow
        </Link>
        <Link className="rounded-full border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-800" to="/track/subscriptions">
          Subscriptions
        </Link>
        <Link className="rounded-full border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-800" to="/track/goals">
          Goals
        </Link>
      </div>
    </div>
  );
}
