import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useTrackFinance } from "../../context/TrackFinanceContext";
import { api } from "../../lib/api";
import { currentYearMonth, totalOutflowInMonth, whatIfInvestMonthly } from "../../lib/trackFinance";
import {
  cagrFromPrices,
  normalizeBars,
  periodForHistoryYears,
  priceAnchors,
  yearsBetweenDates,
} from "./whatIfPortfolioMath";
import { LinkToInvest, TrackPageHeader, fmtMoney } from "./trackUtils";

type StockBacktestResult = {
  symbol: string;
  valueNow: number;
  totalReturnPct: number;
  cagrPct: number | null;
  start: { price: number; date: string };
  end: { price: number; date: string };
  partialHistory: boolean;
  elapsedYears: number;
};

type HoldingRow = {
  symbol: string;
  weight: number;
  marketValue: number;
  cagrPct: number | null;
  partialHistory: boolean;
  error?: string;
};

export function TrackWhatIf() {
  const { state } = useTrackFinance();
  const ym = currentYearMonth();
  const outflow = totalOutflowInMonth(state, ym);
  const surplus = Math.max(0, state.monthlyIncome - outflow);

  const [cut, setCut] = useState(200);
  const [returnPct, setReturnPct] = useState(7);
  const [years, setYears] = useState(5);

  const fv = whatIfInvestMonthly(cut, returnPct, years);

  return (
    <div className="space-y-10">
      <TrackPageHeader
        eyebrow="Track · Simulator"
        title="What-if: spending → investing"
        subtitle="Illustrative math only — not a forecast or investment advice."
      />

      <section className="glass rounded-2xl p-6">
        <p className="text-sm text-zinc-400">
          This month’s outflow is about <span className="font-semibold text-zinc-200">{fmtMoney(outflow)}</span> vs
          income <span className="font-semibold text-zinc-200">{fmtMoney(state.monthlyIncome)}</span>.{" "}
          {surplus > 0 ? (
            <>Surplus ~{fmtMoney(surplus)} — you could model investing part of it below.</>
          ) : (
            <>No surplus in the demo month until you cut categories or raise income in Track.</>
          )}
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <label className="text-sm text-zinc-400">
            Reduce spending by / month
            <input
              type="range"
              min={0}
              max={1500}
              step={25}
              value={cut}
              onChange={(e) => setCut(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 tabular-nums text-zinc-200">{fmtMoney(cut)}</p>
          </label>
          <label className="text-sm text-zinc-400">
            Assumed annual return (%)
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={returnPct}
              onChange={(e) => setReturnPct(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 tabular-nums text-zinc-200">{returnPct}%</p>
          </label>
          <label className="text-sm text-zinc-400">
            Years invested
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 tabular-nums text-zinc-200">{years} years</p>
          </label>
        </div>

        <div className="mt-8 rounded-2xl border border-sky-900/50 bg-sky-950/30 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">Result</p>
          <p className="mt-3 text-2xl font-semibold text-zinc-100">
            If you invest <span className="text-sky-300">{fmtMoney(cut)}</span>/mo at{" "}
            <span className="text-sky-300">{returnPct}%</span> for{" "}
            <span className="text-sky-300">{years}</span> years → ~{" "}
            <span className="text-sky-200">{fmtMoney(fv, 0)}</span>
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Reducing dining 10% or dropping one subscription often yields $50–150/mo — plug your real number above.
          </p>
        </div>
      </section>

      <StockBacktestSection />

      <PortfolioCompoundSection />

      <LinkToInvest
        headline="Turn the simulated contribution real"
        body="Use My portfolio to align actual savings with your research views once emergency cash is covered."
      />
    </div>
  );
}

function StockBacktestSection() {
  const [symbol, setSymbol] = useState("AAPL");
  const [yearsBack, setYearsBack] = useState(5);
  const [initialUsd, setInitialUsd] = useState(10_000);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<StockBacktestResult | null>(null);

  const run = useCallback(async () => {
    const sym = symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!sym) {
      setErr("Enter a ticker.");
      return;
    }
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const period = periodForHistoryYears(yearsBack);
      const raw = await api.marketHistory(sym, period, "1d");
      const bars = normalizeBars(raw);
      const ax = priceAnchors(bars, yearsBack);
      if (!ax) {
        setErr("Not enough price history for that symbol.");
        return;
      }
      const elapsed = yearsBetweenDates(ax.start.date, ax.end.date);
      const mult = ax.end.price / ax.start.price;
      const valueNow = initialUsd * mult;
      const totalReturnPct = (mult - 1) * 100;
      const cagr = cagrFromPrices(ax.start.price, ax.end.price, elapsed);
      setResult({
        symbol: sym,
        valueNow,
        totalReturnPct,
        cagrPct: cagr != null ? cagr * 100 : null,
        start: ax.start,
        end: ax.end,
        partialHistory: ax.partialHistory,
        elapsedYears: elapsed,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }, [symbol, yearsBack, initialUsd]);

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Single stock: “what if I’d invested years ago?”</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Uses daily closes from the API (Yahoo via backend). Growth is measured from the anchor date through the latest
        bar — not a guarantee of future results.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="text-sm text-zinc-400">
          Ticker
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="mt-1 block w-36 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 uppercase text-zinc-100"
            maxLength={12}
          />
        </label>
        <label className="text-sm text-zinc-400">
          Years back
          <input
            type="range"
            min={1}
            max={20}
            value={yearsBack}
            onChange={(e) => setYearsBack(Number(e.target.value))}
            className="mt-1 block w-48"
          />
          <span className="mt-1 block text-xs text-zinc-500">{yearsBack} yr</span>
        </label>
        <label className="text-sm text-zinc-400">
          Amount invested then
          <input
            type="number"
            min={1}
            step={100}
            value={initialUsd}
            onChange={(e) => setInitialUsd(Number(e.target.value) || 0)}
            className="mt-1 block w-36 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Recalculate
        </button>
      </div>

      {err ? <p className="mt-4 text-sm text-rose-400">{err}</p> : null}
      {!result && !loading && !err ? (
        <p className="mt-4 text-xs text-zinc-500">Click Recalculate to load price history and see a hypothetical value.</p>
      ) : null}

      {result ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500/90">Hypothetical value today</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-300">{fmtMoney(result.valueNow, 0)}</p>
          <p className="mt-2 text-sm text-zinc-400">
            From <span className="text-zinc-200">{fmtMoney(initialUsd, 0)}</span> at{" "}
            <span className="text-zinc-200">{fmtMoney(result.start.price, 2)}</span> on {result.start.date} →{" "}
            <span className="text-zinc-200">{fmtMoney(result.end.price, 2)}</span> on {result.end.date} (
            <span className="text-emerald-400/90">+{result.totalReturnPct.toFixed(1)}%</span> total over{" "}
            {result.elapsedYears.toFixed(1)} yrs
            {result.cagrPct != null ? (
              <>
                , <span className="text-zinc-300">~{result.cagrPct.toFixed(1)}% CAGR</span>
              </>
            ) : null}
            )
          </p>
          {result.partialHistory ? (
            <p className="mt-3 text-xs text-amber-400/90">
              Earliest available price is newer than your target lookback — result uses the oldest bar we have.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PortfolioCompoundSection() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? "";

  const [lookbackYears, setLookbackYears] = useState(5);
  const [futureYears, setFutureYears] = useState(10);
  const [useFixedReturn, setUseFixedReturn] = useState(false);
  const [fixedReturnPct, setFixedReturnPct] = useState(7);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [totalMv, setTotalMv] = useState(0);
  const [rows, setRows] = useState<HoldingRow[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErr(null);
    try {
      const snap = (await api.holdingsSnapshot(userId)) as {
        positions?: Array<{
          symbol?: string;
          market_value?: number | null;
          shares?: number;
          last_price?: number | null;
        }>;
        totals?: { market_value?: number };
      };
      const positions = (snap.positions ?? []).filter((p) => p.symbol);
      const mvTotal =
        typeof snap.totals?.market_value === "number"
          ? snap.totals.market_value
          : positions.reduce((a, p) => {
              const mv =
                typeof p.market_value === "number"
                  ? p.market_value
                  : (p.shares ?? 0) * (p.last_price ?? 0);
              return a + mv;
            }, 0);

      if (mvTotal <= 0 || positions.length === 0) {
        setTotalMv(0);
        setRows([]);
        return;
      }

      const period = periodForHistoryYears(lookbackYears);
      const enriched: HoldingRow[] = await Promise.all(
        positions.map(async (p) => {
          const sym = String(p.symbol).toUpperCase();
          const mv =
            typeof p.market_value === "number"
              ? p.market_value
              : (p.shares ?? 0) * (p.last_price ?? 0);
          const weight = mv / mvTotal;
          try {
            const raw = await api.marketHistory(sym, period, "1d");
            const bars = normalizeBars(raw);
            const ax = priceAnchors(bars, lookbackYears);
            if (!ax) {
              return { symbol: sym, weight, marketValue: mv, cagrPct: null, partialHistory: false, error: "No history" };
            }
            const elapsed = yearsBetweenDates(ax.start.date, ax.end.date);
            const cagr = cagrFromPrices(ax.start.price, ax.end.price, elapsed);
            return {
              symbol: sym,
              weight,
              marketValue: mv,
              cagrPct: cagr != null ? cagr * 100 : null,
              partialHistory: ax.partialHistory,
            };
          } catch {
            return { symbol: sym, weight, marketValue: mv, cagrPct: null, partialHistory: false, error: "Fetch failed" };
          }
        }),
      );

      setTotalMv(mvTotal);
      setRows(enriched);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load portfolio");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId, lookbackYears]);

  useEffect(() => {
    if (isLoaded && userId) void load();
  }, [isLoaded, userId, load]);

  const blendedCagrPct = (() => {
    const valid = rows.filter((r) => r.cagrPct != null && !r.error);
    if (valid.length === 0) return null;
    return valid.reduce((a, r) => a + r.weight * (r.cagrPct as number), 0);
  })();

  const rateForProjection = useFixedReturn
    ? fixedReturnPct / 100
    : blendedCagrPct != null
      ? blendedCagrPct / 100
      : 0;
  const futureValue =
    !useFixedReturn && blendedCagrPct == null
      ? totalMv
      : totalMv * Math.pow(1 + Math.max(-0.5, Math.min(0.5, rateForProjection)), futureYears);

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Your portfolio: compounding (holdings you own now)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        We weight each position by current market value, estimate its CAGR from historical prices over the lookback, then
        blend. Forward value assumes that blended rate repeats — a teaching tool, not a prediction.
      </p>

      {!isLoaded ? (
        <p className="mt-4 text-sm text-zinc-500">Loading account…</p>
      ) : !user ? (
        <p className="mt-4 text-sm text-zinc-400">
          <Link className="font-semibold text-sky-400 underline" to="/sign-in">
            Sign in
          </Link>{" "}
          to load your saved holdings from My portfolio.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-6">
            <label className="text-sm text-zinc-400">
              Historical lookback (per holding)
              <input
                type="range"
                min={1}
                max={15}
                value={lookbackYears}
                onChange={(e) => setLookbackYears(Number(e.target.value))}
                className="mt-1 block w-56"
              />
              <span className="mt-1 block text-xs text-zinc-500">{lookbackYears} yr</span>
            </label>
            <label className="text-sm text-zinc-400">
              Project forward
              <input
                type="range"
                min={1}
                max={30}
                value={futureYears}
                onChange={(e) => setFutureYears(Number(e.target.value))}
                className="mt-1 block w-56"
              />
              <span className="mt-1 block text-xs text-zinc-500">{futureYears} yr</span>
            </label>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={useFixedReturn}
              onChange={(e) => setUseFixedReturn(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Use a fixed expected return instead of blended historical CAGR
          </label>
          {useFixedReturn ? (
            <label className="mt-3 block text-sm text-zinc-400">
              Expected annual return (%)
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={fixedReturnPct}
                onChange={(e) => setFixedReturnPct(Number(e.target.value))}
                className="mt-1 block w-full max-w-xs"
              />
              <span className="mt-1 block text-xs text-zinc-500">{fixedReturnPct}%</span>
            </label>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh holdings & history
            </button>
            <Link className="text-sm font-semibold text-sky-400 underline" to="/invest/portfolio">
              Edit holdings →
            </Link>
          </div>

          {err ? <p className="mt-3 text-sm text-rose-400">{err}</p> : null}

          {loading && rows.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading portfolio…
            </p>
          ) : null}

          {!loading && totalMv <= 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No positions with market value yet. Add tickers under{" "}
              <Link className="text-sky-400 underline" to="/invest/portfolio">
                My portfolio
              </Link>{" "}
              to see blended compounding here.
            </p>
          ) : null}

          {totalMv > 0 ? (
            <>
              <div className="mt-6 rounded-2xl border border-violet-900/40 bg-violet-950/25 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">Portfolio lump sum</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{fmtMoney(totalMv, 0)}</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Blended historical CAGR ({lookbackYears}y window, MV-weighted):{" "}
                  <span className="font-semibold text-zinc-200">
                    {blendedCagrPct != null ? `${blendedCagrPct.toFixed(2)}%` : "—"}
                  </span>
                  {!useFixedReturn && blendedCagrPct == null ? (
                    <span className="text-amber-400/90"> — add symbols with price history.</span>
                  ) : null}
                </p>
                <p className="mt-4 text-sm text-zinc-300">
                  If value compounds at{" "}
                  <span className="font-semibold text-violet-200">
                    {useFixedReturn
                      ? fixedReturnPct.toFixed(2)
                      : blendedCagrPct != null
                        ? blendedCagrPct.toFixed(2)
                        : "0.00"}
                    %
                  </span>{" "}
                  /year for <span className="font-semibold text-violet-200">{futureYears}</span> years (lump sum, no
                  contributions): →{" "}
                  <span className="text-xl font-semibold text-violet-200">{fmtMoney(futureValue, 0)}</span>
                </p>
                {!useFixedReturn && blendedCagrPct == null && totalMv > 0 ? (
                  <p className="mt-3 text-sm text-amber-400/90">
                    Could not compute a blended CAGR — enable “fixed expected return” or ensure each holding has price
                    history.
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-zinc-600">
                  Formula: FV = PV × (1 + r)<sup>n</sup>. Changing lookback changes each holding’s r; “fixed expected
                  return” overrides the blend for the forward illustration.
                </p>
              </div>

              <div className="mt-6 max-h-72 overflow-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-900/95 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2 text-right">Weight</th>
                      <th className="px-3 py-2 text-right">Est. CAGR</th>
                      <th className="px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.symbol} className="border-t border-zinc-800/80">
                        <td className="px-3 py-2 font-medium text-zinc-200">{r.symbol}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                          {(r.weight * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                          {r.cagrPct != null ? `${r.cagrPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-500">
                          {r.error ?? (r.partialHistory ? "Partial history" : "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
