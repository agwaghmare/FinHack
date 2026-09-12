import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, LineChart, Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const tiers = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Education-first entry — learn before you size risk.",
    price: "Free",
    highlights: [
      "Market Pulse & Learn Hub (modules, quizzes)",
      "AI tutor when Gemini/OpenAI keys are on the API",
      "Transparent “not advice” framing for inclusion",
    ],
    cta: "Start free",
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "Research habits + real portfolio tracking.",
    price: "$12/mo",
    highlights: [
      "Real portfolio: return, CAGR, AI holdings coach",
      "Insights: news AI, paper-lab strategy, cross-asset chains",
      "Paper Lab, alerts (SMS / email)",
    ],
    cta: "Choose Plus",
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Full AI layer for research velocity.",
    price: "$29/mo",
    highlights: [
      "Gemini/OpenAI pipelines across Insights & Learn",
      "Audio briefings (ElevenLabs when configured)",
      "Macro regime & advanced market context",
    ],
    cta: "Go Pro",
  },
];

export function Welcome() {
  const [openTier, setOpenTier] = useState<string | null>("plus");

  return (
    <div className="dark relative min-h-screen overflow-hidden text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-slate-900 to-black" />
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
      </div>
      <header className="glass border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/30 to-cyan-500/30 ring-1 ring-white/20 backdrop-blur-md">
              <LineChart className="h-4 w-4 text-emerald-300" />
            </div>
            <span className="text-sm font-semibold tracking-tight">FinSight</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/sign-in"
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/sign-up"
              className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-sm transition hover:bg-white"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">
            Welcome to FinSight
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            AI for education, research &amp; your portfolio
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Built around <span className="text-zinc-200">financial education and inclusion</span> (Learn Hub,
            explainers, AI tutor) and <span className="text-zinc-200">investment research &amp; portfolio support</span>{" "}
            (live tape, headline AI, holdings coach) — practical for the AI-in-finance case study: user-centred,
            efficient, with clear limits and no personalized trade instructions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(52,211,153,0.35)] transition hover:bg-emerald-400"
            >
              <Sparkles className="h-4 w-4" />
              Create account
            </Link>
            <Link
              to="/sign-in"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Sign-in protects your portfolio data. Nothing here is investment advice.
          </p>
        </div>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <div className="glass rounded-2xl border-emerald-500/25 p-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
              Financial education &amp; inclusion
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Self-serve modules, quizzes, certificates, and an LLM tutor that answers in plain English — lowering the
              jargon barrier for new investors.
            </p>
          </div>
          <div className="glass rounded-2xl border-cyan-500/25 p-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300/90">
              Investment research &amp; portfolio support
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Market Pulse, AI news summaries, cross-asset reasoning, and a coach on your real holdings — supporting how
              you research and reflect, without placing trades for you.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Plans at a glance
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-xs text-zinc-500">
            Tap a tier to read what&apos;s included. Billing flows are not wired in this demo —
            tiers describe the product story.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {tiers.map((t) => {
              const open = openTier === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenTier(open ? null : t.id)}
                  className={clsx(
                    "glass rounded-2xl p-5 text-left transition",
                    t.featured
                      ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_32px_rgba(16,185,129,0.12)]"
                      : "hover:bg-white/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t.price}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-white">{t.name}</h3>
                      <p className="mt-1 text-xs text-zinc-400">{t.tagline}</p>
                    </div>
                    {open ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                    )}
                  </div>
                  {open && (
                    <ul className="mt-4 space-y-2 border-t border-white/5 pt-4 text-xs text-zinc-300">
                      {t.highlights.map((h) => (
                        <li key={h} className="flex gap-2">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {open && (
                    <div className="mt-4">
                      <Link
                        to="/sign-up"
                        className={clsx(
                          "inline-flex w-full justify-center rounded-xl py-2.5 text-xs font-semibold transition",
                          t.featured
                            ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                            : "bg-white/10 text-white hover:bg-white/15",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.cta}
                      </Link>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
