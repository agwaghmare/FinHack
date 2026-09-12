import { useEffect, useState } from "react";
import { Gem, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { MacroIndicatorCharts, type MacroHistoryPayload } from "../components/MacroIndicatorCharts";
import { WhyMattersButton } from "../components/WhyMattersSheet";

type Quote = { kind?: string; symbol?: string; price?: number; error?: string; change_percent?: string };

type RegimePayload = {
  regime?: string;
  confidence_pct?: number;
  narrative?: string;
  hmm_regime?: string;
  hmm_confidence?: number;
  rules_regime?: string;
  rules_confidence?: number;
  avg_vix?: number | null;
  fed_rate?: number | null;
  cpi?: number | null;
  unemployment?: number | null;
};

type MacroEventRow = {
  id: string;
  name: string;
  date: string;
  time_hint?: string;
  category?: string;
};

function fmtIsoDateShort(iso: string) {
  try {
    const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function regimeAccent(regime: string | undefined) {
  const r = (regime ?? "").toLowerCase();
  if (r.includes("bull")) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/30";
  if (r.includes("bear")) return "text-rose-400 border-rose-500/40 bg-rose-950/30";
  if (r.includes("side")) return "text-zinc-300 border-zinc-600 bg-zinc-900/50";
  return "text-amber-400 border-amber-500/35 bg-amber-950/25";
}

export function CommodityLens() {
  const [macro, setMacro] = useState<{
    cpi?: number;
    rates?: number;
    gdp?: number;
    unemployment?: number;
    pce?: number;
  } | null>(null);
  const [macroHistory, setMacroHistory] = useState<MacroHistoryPayload | null>(null);
  const [macroHistoryLoading, setMacroHistoryLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [regime, setRegime] = useState<RegimePayload | null>(null);
  const [regimeErr, setRegimeErr] = useState<string | null>(null);
  const [macroCalendar, setMacroCalendar] = useState<MacroEventRow[]>([]);
  const [calendarDisclaimer, setCalendarDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initial = refreshKey === 0;
    if (!initial) {
      setSnapshotRefreshing(true);
      setMacroHistoryLoading(true);
    }
    (async () => {
      try {
        const [m, px, hist, regRaw, calRaw] = await Promise.all([
          api.marketMacro().catch(() => null),
          api.marketPrices("WTI,GLD,SLV,DBA,USO,SPY,EURUSD,USDJPY,GBPUSD").catch(() => ({
            quotes: [] as Quote[],
          })),
          api.macroHistory(1).catch(() => null),
          api.portfolioRegime().catch((e: Error) => {
            setRegimeErr(e.message);
            return null;
          }),
          api.marketMacroEvents(75).catch(() => null),
        ]);
        if (cancelled) return;
        if (regRaw) setRegimeErr(null);
        if (m && typeof m === "object") {
          const mm = m as {
            cpi?: number;
            rates?: number;
            gdp?: number;
            unemployment?: number;
            pce?: number;
          };
          setMacro({
            cpi: mm.cpi,
            rates: mm.rates,
            gdp: mm.gdp,
            unemployment: mm.unemployment,
            pce: mm.pce,
          });
        } else {
          setMacro(null);
        }
        setMacroHistory((hist as MacroHistoryPayload | null) ?? null);
        setQuotes((px as { quotes?: Quote[] }).quotes ?? []);
        setRegime((regRaw as RegimePayload | null) ?? null);
        const ev = (calRaw as { events?: MacroEventRow[]; disclaimer?: string } | null)?.events ?? [];
        setMacroCalendar(ev.slice(0, 10));
        setCalendarDisclaimer((calRaw as { disclaimer?: string } | null)?.disclaimer ?? null);
      } catch {
        if (!cancelled) {
          setMacro(null);
          setQuotes([]);
          setRegime(null);
          setMacroCalendar([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setMacroHistoryLoading(false);
          setSnapshotRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  function refreshSnapshot() {
    setRefreshKey((k) => k + 1);
  }

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

      <section id="live-regime" className="glass scroll-mt-24 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Gem className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Live snapshot</h2>
            <span className="text-[10px] text-zinc-600">
              Regime model + calendar refresh from the API (not static copy).
            </span>
          </div>
          <button
            type="button"
            onClick={refreshSnapshot}
            disabled={snapshotRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            {snapshotRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {regimeErr ? (
              <p className="text-sm text-amber-500/90">{regimeErr}</p>
            ) : regime?.regime ? (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <span
                    className={`inline-flex rounded-xl border px-4 py-2 text-lg font-semibold capitalize tracking-tight ${regimeAccent(regime.regime)}`}
                  >
                    {regime.regime.replace(/-/g, " ")}
                  </span>
                  {typeof regime.confidence_pct === "number" ? (
                    <span className="text-sm text-zinc-500">
                      Confidence ~{regime.confidence_pct}%
                    </span>
                  ) : null}
                </div>
                {regime.narrative ? (
                  <p className="text-sm leading-relaxed text-zinc-300">{regime.narrative}</p>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Narrative appears when <code className="rounded bg-zinc-800 px-1">MISTRAL_API_KEY</code> is set on
                    the API.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                  <div className="rounded-lg glass-inset px-2 py-1.5">
                    <span className="text-zinc-500">HMM</span>
                    <p className="font-medium text-zinc-200">
                      {regime.hmm_regime ?? "—"}
                      {typeof regime.hmm_confidence === "number" ? ` · ${regime.hmm_confidence}%` : ""}
                    </p>
                  </div>
                  <div className="rounded-lg glass-inset px-2 py-1.5">
                    <span className="text-zinc-500">Rules</span>
                    <p className="font-medium text-zinc-200">
                      {regime.rules_regime ?? "—"}
                      {typeof regime.rules_confidence === "number" ? ` · ${regime.rules_confidence}%` : ""}
                    </p>
                  </div>
                  <div className="rounded-lg glass-inset px-2 py-1.5">
                    <span className="text-zinc-500">VIX (avg)</span>
                    <p className="font-medium tabular-nums text-zinc-200">
                      {regime.avg_vix != null ? regime.avg_vix.toFixed(1) : "—"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Regime data unavailable right now.</p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Upcoming releases</p>
            <p className="mt-1 text-xs text-zinc-600">
              Approximate US macro dates — verify on official calendars.
            </p>
            {calendarDisclaimer ? (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{calendarDisclaimer}</p>
            ) : null}
            <ul className="mt-3 max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto pr-1">
              {macroCalendar.length === 0 ? (
                <li className="text-sm text-zinc-500">No calendar rows returned.</li>
              ) : (
                macroCalendar.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-col gap-0.5 rounded-lg glass-inset px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{ev.name}</p>
                      {ev.time_hint ? <p className="text-[11px] text-zinc-500">{ev.time_hint}</p> : null}
                    </div>
                    <div className="shrink-0 text-right text-xs text-zinc-400">
                      <p className="tabular-nums">{fmtIsoDateShort(ev.date)}</p>
                      {ev.category ? (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">{ev.category}</p>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "CPI (index)", value: macro?.cpi?.toFixed(1) ?? "—" },
            { label: "Fed funds %", value: macro?.rates?.toFixed(2) ?? "—" },
            { label: "GDP (Bil. $)", value: macro?.gdp?.toFixed(0) ?? "—" },
            { label: "Unemployment %", value: macro?.unemployment?.toFixed(2) ?? "—" },
            { label: "PCE (Bil. $)", value: macro?.pce?.toFixed(0) ?? "—" },
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

      <section id="macro-trends" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Gem className="h-5 w-5 text-emerald-500/90" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Macro trends (1 year)</h2>
        </div>
        <p className="text-sm text-zinc-500">
          Same FRED indicators as above, shown as trailing one-year series. GDP is quarterly, CPI and
          payroll-related series are monthly — axis spacing is calendar time, not uniform frequency.
        </p>
        <MacroIndicatorCharts data={macroHistory} loading={macroHistoryLoading} />
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
          <p className="text-sm text-zinc-500">
            No live quotes loaded. Prices use <strong className="font-medium text-zinc-600 dark:text-zinc-400">Yahoo Finance</strong> via your API server (yfinance). If this stays empty, check the backend can reach the internet and see server logs; macro numbers above use FRED separately (
            <code className="rounded bg-zinc-800/80 px-1 text-xs">FRED_API_KEY</code>
            ).
          </p>
        )}
      </section>
    </div>
  );
}
