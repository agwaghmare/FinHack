import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Search, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { ClerkUserGate } from "../components/ClerkUserGate";

const POPULAR_TICKERS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "SPY",
  "QQQ",
  "NFLX",
  "AMD",
  "JPM",
];

const DEMO_AI =
  "Demo mode: set GEMINI_API_KEY for live Gemini summaries. This is placeholder insight text for the hackathon UI.";

function PaperTradingContent({ userId }: { userId: string }) {
  const location = useLocation();
  const [port, setPort] = useState<unknown>(null);
  const [board, setBoard] = useState<{ rows?: unknown[] } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState("SPY");
  const [search, setSearch] = useState("SPY");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [p, l, f] = await Promise.all([
        api.tradePortfolio(userId),
        api.tradeLeaderboard(),
        api.tradeAiFeedback(userId).catch(() => null),
      ]);
      setPort(p);
      setBoard(l as { rows?: unknown[] });
      if (f && typeof f === "object" && "feedback" in f) {
        const fb = (f as { feedback?: unknown }).feedback;
        const raw = typeof fb === "string" ? fb : JSON.stringify(fb ?? f, null, 2);
        setFeedback(
          raw.includes(DEMO_AI)
            ? "AI coaching is in demo mode right now. Once GEMINI_API_KEY is configured, you will see personalized notes about concentration, position sizing, trade frequency, and practical next steps."
            : raw,
        );
      } else {
        setFeedback(f != null ? "AI feedback is temporarily unavailable." : null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [location.hash]);

  async function doSide(side: "buy" | "sell") {
    setBusy(true);
    setErr(null);
    try {
      const fn = side === "buy" ? api.tradeBuy : api.tradeSell;
      await fn({ user_id: userId, symbol: symbol.toUpperCase(), qty });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  const p = (port ?? {}) as {
    source?: string;
    account?: { cash?: string; equity?: string };
    positions?: { symbol?: string; qty?: string; avg_entry_price?: string }[];
    portfolio?: {
      cash?: number;
      equity?: number;
      positions?: { symbol: string; qty: number; avg: number }[];
      points?: number;
    };
  };
  const displayPortfolio = p.portfolio;
  const positions =
    p.source === "alpaca"
      ? (p.positions ?? []).map((x) => ({
          symbol: x.symbol ?? "—",
          qty: Number(x.qty ?? 0),
          avg: Number(x.avg_entry_price ?? 0),
        }))
      : displayPortfolio?.positions ?? [];
  const cash =
    p.source === "alpaca"
      ? Number(p.account?.cash ?? 0)
      : Number(displayPortfolio?.cash ?? 0);
  const equity =
    p.source === "alpaca"
      ? Number(p.account?.equity ?? 0)
      : Number(displayPortfolio?.equity ?? 0);
  const points = displayPortfolio?.points ?? 0;
  const filteredTickers = POPULAR_TICKERS.filter((t) => t.includes(search.toUpperCase())).slice(0, 7);

  return (
    <div className="space-y-8 text-zinc-900 dark:text-zinc-100">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Paper lab
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Sandbox & strategy
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Simulate trades in a risk-free environment. Search any supported ticker and place buy or
          sell orders in one click.
        </p>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading portfolio…
        </div>
      )}
      {err && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-50 px-4 py-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {err}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="pnl" className="glass scroll-mt-24 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Holdings & P&amp;L</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Source: {p.source ?? (loading ? "…" : "sandbox")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Cash</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                ${cash.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Equity</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                ${equity.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Points</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {points}
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-zinc-500" colSpan={3}>
                      No positions yet. Place your first trade in the panel.
                    </td>
                  </tr>
                ) : (
                  positions.map((row) => (
                    <tr
                      key={row.symbol}
                      className="border-t border-zinc-200 text-zinc-800 dark:border-zinc-800 dark:text-zinc-300"
                    >
                      <td className="px-3 py-2 font-medium">{row.symbol}</td>
                      <td className="px-3 py-2">{row.qty}</td>
                      <td className="px-3 py-2">${Number(row.avg).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div id="trade" className="glass scroll-mt-24 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Trade desk</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Search stock
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <input
                className="w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-white"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value.toUpperCase());
                  setSymbol(e.target.value.toUpperCase());
                }}
                placeholder="Type NVDA, AAPL, MSFT..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredTickers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSearch(t);
                    setSymbol(t);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    symbol === t
                      ? "border-zinc-600 bg-zinc-800 text-white dark:border-zinc-400"
                      : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="w-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-white"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => doSide("buy")}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Buy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => doSide("sell")}
              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <TrendingDown className="h-3.5 w-3.5" /> Sell
            </button>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Trading as: {userId === "demo" ? "Demo user" : "Signed-in user"}
          </p>
        </div>
      </div>

      <div id="leaderboard" className="glass scroll-mt-24 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Leaderboard</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-500">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Points</th>
              </tr>
            </thead>
            <tbody>
              {(board?.rows ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-500" colSpan={3}>
                    No leaderboard entries yet.
                  </td>
                </tr>
              ) : (
                (board?.rows ?? []).map((row, idx) => {
                  const r = row as { user_id?: string; points?: number };
                  return (
                    <tr
                      key={`${r.user_id}-${idx}`}
                      className="border-t border-zinc-200 text-zinc-800 dark:border-zinc-800 dark:text-zinc-300"
                    >
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{r.user_id ?? "User"}</td>
                      <td className="px-3 py-2">{r.points ?? 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="ai-feedback" className="glass scroll-mt-24 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">AI feedback</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {feedback ?? "Run trades to generate feedback (Gemini)."}
        </p>
      </div>
    </div>
  );
}

export function PaperTrading() {
  return (
    <ClerkUserGate>
      {(userId) => <PaperTradingContent userId={userId} />}
    </ClerkUserGate>
  );
}
