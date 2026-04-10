import { useMemo } from "react";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import { taxEstimateFromProfile } from "../../lib/trackFinance";
import { InsightPanel, TrackPageHeader, fmtMoney } from "./trackUtils";

export function TrackTaxes() {
  const { state, setTax } = useTrackFinance();
  const est = useMemo(() => taxEstimateFromProfile(state.tax), [state.tax]);

  const quarterly = est.federalTax / 4;
  const insight = [
    `Estimated taxable income (after standard deduction & 401k): ${fmtMoney(est.taxableIncome, 0)}.`,
    `Marginal federal bracket (ordinary income, simplified): ${(est.marginalRate * 100).toFixed(0)}%.`,
    `Rough federal income tax (demo brackets): ${fmtMoney(est.federalTax, 0)} — you may owe ~${fmtMoney(quarterly, 0)} per quarter if not withheld.`,
  ];

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Taxes"
        title="Simple federal estimate"
        subtitle="Illustrative U.S. ordinary income brackets only — not tax advice. Add state/local and credits with a CPA."
      />

      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-400">
            Filing status
            <select
              value={state.tax.filingStatus}
              onChange={(e) =>
                setTax({ filingStatus: e.target.value as "single" | "married_joint" })
              }
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            >
              <option value="single">Single</option>
              <option value="married_joint">Married filing jointly</option>
            </select>
          </label>
          <label className="text-sm text-zinc-400">
            Annual gross income
            <input
              type="number"
              min={0}
              step={1000}
              value={state.tax.annualGrossIncome}
              onChange={(e) => setTax({ annualGrossIncome: Number(e.target.value) || 0 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Pre-tax 401(k) / year
            <input
              type="number"
              min={0}
              step={500}
              value={state.tax.pretax401kAnnual}
              onChange={(e) => setTax({ pretax401kAnnual: Number(e.target.value) || 0 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Other deductions / year (itemized etc.)
            <input
              type="number"
              min={0}
              step={100}
              value={state.tax.otherDeductionsAnnual}
              onChange={(e) => setTax({ otherDeductionsAnnual: Number(e.target.value) || 0 })}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Standard deduction</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{fmtMoney(est.standardDeduction, 0)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Taxable income (est.)</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">{fmtMoney(est.taxableIncome, 0)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Federal tax (est.)</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-amber-200/90">{fmtMoney(est.federalTax, 0)}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase text-zinc-500">Effective rate</p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{(est.effectiveRate * 100).toFixed(1)}%</p>
        </div>
      </div>

      <InsightPanel title="Tax insight (educational)" lines={insight} />
    </div>
  );
}
