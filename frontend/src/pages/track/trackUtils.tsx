import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export function fmtMoney(n: number, digits = 0) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function TrackPageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
      <p className="max-w-2xl text-sm text-zinc-500">{subtitle}</p>
    </header>
  );
}

export function InsightPanel({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section className="glass rounded-2xl border border-emerald-900/30 bg-emerald-950/20 p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400/90">{title}</h2>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-300">
        {lines.map((line) => (
          <li key={line} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LinkToInvest({
  headline,
  body,
  cta = "Open My portfolio",
}: {
  headline: string;
  body: string;
  cta?: string;
}) {
  return (
    <section className="glass rounded-2xl border border-amber-900/40 bg-amber-950/20 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">Track → Invest</p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-100">{headline}</h3>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
      <Link
        to="/invest/portfolio"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
