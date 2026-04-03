import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, LineChart, Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const tiers = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Get oriented without the noise.",
    price: "Free",
    highlights: [
      "Delayed quotes & macro snapshots",
      "Market Pulse overview",
      "Learn Hub starter modules",
    ],
    cta: "Start free",
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "For investors tracking real positions.",
    price: "$12/mo",
    highlights: [
      "Real portfolio tracker (return, CAGR)",
      "Paper Lab + sentiment headlines",
      "Alerts & webhook tests",
    ],
    cta: "Choose Plus",
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "AI co-pilot for sizing and discipline.",
    price: "$29/mo",
    highlights: [
      "Gemini-powered insights & audio briefings",
      "Strategy nudges tied to your holdings",
      "Commodity lens & cross-asset chains",
    ],
    cta: "Go Pro",
  },
];

export function Welcome() {
  const [openTier, setOpenTier] = useState<string | null>("plus");

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-zinc-100">
      <header className="border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 ring-1 ring-white/10">
              <LineChart className="h-4 w-4 text-emerald-300" />
            </div>
            <span className="text-sm font-semibold tracking-tight">FinSight</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/sign-in"
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/sign-up"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100"
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
            Your AI investing co-pilot
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
            See the market clearly, stress-test ideas in Paper Lab, and track{" "}
            <span className="text-zinc-200">real money performance</span> with return and CAGR —
            then let context-aware insights help you stay disciplined.
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
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Sign-in protects your portfolio data. Nothing here is investment advice.
          </p>
        </div>

        <section className="mt-20">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Three ways to use FinSight
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
                    "rounded-2xl border p-5 text-left transition",
                    t.featured
                      ? "border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_32px_rgba(16,185,129,0.08)]"
                      : "border-white/10 bg-zinc-900/40 hover:border-white/20",
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
