import { useEffect, useMemo, useState } from "react";
import { Gem, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { WhyMattersButton } from "../components/WhyMattersSheet";

type Quote = { kind?: string; symbol?: string; price?: number; error?: string; change_percent?: string };

const ETF_AG = ["GLD", "SLV", "DBA", "USO", "CORN", "WEAT"];

export function CommodityLens() {
  const [macro, setMacro] = useState<{ cpi?: number; rates?: number; gdp?: number } | null>(
    null,
  );
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [oilShock, setOilShock] = useState(0);
  const [usdShock, setUsdShock] = useState(0);
  const [ratesShock, setRatesShock] = useState(0);
  const [chainHeadline, setChainHeadline] = useState<string | null>(null);

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
      } catch {
        if (!cancelled) {
          setMacro({ cpi: 320.5, rates: 4.33, gdp: 29000 });
          setQuotes([]);
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

  const wti = quotes.find((q) => (q.symbol ?? "").includes("WTI") || q.kind === "commodity");
  const baseOil = typeof wti?.price === "number" ? wti.price : 75;

  const scenario = useMemo(() => {
    const oilFactor = 1 + oilShock / 100;
    const stressedOil = baseOil * oilFactor;
    const usdFactor = 1 - usdShock / 400;
    const ratesBps = ratesShock;
    const energyBeta = 0.38;
    const usdCommodityBeta = -0.22;
    const ratesDrag = ratesBps * -0.00015;
    const macroRates = macro?.rates != null && macro.rates > 4 ? -0.015 : 0;
    const portfolioProxy =
      100 *
      (1 +
        energyBeta * (oilFactor - 1) +
        usdCommodityBeta * (usdFactor - 1) +
        ratesDrag +
        macroRates);
    const agProxy = 100 * (1 + (oilFactor - 1) * 0.12 + usdCommodityBeta * (usdFactor - 1) * 0.8);
    return { stressedOil, portfolioProxy, agProxy };
  }, [baseOil, oilShock, usdShock, ratesShock, macro?.rates]);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Commodity lens
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Macro & hard assets
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          CPI, Fed funds, and GDP (FRED) live here with oil, metals, ag proxies, and G10 FX — moved from
          Market Pulse so the tape page stays focused on equities and crypto. Stress sliders mimic how
          desks think about USD and policy alongside energy.
        </p>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lens…
        </div>
      )}

      <section className="glass scroll-mt-24 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Gem className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Chain reactions</h2>
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
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {chainHeadline ??
            "Example: oil down → ethanol economics shift → corn and soy complex reprices; fertilizer and logistics can amplify soy even when crude is soft."}
        </p>
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

      <section id="scenario" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Multi-factor simulation
        </h2>
        <p className="text-sm text-zinc-500">
          Illustrative stress: oil (%), USD strength (rank), policy rate shock (bp). Not a model of your
          book — a teaching layer for cross-asset intuition.
        </p>
        <div className="glass max-w-2xl rounded-2xl p-6 space-y-6">
          <label className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Oil shock (%)
            </span>
            <input
              type="range"
              min={-30}
              max={40}
              value={oilShock}
              onChange={(e) => setOilShock(Number(e.target.value))}
              className="w-full accent-zinc-400"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>-30%</span>
              <span>+40%</span>
            </div>
          </label>
          <label className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              USD strength shock (rank units)
            </span>
            <input
              type="range"
              min={-20}
              max={20}
              value={usdShock}
              onChange={(e) => setUsdShock(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Weaker USD</span>
              <span>Stronger USD</span>
            </div>
          </label>
          <label className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Policy rate shock (basis points, drag)
            </span>
            <input
              type="range"
              min={-50}
              max={100}
              value={ratesShock}
              onChange={(e) => setRatesShock(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>-50 bp</span>
              <span>+100 bp</span>
            </div>
          </label>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500">Stressed WTI</dt>
              <dd className="mt-1 font-semibold tabular-nums text-white">
                ${scenario.stressedOil.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Energy-heavy book proxy (100)</dt>
              <dd className="mt-1 font-semibold tabular-nums text-white">
                {scenario.portfolioProxy.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Ag/USD-sensitive proxy (100)</dt>
              <dd className="mt-1 font-semibold tabular-nums text-white">
                {scenario.agProxy.toFixed(1)}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Proxies: {ETF_AG.join(", ")} — corn and soybeans often trade via futures or sector ETFs;
            ethanol linkage is one channel among many.
          </p>
        </div>
      </section>
    </div>
  );
}
