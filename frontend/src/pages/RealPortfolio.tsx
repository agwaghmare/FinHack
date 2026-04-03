import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../lib/api";

type PositionRow = {
  symbol: string;
  shares: number;
  avg_cost: number;
  opened_at: string;
  last_price: number | null;
  cost_basis: number;
  market_value: number | null;
  unrealized_pl: number | null;
  unrealized_pl_pct: number | null;
};

type Snapshot = {
  positions: PositionRow[];
  pricing_complete?: boolean;
  totals: {
    cost_basis: number;
    market_value: number;
    unrealized_pl: number;
    total_return_pct: number | null;
    cagr_pct: number | null;
  };
};

export function RealPortfolio() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? "";
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setErr(null);
    try {
      const s = (await api.holdingsSnapshot(userId)) as Snapshot;
      setSnap(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load portfolio");
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isLoaded || !userId) {
      setLoading(false);
      return;
    }
    refresh();
  }, [isLoaded, userId, refresh]);

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const sh = parseFloat(shares);
    const ac = parseFloat(avgCost);
    if (!symbol.trim() || Number.isNaN(sh) || sh <= 0 || Number.isNaN(ac) || ac <= 0) return;
    setSaving(true);
    setErr(null);
    try {
      await api.holdingsAdd(userId, {
        symbol: symbol.trim().toUpperCase(),
        shares: sh,
        avg_cost: ac,
        opened_at: openedAt.trim() || undefined,
      });
      setSymbol("");
      setShares("");
      setAvgCost("");
      setOpenedAt("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Add failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(sym: string) {
    if (!userId) return;
    if (!confirm(`Remove ${sym} from your real portfolio?`)) return;
    setSaving(true);
    try {
      await api.holdingsRemove(userId, sym);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  const t = snap?.totals;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Real money
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              My portfolio
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Add positions (shares & average cost). We value them with live quotes and show
              unrealized P&amp;L, total return, and CAGR anchored to your earliest purchase date.
            </p>
          </div>
        </div>
      </header>

      {err && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-2 text-sm text-amber-800 dark:text-amber-100">
          {err}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Market value"
          value={
            t
              ? `$${t.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"
          }
        />
        <Kpi
          label="Cost basis"
          value={
            t ? `$${t.cost_basis.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"
          }
        />
        <Kpi
          label="Total return"
          value={
            t?.total_return_pct != null ? `${t.total_return_pct >= 0 ? "+" : ""}${t.total_return_pct.toFixed(2)}%` : "—"
          }
          hint={snap?.pricing_complete === false ? "Incomplete quotes" : undefined}
        />
        <Kpi
          label="CAGR"
          value={t?.cagr_pct != null ? `${t.cagr_pct >= 0 ? "+" : ""}${t.cagr_pct.toFixed(2)}%` : "—"}
          hint="Since earliest lot date"
        />
      </section>

      {snap?.pricing_complete === false && (
        <p className="text-xs text-amber-600 dark:text-amber-300">
          Some tickers did not return a price — return and CAGR require a full quote set. Check
          symbols or try again in a moment.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <form
          onSubmit={addHolding}
          className="glass rounded-2xl border border-zinc-200/60 p-5 dark:border-zinc-800/80 lg:col-span-2"
        >
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add holding</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Merging the same symbol averages cost and keeps the earlier purchase date for CAGR.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium uppercase text-zinc-500">Symbol</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="AAPL"
                maxLength={12}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium uppercase text-zinc-500">Shares</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="10"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase text-zinc-500">
                  Avg cost ($)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  placeholder="180.50"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase text-zinc-500">
                First buy date (optional)
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Add to portfolio"}
          </button>
        </form>

        <div className="glass rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 lg:col-span-3">
          <div className="border-b border-zinc-200/60 px-5 py-4 dark:border-zinc-800/80">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Holdings</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading positions…
            </div>
          ) : !snap?.positions?.length ? (
            <p className="px-5 py-12 text-center text-sm text-zinc-500">
              No positions yet. Add your first stock on the left.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium tabular-nums">Shares</th>
                    <th className="px-4 py-3 font-medium tabular-nums">Avg cost</th>
                    <th className="px-4 py-3 font-medium tabular-nums">Last</th>
                    <th className="px-4 py-3 font-medium tabular-nums">Value</th>
                    <th className="px-4 py-3 font-medium tabular-nums">P&amp;L</th>
                    <th className="px-4 py-3 font-medium">Since</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/80">
                  {snap.positions.map((p) => (
                    <tr key={p.symbol} className="text-zinc-700 dark:text-zinc-200">
                      <td className="px-4 py-3 font-medium">{p.symbol}</td>
                      <td className="px-4 py-3 tabular-nums">{p.shares}</td>
                      <td className="px-4 py-3 tabular-nums">${p.avg_cost.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {p.last_price != null ? `$${p.last_price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {p.market_value != null
                          ? `$${p.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums ${
                          p.unrealized_pl != null && p.unrealized_pl >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {p.unrealized_pl != null && p.unrealized_pl_pct != null
                          ? `${p.unrealized_pl >= 0 ? "+" : ""}$${Math.abs(p.unrealized_pl).toFixed(0)} (${p.unrealized_pl_pct >= 0 ? "+" : ""}${p.unrealized_pl_pct.toFixed(1)}%)`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{p.opened_at}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => remove(p.symbol)}
                          disabled={saving}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-rose-500 disabled:opacity-50"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <section className="glass rounded-2xl border border-zinc-200/60 p-6 dark:border-zinc-800/80">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Connect your broker</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Securely connect brokerage accounts to sync holdings, balances, and trade history. (Planned
          integrations — buttons are placeholders until OAuth is wired.)
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Alpaca", "Robinhood", "Interactive Brokers", "Charles Schwab", "TD Ameritrade"].map(
            (broker) => (
              <button
                key={broker}
                type="button"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
              >
                Connect {broker}
              </button>
            ),
          )}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Data is stored in-memory on the API host for this demo (resets on restart). Quotes are
        indicative and may be delayed — not investment advice.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl border border-zinc-200/60 p-4 dark:border-zinc-800/80">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}
