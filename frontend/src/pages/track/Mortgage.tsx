import { useMemo } from "react";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import { amortizeWithExtra, mortgageMonthlyPI } from "../../lib/trackFinance";
import { TrackPageHeader, fmtMoney } from "./trackUtils";

export function TrackMortgage() {
  const { state, setMortgage } = useTrackFinance();
  const { principal, annualRatePct, termYears, extraMonthlyPrincipal } = state.mortgage;

  const pi = useMemo(
    () => mortgageMonthlyPI(principal, annualRatePct, termYears),
    [principal, annualRatePct, termYears],
  );

  const r = annualRatePct / 100 / 12;
  const firstInterest = principal * r;
  const firstPrincipal = Math.max(0, pi - firstInterest);

  const baseline = useMemo(
    () => amortizeWithExtra(principal, annualRatePct, pi, 0),
    [principal, annualRatePct, pi],
  );
  const withExtra = useMemo(
    () => amortizeWithExtra(principal, annualRatePct, pi, extraMonthlyPrincipal),
    [principal, annualRatePct, pi, extraMonthlyPrincipal],
  );

  const interestSaved = baseline.totalInterest - withExtra.totalInterest;
  const monthsSaved = baseline.months - withExtra.months;

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Mortgage"
        title="Payment breakdown & extra principal"
        subtitle="Standard amortization math (not a lender quote). Use it to see how additional payments change interest and payoff time."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Loan inputs</h2>
          <label className="block text-sm text-zinc-400">
            Principal balance
            <input
              type="number"
              min={0}
              step={1000}
              value={principal}
              onChange={(e) => setMortgage({ principal: Number(e.target.value) || 0 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            APR (%)
            <input
              type="number"
              min={0}
              step={0.125}
              value={annualRatePct}
              onChange={(e) => setMortgage({ annualRatePct: Number(e.target.value) || 0 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Term (years)
            <input
              type="number"
              min={1}
              max={40}
              value={termYears}
              onChange={(e) => setMortgage({ termYears: Number(e.target.value) || 1 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Extra principal / month
            <input
              type="number"
              min={0}
              step={50}
              value={extraMonthlyPrincipal}
              onChange={(e) => setMortgage({ extraMonthlyPrincipal: Number(e.target.value) || 0 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
        </section>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">This month’s split (P&amp;I)</h2>
          <p className="text-3xl font-semibold tabular-nums text-zinc-100">{fmtMoney(pi, 2)}</p>
          <p className="text-sm text-zinc-400">Scheduled principal + interest (taxes/insurance not modeled).</p>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex justify-between border-b border-zinc-800 py-2">
              <span>Principal</span>
              <span className="tabular-nums font-medium text-emerald-400">{fmtMoney(firstPrincipal, 2)}</span>
            </li>
            <li className="flex justify-between py-2">
              <span>Interest</span>
              <span className="tabular-nums font-medium text-amber-200/90">{fmtMoney(firstInterest, 2)}</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Lifetime interest & payoff</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs text-zinc-500">Baseline interest</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-200">{fmtMoney(baseline.totalInterest, 0)}</p>
            <p className="text-xs text-zinc-500">{baseline.months} payments</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs text-zinc-500">With extra payment</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">{fmtMoney(withExtra.totalInterest, 0)}</p>
            <p className="text-xs text-zinc-500">{withExtra.months} payments</p>
          </div>
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase text-emerald-400/90">Extra impact</p>
            <p className="mt-2 text-sm text-zinc-200">
              Paying an extra {fmtMoney(extraMonthlyPrincipal)}/mo saves roughly{" "}
              <span className="font-semibold text-emerald-300">{fmtMoney(Math.max(0, interestSaved), 0)}</span> in
              interest and cuts about{" "}
              <span className="font-semibold text-emerald-300">{Math.max(0, monthsSaved)}</span> payments.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
