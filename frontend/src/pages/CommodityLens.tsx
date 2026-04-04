import { useEffect, useState } from "react";
import { Gem, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { WhyMattersButton } from "../components/WhyMattersSheet";

type Quote = { kind?: string; symbol?: string; price?: number; error?: string; change_percent?: string };
type CrossAssetPayload = {
  headline?: string;
  ai_narrative?: string;
  chains?: {
    id?: string;
    title?: string;
    when?: string;
    plain?: string;
    links?: { from?: string; direction?: string; to?: string; note?: string }[];
  }[];
};

export function CommodityLens() {
  const [macro, setMacro] = useState<{ cpi?: number; rates?: number; gdp?: number } | null>(
    null,
  );
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainHeadline, setChainHeadline] = useState<string | null>(null);
  const [crossAsset, setCrossAsset] = useState<CrossAssetPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, px, cross] = await Promise.all([
          api.marketMacro(),
          api.marketPrices("WTI,GLD,SLV,DBA,USO,SPY,EURUSD,USDJPY,GBPUSD"),
          api.marketCrossAsset().catch(() => null),
        ]);
        if (cancelled) return;
        const mm = m as { cpi?: number; rates?: number; gdp?: number };
        setMacro({ cpi: mm.cpi, rates: mm.rates, gdp: mm.gdp });
        setQuotes((px as { quotes?: Quote[] }).quotes ?? []);
        const h = (cross as { headline?: string } | null)?.headline;
        setChainHeadline(typeof h === "string" ? h : null);
        setCrossAsset((cross as CrossAssetPayload | null) ?? null);
      } catch {
        if (!cancelled) {
          setMacro({ cpi: 320.5, rates: 4.33, gdp: 29000 });
          setQuotes([]);
          setCrossAsset(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Macro regime
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Macro & hard assets
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          CPI, Fed funds, and GDP (FRED) live here with oil, metals, ag proxies, and G10 FX — moved from
          Market Pulse so the tape page stays focused on equities and crypto. For the interactive stress
          sliders (oil, USD, rates), use the{" "}
          <Link to="/learn#cross-asset-stress" className="text-amber-500/90 underline underline-offset-2">
            Cross-asset stress lab
          </Link>{" "}
          on Learn.
        </p>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lens…
        </div>
      )}

      <section className="glass scroll-mt-24 rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Gem className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Chain reactions</h2>
          <WhyMattersButton
            label="Explain"
            context={{
              kind: "chain",
              label: "Oil ↓ → ethanol ↔ corn/soy",
              value: chainHeadline ?? "",
              user_note:
                "Oil decline can change ethanol blending incentives; ag prices also have their own supply shocks.",
            }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          {chainHeadline ??
            "Example: oil down → ethanol economics shift → corn and soy complex reprices; fertilizer and logistics can amplify soy even when crude is soft."}
        </p>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {(crossAsset?.chains ?? []).slice(0, 4).map((ch) => (
            <div key={ch.id ?? ch.title} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">{ch.title}</p>
              <p className="mt-1 text-[10px] text-zinc-500">{ch.when}</p>
              <p className="mt-2 text-xs text-zinc-400 line-clamp-3">{ch.plain}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="macro-events" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Gem className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Macro events</h2>
        </div>
        <p className="text-sm text-zinc-500">
          CPI, policy rates, and GDP anchor how energy and metals discount growth and inflation.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "CPI (index)", value: macro?.cpi?.toFixed(1) ?? "—" },
            { label: "Fed funds %", value: macro?.rates?.toFixed(2) ?? "—" },
            { label: "GDP (Bil. $)", value: macro?.gdp?.toFixed(0) ?? "—" },
          ].map((x) => (
            <div key={x.label} className="glass rounded-2xl p-5">
              <div className="flex justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{x.label}</p>
                <WhyMattersButton
                  label="?"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-600 p-0 text-[10px] text-zinc-300"
                  context={{ kind: "macro", label: x.label, value: x.value }}
                />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {x.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="prices" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Prices · commodities & FX</h2>
        <p className="text-sm text-zinc-500">
          WTI, metals, agriculture ETF proxies, equity beta, and USD pairs — all via yfinance.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quotes.map((q, i) => {
            const kind =
              q.kind === "fx"
                ? "fx"
                : q.kind === "commodity" || (q.symbol ?? "").includes("WTI")
                  ? "commodity"
                  : "quote";
            const px =
              q.kind === "fx"
                ? typeof q.price === "number"
                  ? q.price.toFixed(4)
                  : "—"
                : typeof q.price === "number"
                  ? `$${q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : "—";
            return (
              <div key={`${q.symbol}-${i}`} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {q.kind ?? "quote"}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">{q.symbol ?? "—"}</p>
                  </div>
                  <WhyMattersButton
                    label="Why?"
                    context={{
                      kind,
                      symbol: q.symbol ?? "",
                      label: q.symbol ?? "Asset",
                      value: `${px}${q.change_percent ? ` · ${q.change_percent}%` : ""}`,
                    }}
                  />
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">
                  {q.error ? "—" : px}
                </p>
                {q.change_percent != null && q.change_percent !== "" && (
                  <p className="mt-1 text-xs text-zinc-500">{q.change_percent}%</p>
                )}
                {q.error && <p className="mt-1 text-[10px] text-amber-500">{q.error}</p>}
              </div>
            );
          })}
        </div>
        {quotes.length === 0 && !loading && (
          <p className="text-sm text-zinc-500">No quotes returned — check API key and symbols.</p>
        )}
      </section>
    </div>
  );
}
