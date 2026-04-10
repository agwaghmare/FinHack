import { type FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import { LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

export function TrackGoals() {
  const { state, updateGoal, addGoal, removeGoal } = useTrackFinance();

  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("5000");
  const [newCurrent, setNewCurrent] = useState("0");
  const [newMonthly, setNewMonthly] = useState("100");

  function onAddGoal(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    addGoal({
      title,
      targetAmount: Math.max(0, Number.parseFloat(newTarget) || 0),
      currentAmount: Math.max(0, Number.parseFloat(newCurrent) || 0),
      monthlyContribution: Math.max(0, Number.parseFloat(newMonthly) || 0),
    });
    setNewTitle("");
    setNewTarget("5000");
    setNewCurrent("0");
    setNewMonthly("100");
  }

  return (
    <div className="space-y-8">
      <TrackPageHeader
        eyebrow="Track · Goals"
        title="Goal tracking"
        subtitle="Emergency fund, lifestyle goals, and down payments — progress updates stay in your browser until you wire a backend."
      />

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Add your own goal</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Name it, set a target, and track how much you’ve saved and how much you add each month.
        </p>
        <form onSubmit={onAddGoal} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-zinc-500 sm:col-span-2">
            Goal name
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. New laptop, Wedding fund"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
              maxLength={80}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Target amount
            <input
              type="number"
              min={0}
              step={100}
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Saved so far
            <input
              type="number"
              min={0}
              step={50}
              value={newCurrent}
              onChange={(e) => setNewCurrent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Monthly contribution
            <input
              type="number"
              min={0}
              step={25}
              value={newMonthly}
              onChange={(e) => setNewMonthly(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="w-full rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Add goal
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {state.goals.map((g) => {
          const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
          const remaining = Math.max(0, g.targetAmount - g.currentAmount);
          const months =
            g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : null;

          return (
            <section key={g.id} className="glass rounded-2xl p-6">
              <div className="flex items-start justify-between gap-2">
                <label className="min-w-0 flex-1 text-xs text-zinc-500">
                  Name
                  <input
                    value={g.title}
                    onChange={(e) => updateGoal(g.id, { title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-base font-semibold text-zinc-100"
                    maxLength={80}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeGoal(g.id)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                  title="Remove goal"
                  aria-label={`Remove ${g.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {fmtMoney(g.currentAmount)} of {fmtMoney(g.targetAmount)} ({pct.toFixed(0)}%)
              </p>
              {months != null ? (
                <p className="mt-1 text-xs text-zinc-500">
                  ~{months} month{months === 1 ? "" : "s"} to goal at {fmtMoney(g.monthlyContribution)}/mo
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-zinc-500 sm:col-span-2">
                  Target amount
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={g.targetAmount}
                    onChange={(e) => updateGoal(g.id, { targetAmount: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Saved so far
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={g.currentAmount}
                    onChange={(e) => updateGoal(g.id, { currentAmount: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Monthly contribution
                  <input
                    type="number"
                    min={0}
                    step={25}
                    value={g.monthlyContribution}
                    onChange={(e) => updateGoal(g.id, { monthlyContribution: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>

      <LinkToInvest
        headline="After emergency fund milestones, shift to Invest"
        body="Once cash buffers are funded, recurring contributions can flow into your portfolio for market growth."
      />
    </div>
  );
}
