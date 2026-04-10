import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { Loader2, PieChart as PieChartIcon, Star, X } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../lib/api";
import {
  getWatchlist,
  removeWatchlistSymbol,
} from "../lib/watchlistStorage";

const SECTOR_COLORS = [
  "#34d399",
  "#22d3ee",
  "#a78bfa",
  "#fb7185",
  "#fbbf24",
  "#94a3b8",
  "#2dd4bf",
  "#f472b6",
  "#818cf8",
];

type Quote = {
  symbol?: string;
  price?: number;
  change_percent?: string;
  error?: string;
  kind?: string;
};

type MorningBriefingProps = {
  /** Sits inside another card (e.g. Market Pulse next to portfolio) — no outer glass panel. */
  variant?: "card" | "embedded";
};

export function MorningBriefing({ variant = "card" }: MorningBriefingProps) {
  const { user, isSignedIn } = useUser();
  const uid = user?.id ?? "guest";
  const [symbols, setSymbols] = useState<string[]>(() => getWatchlist(uid));
  const [wq, setWq] = useState<Quote[]>([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [sectorRows, setSectorRows] = useState<{ name: string; value: number }[] | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorHint, setSectorHint] = useState<string | null>(null);

  useEffect(() => {
    setSymbols(getWatchlist(uid));
  }, [uid]);

  useEffect(() => {
    const sync = () => setSymbols(getWatchlist(uid));
    window.addEventListener("finsight-watchlist", sync);
    return () => window.removeEventListener("finsight-watchlist", sync);
  }, [uid]);

  useEffect(() => {
    if (symbols.length === 0) {
      setWq([]);
      return;
    }
    let cancelled = false;
    setWatchLoading(true);
    api
      .marketPrices(symbols.join(","))
      .then((raw) => {
        if (cancelled) return;
        setWq(((raw as { quotes?: Quote[] }).quotes ?? []).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setWq([]);
      })
      .finally(() => {
        if (!cancelled) setWatchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbols]);

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      setSectorRows(null);
      setSectorHint(null);
      return;
    }
    let cancelled = false;
    setSectorLoading(true);
    setSectorHint(null);
    (async () => {
      try {
        const snap = (await api.holdingsSnapshot(user.id)) as {
          positions?: { symbol?: string; market_value?: number }[];
        };
        const positions = (snap.positions ?? []).filter(
          (p) => p.market_value != null && Number(p.market_value) > 0,
        );
        if (positions.length === 0) {
          if (!cancelled) {
            setSectorRows(null);
            setSectorHint("Add positions under My portfolio to see sector mix.");
          }
          return;
        }
        const sectors: Record<string, number> = {};
        await Promise.all(
          positions.map(async (p) => {
            const sym = String(p.symbol ?? "").toUpperCase();
            const mv = Number(p.market_value);
            try {
              const info = (await api.stockInfo(sym)) as { sector?: string };
              const sec = (info.sector ?? "Other").trim() || "Other";
              sectors[sec] = (sectors[sec] ?? 0) + mv;
            } catch {
              sectors["Other"] = (sectors["Other"] ?? 0) + mv;
            }
          }),
        );
        if (cancelled) return;
        const rows = Object.entries(sectors)
          .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
          .sort((a, b) => b.value - a.value);
        setSectorRows(rows);
      } catch {
        if (!cancelled) {
          setSectorRows(null);
          setSectorHint("Could not load holdings.");
        }
      } finally {
        if (!cancelled) setSectorLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user?.id]);

  const sectorTotal = useMemo(
    () => (sectorRows ?? []).reduce((s, r) => s + r.value, 0),
    [sectorRows],
  );

  function onRemove(sym: string) {
    setSymbols(removeWatchlistSymbol(uid, sym));
  }

  const headerBlock =
    variant === "embedded" ? (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Watchlist &amp; sector mix
            </h2>
          </div>
          <Link
            to="/portfolio"
            className="text-xs font-semibold text-amber-500/90 underline-offset-2 hover:underline"
          >
            Edit holdings
          </Link>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Use <span className="font-medium text-zinc-400">Watchlist</span> in the search bar above. Pie chart uses your
          saved positions and Yahoo sectors.
        </p>
      </>
    ) : (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500/90">
            Morning glance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">Watchlist & portfolio mix</h2>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            Saved from the ticker search on Market Pulse. Sector split uses your real holdings and Yahoo
            sectors.
          </p>
        </div>
        <Link
          to="/portfolio"
          className="text-xs font-medium text-emerald-400/90 underline-offset-2 hover:underline"
        >
          Edit holdings →
        </Link>
      </div>
    );

  const inner = (
    <>
      {headerBlock}

      <div className={`grid gap-6 lg:grid-cols-2 ${variant === "embedded" ? "mt-4" : "mt-5"}`}>
        <div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Watchlist</h3>
          </div>
          {watchLoading && symbols.length > 0 ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading quotes…
            </p>
          ) : symbols.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Add tickers from the search bar at the top — press{" "}
              <span className="font-medium text-zinc-400">Watchlist</span>.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {symbols.map((sym) => {
                const q = wq.find((x) => (x.symbol ?? "").toUpperCase() === sym);
                const ch = q?.change_percent;
                const up =
                  ch != null && ch !== ""
                    ? !String(ch).trim().startsWith("-")
                    : null;
                return (
                  <li
                    key={sym}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-100">{sym}</span>
                      {ch != null && ch !== "" ? (
                        <span
                          className={`ml-2 text-xs tabular-nums ${
                            up === true ? "text-emerald-400" : up === false ? "text-rose-400" : "text-zinc-500"
                          }`}
                        >
                          {ch}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-zinc-200">
                        {q?.error || typeof q?.price !== "number"
                          ? "—"
                          : q.kind === "fx"
                            ? q.price.toFixed(sym.includes("JPY") ? 2 : 4)
                            : `$${q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemove(sym)}
                        className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        aria-label={`Remove ${sym}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-sky-400/90" />
            <h3 className="text-sm font-semibold text-zinc-200">Portfolio by sector</h3>
          </div>
          {!isSignedIn ? (
            <p className="mt-3 text-sm text-zinc-500">Sign in to map your holdings to sectors.</p>
          ) : sectorLoading ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building sector mix…
            </p>
          ) : sectorHint ? (
            <p className="mt-3 text-sm text-zinc-500">{sectorHint}</p>
          ) : sectorRows && sectorRows.length > 0 ? (
            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="h-[200px] w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorRows}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {sectorRows.map((_, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => {
                        const pct =
                          sectorTotal > 0 ? ((value / sectorTotal) * 100).toFixed(1) : "—";
                        return [`$${Number(value).toLocaleString()} (${pct}%)`, "Weight"];
                      }}
                      labelFormatter={(_, p) => {
                        const row = p?.[0]?.payload as { name?: string } | undefined;
                        return row?.name ?? "";
                      }}
                      contentStyle={{
                        background: "rgba(9,9,11,0.95)",
                        border: "1px solid rgba(63,63,70,0.8)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full flex-1 space-y-1.5 text-xs">
                {sectorRows.map((r, i) => (
                  <li key={r.name} className="flex justify-between gap-2 text-zinc-400">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                      />
                      {r.name}
                    </span>
                    <span className="tabular-nums text-zinc-300">
                      {sectorTotal > 0 ? ((r.value / sectorTotal) * 100).toFixed(1) : "—"}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No sector data.</p>
          )}
        </div>
      </div>
    </>
  );

  if (variant === "embedded") {
    return (
      <div id="morning-briefing" className="mt-6 border-t border-zinc-800 pt-5">
        {inner}
      </div>
    );
  }

  return (
    <section id="morning-briefing" className="glass scroll-mt-24 rounded-2xl p-5 sm:p-6">
      {inner}
    </section>
  );
}
