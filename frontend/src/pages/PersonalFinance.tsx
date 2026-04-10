import { PiggyBank } from "lucide-react";

function PersonalFinancePanel({
  title,
  subtitle,
  tips,
}: {
  title: string;
  subtitle: string;
  tips: string[];
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Personal finance</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">{subtitle}</p>
      </header>

      <section className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-emerald-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Starter checklist</h2>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          {tips.map((tip) => (
            <li key={tip} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Spending() {
  return (
    <PersonalFinancePanel
      title="Spending Tracker"
      subtitle="Track where money goes each month so you can spot leaks and free up cash for goals."
      tips={[
        "Split spending into needs, wants, and recurring bills.",
        "Watch top 3 categories by monthly cost.",
        "Set a weekly spend cap for discretionary purchases.",
      ]}
    />
  );
}

export function Budget() {
  return (
    <PersonalFinancePanel
      title="Budget Planner"
      subtitle="Build a realistic monthly plan for income, expenses, emergency savings, and debt payoff."
      tips={[
        "Start with fixed costs, then assign variable spending caps.",
        "Reserve a monthly emergency-fund contribution first.",
        "Review planned vs actual at the end of each month.",
      ]}
    />
  );
}

export function Mortgage() {
  return (
    <PersonalFinancePanel
      title="Mortgage Planner"
      subtitle="Understand payment structure, interest cost, and how extra principal affects payoff time."
      tips={[
        "Track principal, interest, taxes, and insurance separately.",
        "Compare one extra payment per year vs monthly principal add-ons.",
        "Model refinance break-even before changing loans.",
      ]}
    />
  );
}

export function Taxes() {
  return (
    <PersonalFinancePanel
      title="Tax Organizer"
      subtitle="Estimate quarterly obligations, track deductible categories, and avoid end-of-year surprises."
      tips={[
        "Set aside a tax buffer from each paycheck or invoice.",
        "Track deductible expenses with date and category notes.",
        "Review withholding/estimated payments each quarter.",
      ]}
    />
  );
}
