import { useMemo } from "react";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import { subscriptionsMonthlyTotal, whatIfInvestMonthly } from "../../lib/trackFinance";
import { InsightPanel, LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

export function TrackSubscriptions() {
  const { state, updateSubscription } = useTrackFinance();
  const monthly = subscriptionsMonthlyTotal(state.subscriptions);

  const insightLines = useMemo(() => {
    const n = state.subscriptions.length;
    return [
      `You have ${n} recurring charge${n === 1 ? "" : "s"} costing ~${fmtMoney(monthly)}/month.`,
      n > 4
        ? "Consider canceling one low-use service — small cuts compound when invested."
        : "Review annual plans for apps you use daily; sometimes yearly billing saves ~15%.",
    ];
  }, [state.subscriptions.length, monthly]);

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Subscriptions"
        title="Recurring payments"
        subtitle="List acts as your subscription ledger; amounts roll into category totals and cash flow automatically."
      />

      <section className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-zinc-500">Monthly total (normalized)</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-100">{fmtMoney(monthly)}</p>
          </div>
          <p className="max-w-md text-sm text-zinc-500">
            Annual subscriptions are converted to monthly equivalents for planning. Edit amounts to simulate cancelations.
          </p>
        </div>
        <ul className="mt-6 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {state.subscriptions.map((s) => {
            const equiv = s.cadence === "annual" ? s.amount / 12 : s.amount;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-100">{s.name}</p>
                  <p className="text-xs text-zinc-500">{s.cadence === "annual" ? "Billed yearly" : "Billed monthly"}</p>
                </div>
                <label className="text-xs text-zinc-500">
                  Price
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={s.amount}
                    onChange={(e) => updateSubscription(s.id, { amount: Number(e.target.value) || 0 })}
                    className="ml-2 w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                  />
                </label>
                <span className="text-sm tabular-nums text-zinc-400">≈ {fmtMoney(equiv)}/mo</span>
              </li>
            );
          })}
        </ul>
      </section>

      <InsightPanel title="Subscription insight" lines={insightLines} />

      <LinkToInvest
        headline={`Trim $20/mo → ~${fmtMoney(whatIfInvestMonthly(20, 7, 5))} in 5y @ 7%`}
        body="Redirect freed subscription dollars into your portfolio to tie everyday choices to long-term growth."
        cta="Go to portfolio"
      />
    </div>
  );
}
