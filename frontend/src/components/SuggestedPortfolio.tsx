import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Loader2, PieChart } from "lucide-react";
import { api } from "../lib/api";
import {
  FINHACK_INVESTMENT_PREFS_KEY,
  parseInvestmentPrefs,
  RISK_OPTIONS,
  STYLE_OPTIONS,
} from "../lib/investmentPreferences";
import { suggestedHoldings } from "../lib/suggestedHoldings";
import {
  closesFromBars,
  sharpeAnnualizedFromDailyCloses,
  totalReturnPct,
} from "../lib/returnsMetrics";

type MetricRow = {
  symbol: string;
  price: number | null;
  ret1y: number | null;
  ret5y: number | null;
  sharpe: number | null;
  err?: string;
};

function fmtPct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtSharpe(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

export function SuggestedPortfolio() {
  const { user, isLoaded } = useUser();
  const prefs = useMemo(() => {
    const raw = user?.unsafeMetadata?.[FINHACK_INVESTMENT_PREFS_KEY];
    return parseInvestmentPrefs(raw);
  }, [user?.unsafeMetadata]);

  const symbols = useMemo(
    () => suggestedHoldings(prefs.riskTolerance, prefs.styles),
    [prefs.riskTolerance, prefs.styles],
  );

  const [capitalStr, setCapitalStr] = useState("10000");
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loadGen = useRef(0);

  useEffect(() => {
    if (!isLoaded || symbols.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const id = ++loadGen.current;
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        symbols.map(async (sym): Promise<MetricRow> => {
          try {
            const [h1y, h5y, q] = await Promise.all([
              api.marketHistory(sym, "1y", "1d"),
              api.marketHistory(sym, "5y", "1d"),
              api.marketPrice(sym),
            ]);
            const bars1 = (h1y as { bars?: unknown }).bars;
            const bars5 = (h5y as { bars?: unknown }).bars;
            const c1 = closesFromBars(bars1);
            const c5 = closesFromBars(bars5);
            const pr = (q as { price?: number }).price;
            const price =
              typeof pr === "number" && Number.isFinite(pr) && pr > 0 ? pr : null;
            return {
              symbol: sym,
              price,
              ret1y: totalReturnPct(c1),
              ret5y: totalReturnPct(c5),
              sharpe: sharpeAnnualizedFromDailyCloses(c1),
            };
          } catch {
            return {
              symbol: sym,
              price: null,
              ret1y: null,
              ret5y: null,
              sharpe: null,
              err: "Unavailable",
            };
          }
        }),
      );
      if (loadGen.current !== id) return;
      setRows(results);
      setLoading(false);
    })();
  }, [isLoaded, symbols]);

  const capital = Math.max(
    0,
    parseFloat(String(capitalStr).replace(/,/g, "")) || 0,
  );
  const weightEach = rows.length > 0 ? 1 / rows.length : 0;
  const riskLabel =
    RISK_OPTIONS.find((r) => r.id === prefs.riskTolerance)?.label ?? "Not set (using moderate-style mix)";

  if (!isLoaded) {
    return (
      <section className="glass rounded-2xl border border-emerald-500/20 p-5 dark:border-emerald-500/15">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl border border-emerald-500/25 p-5 dark:border-emerald-500/15">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30">
          <PieChart className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Suggested portfolio</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Illustrative mix from your{" "}
            <Link
              to="/settings"
              className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
            >
              Settings
            </Link>{" "}
            risk profile and style tags — not a recommendation to buy or sell. Metrics use public price history
            (approximate Sharpe from daily log returns; past performance does not predict future results).
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Profile: <span className="font-medium text-zinc-700 dark:text-zinc-300">{riskLabel}</span>
            {prefs.styles.length > 0 ? (
              <>
                {" "}
                · Styles:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {prefs.styles
                    .map((id) => STYLE_OPTIONS.find((s) => s.id === id)?.label ?? id)
                    .join(", ")}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="suggested-capital" className="text-[11px] font-medium uppercase text-zinc-500">
            Capital to allocate (USD)
          </label>
          <input
            id="suggested-capital"
            type="text"
            inputMode="decimal"
            className="mt-1 w-48 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            value={capitalStr}
            onChange={(e) => setCapitalStr(e.target.value)}
            placeholder="10000"
          />
        </div>
        {capital > 0 && rows.length > 0 && !loading ? (
          <p className="text-xs text-zinc-500">
            Equal weight ~{(weightEach * 100).toFixed(0)}% per name ({rows.length} holdings).
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading quotes and history…
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-100/80 text-[11px] uppercase text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Symbol</th>
                <th className="px-3 py-2.5 font-medium tabular-nums">1Y return</th>
                <th className="px-3 py-2.5 font-medium tabular-nums">5Y return</th>
                <th className="px-3 py-2.5 font-medium tabular-nums">Sharpe (1Y)</th>
                <th className="px-3 py-2.5 font-medium tabular-nums">Price</th>
                <th className="px-3 py-2.5 font-medium tabular-nums">$ alloc</th>
                <th className="px-3 py-2.5 font-medium tabular-nums">Shares (indicative)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/80">
              {rows.map((r) => {
                const alloc = capital > 0 ? capital * weightEach : 0;
                const shares =
                  r.price != null && r.price > 0 && alloc > 0 ? alloc / r.price : null;
                return (
                  <tr key={r.symbol} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-3 py-2.5 font-semibold tracking-wide">{r.symbol}</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {r.err ? "—" : fmtPct(r.ret1y)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {r.err ? "—" : fmtPct(r.ret5y)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {r.err ? "—" : fmtSharpe(r.sharpe)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {alloc > 0 ? `$${alloc.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-emerald-700 dark:text-emerald-400">
                      {shares != null ? shares.toFixed(4) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Share counts = (capital × weight) ÷ last price; rounding and fees apply in real accounts. Update risk and
        styles in Settings to refresh this list.
      </p>
    </section>
  );
}
