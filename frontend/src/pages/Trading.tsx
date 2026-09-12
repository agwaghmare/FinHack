import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  BookOpen,
  CandlestickChart,
  FlaskConical,
  LineChart,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import clsx from "clsx";
import { api } from "../lib/api";

type Tab = "learn" | "var" | "backtest";

type StrategyMeta = {
  id: string;
  name: string;
  blurb: string;
  params: { key: string; label: string; default: number; min: number; max: number }[];
};

type VarPayload = {
  as_of?: string;
  generated_at?: string;
  message?: string;
  portfolio_value?: number;
  trading_days?: number;
  annualized_vol_pct?: number;
  mean_daily_return_pct?: number;
  daily_vol_pct?: number;
  disclaimer?: string;
  var?: {
    historical?: Record<string, { daily_var_pct: number; daily_var_usd: number }>;
    parametric?: Record<string, { daily_var_pct: number; daily_var_usd: number }>;
    cvar?: Record<string, { daily_cvar_pct: number; daily_cvar_usd: number }>;
    headline?: { daily_var_pct: number; daily_var_usd: number; confidence: number };
  };
  contributors?: {
    symbol: string;
    weight: number;
    standalone_var_95_pct: number;
    weighted_var_proxy_usd: number;
  }[];
};

type BacktestResult = {
  symbol: string;
  strategy: string;
  period: string;
  metrics: {
    final_equity: number;
    total_return_pct: number;
    cagr_pct: number;
    buy_hold_cagr_pct: number;
    max_drawdown_pct: number;
    sharpe: number;
    trades: number;
    round_trips: number;
    win_rate_pct: number | null;
    bars: number;
  };
  equity_curve: { date: string; strategy: number; buy_hold: number }[];
  trades: { date: string; side: string; price: number; position: number }[];
  disclaimer?: string;
};

const LESSONS = [
  {
    title: "Orders & execution",
    body: "Market orders fill now; limits set your price. Spreads, slippage, and partial fills matter more than backtests admit.",
    link: "/invest/learn",
  },
  {
    title: "Risk before edge",
    body: "Position size, max daily loss, and VaR beat “perfect” entries. Surviving drawdowns is the skill.",
    link: "/invest/trading",
  },
  {
    title: "Trend vs mean reversion",
    body: "Breakouts and SMA crosses ride momentum; RSI fades extremes. Markets rotate regimes — one style rarely wins forever.",
    link: "/invest/trading",
  },
  {
    title: "Paper before capital",
    body: "Use Paper Lab to journal thesis → entry → exit. Match live rules: fees, size, and no revenge trades.",
    link: "/invest/paper-lab",
  },
];

function money(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function Trading() {
  const { user, isSignedIn } = useUser();
  const userId = user?.id ?? "";
  const [tab, setTab] = useState<Tab>("var");

  const [varLookback, setVarLookback] = useState("1y");
  const [varLoading, setVarLoading] = useState(false);
  const [varErr, setVarErr] = useState<string | null>(null);
  const [varData, setVarData] = useState<VarPayload | null>(null);

  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [symbol, setSymbol] = useState("SPY");
  const [strategy, setStrategy] = useState("sma_cross");
  const [period, setPeriod] = useState("2y");
  const [cash, setCash] = useState(10000);
  const [params, setParams] = useState<Record<string, number>>({ fast: 20, slow: 50 });
  const [btLoading, setBtLoading] = useState(false);
  const [btErr, setBtErr] = useState<string | null>(null);
  const [bt, setBt] = useState<BacktestResult | null>(null);

  const activeStrategy = useMemo(
    () => strategies.find((s) => s.id === strategy) ?? null,
    [strategies, strategy],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = (await api.tradingStrategies()) as { strategies?: StrategyMeta[] };
        if (!cancelled) setStrategies(r.strategies ?? []);
      } catch {
        if (!cancelled) setStrategies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeStrategy) return;
    const next: Record<string, number> = {};
    for (const p of activeStrategy.params) next[p.key] = p.default;
    setParams(next);
  }, [activeStrategy?.id]);

  async function loadVar() {
    if (!userId) return;
    setVarLoading(true);
    setVarErr(null);
    try {
      const r = (await api.tradingVar(userId, varLookback)) as VarPayload;
      setVarData(r);
    } catch (e) {
      setVarErr(e instanceof Error ? e.message : "Could not compute VaR");
      setVarData(null);
    } finally {
      setVarLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "var" && isSignedIn && userId) void loadVar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId, isSignedIn, varLookback]);

  async function runBacktest() {
    setBtLoading(true);
    setBtErr(null);
    try {
      const r = (await api.tradingBacktest({
        symbol: symbol.trim().toUpperCase(),
        strategy,
        period,
        initial_cash: cash,
        params,
      })) as BacktestResult;
      setBt(r);
    } catch (e) {
      setBtErr(e instanceof Error ? e.message : "Backtest failed");
      setBt(null);
    } finally {
      setBtLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof ShieldAlert }[] = [
    { id: "learn", label: "Learn trading", icon: BookOpen },
    { id: "var", label: "Daily VaR", icon: ShieldAlert },
    { id: "backtest", label: "Backtest", icon: FlaskConical },
  ];

  return (
    <div className="space-y-8 pb-16">
      <header className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-400/90">
              Trading lab
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              <CandlestickChart className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              Risk, rules &amp; rehearsal
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Education-first trading tools: daily portfolio VaR, rule-based backtests, and links to paper trading.
              Nothing here places live orders or is personalized advice.
            </p>
          </div>
          <Link
            to="/invest/paper-lab"
            className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100"
          >
            <Play className="h-3.5 w-3.5" />
            Open Paper Lab
          </Link>
        </div>
      </header>

      <div className="glass-inset flex flex-wrap gap-1 rounded-2xl p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none",
                tab === t.id
                  ? "bg-white/80 text-zinc-900 shadow-sm dark:bg-white/15 dark:text-white"
                  : "text-zinc-500 hover:bg-white/40 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "learn" && (
        <section className="grid gap-4 md:grid-cols-2">
          {LESSONS.map((l) => (
            <article key={l.title} className="glass rounded-2xl p-5">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{l.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{l.body}</p>
              <Link
                to={l.link}
                className="mt-4 inline-flex text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
              >
                Continue →
              </Link>
            </article>
          ))}
          <article className="glass rounded-2xl border-amber-500/25 p-5 md:col-span-2">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  New Learn modules: Trading Mechanics &amp; Strategy Design
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Quizzes on order types, expectancy, and overfitting live in the Learn Hub alongside risk and paper-trading
                  modules.
                </p>
                <Link
                  to="/invest/learn"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400"
                >
                  <BookOpen className="h-4 w-4" />
                  Open Learn Hub
                </Link>
              </div>
            </div>
          </article>
        </section>
      )}

      {tab === "var" && (
        <section className="space-y-6">
          {!isSignedIn ? (
            <p className="glass rounded-2xl p-6 text-sm text-zinc-500">Sign in and add holdings to see daily VaR.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Lookback
                  <select
                    className="glass-input ml-2 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                    value={varLookback}
                    onChange={(e) => setVarLookback(e.target.value)}
                  >
                    <option value="6mo">6 months</option>
                    <option value="1y">1 year</option>
                    <option value="2y">2 years</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void loadVar()}
                  disabled={varLoading}
                  className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100"
                >
                  {varLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Recalculate today
                </button>
                <Link to="/invest/portfolio" className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline">
                  Edit holdings
                </Link>
              </div>

              {varErr ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                  {varErr}
                </p>
              ) : null}

              {varLoading && !varData ? (
                <div className="glass flex items-center gap-2 rounded-2xl p-8 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Computing daily VaR from your holdings…
                </div>
              ) : null}

              {varData?.message && !varData.var ? (
                <p className="glass rounded-2xl p-6 text-sm text-zinc-600 dark:text-zinc-400">{varData.message}</p>
              ) : null}

              {varData?.var ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="glass rounded-2xl p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">95% hist. VaR (1d)</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {money(varData.var.historical?.["95"]?.daily_var_usd)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {varData.var.historical?.["95"]?.daily_var_pct?.toFixed(2)}% of{" "}
                        {money(varData.portfolio_value)}
                      </p>
                    </div>
                    <div className="glass rounded-2xl p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">99% hist. VaR (1d)</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {money(varData.var.historical?.["99"]?.daily_var_usd)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {varData.var.historical?.["99"]?.daily_var_pct?.toFixed(2)}% daily
                      </p>
                    </div>
                    <div className="glass rounded-2xl p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">95% CVaR (ES)</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {money(varData.var.cvar?.["95"]?.daily_cvar_usd)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">Avg loss beyond VaR</p>
                    </div>
                    <div className="glass rounded-2xl p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Ann. volatility</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {varData.annualized_vol_pct?.toFixed(1) ?? "—"}%
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        As of {varData.as_of} · {varData.trading_days} days
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="glass rounded-2xl p-5">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Historical vs parametric</h3>
                      <table className="mt-3 w-full text-left text-xs">
                        <thead className="text-zinc-500">
                          <tr>
                            <th className="py-1 font-medium">Conf.</th>
                            <th className="py-1 font-medium">Hist. $</th>
                            <th className="py-1 font-medium">Param. $</th>
                            <th className="py-1 font-medium">CVaR $</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums text-zinc-800 dark:text-zinc-200">
                          {["95", "99"].map((k) => (
                            <tr key={k} className="border-t border-white/10">
                              <td className="py-2">{k}%</td>
                              <td>{money(varData.var?.historical?.[k]?.daily_var_usd)}</td>
                              <td>{money(varData.var?.parametric?.[k]?.daily_var_usd)}</td>
                              <td>{money(varData.var?.cvar?.[k]?.daily_cvar_usd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="glass rounded-2xl p-5">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Standalone risk contributors
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {(varData.contributors ?? []).slice(0, 6).map((c) => (
                          <li
                            key={c.symbol}
                            className="glass-inset flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                          >
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {c.symbol}{" "}
                              <span className="font-normal text-zinc-500">
                                ({(c.weight * 100).toFixed(1)}%)
                              </span>
                            </span>
                            <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                              {c.standalone_var_95_pct.toFixed(2)}% · {money(c.weighted_var_proxy_usd)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {varData.disclaimer ? (
                    <p className="text-[11px] leading-relaxed text-zinc-500">{varData.disclaimer}</p>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </section>
      )}

      {tab === "backtest" && (
        <section className="space-y-6">
          <div className="glass grid gap-4 rounded-2xl p-5 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Symbol
                <input
                  className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm uppercase text-zinc-900 dark:text-zinc-100"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  maxLength={12}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Strategy
                <select
                  className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  {(strategies.length
                    ? strategies
                    : [
                        { id: "sma_cross", name: "SMA crossover" },
                        { id: "buy_hold", name: "Buy & hold" },
                      ]
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {activeStrategy?.blurb ? (
                <p className="text-xs leading-relaxed text-zinc-500">{activeStrategy.blurb}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Period
                <select
                  className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="6mo">6 months</option>
                  <option value="1y">1 year</option>
                  <option value="2y">2 years</option>
                  <option value="5y">5 years</option>
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Starting cash
                <input
                  type="number"
                  className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  value={cash}
                  min={500}
                  step={500}
                  onChange={(e) => setCash(Number(e.target.value) || 10000)}
                />
              </label>
              {(activeStrategy?.params ?? []).map((p) => (
                <label key={p.key} className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {p.label}
                  <input
                    type="number"
                    className="glass-input mt-1 w-full rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    value={params[p.key] ?? p.default}
                    min={p.min}
                    max={p.max}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, [p.key]: Number(e.target.value) || p.default }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={() => void runBacktest()}
                disabled={btLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
              >
                {btLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LineChart className="h-4 w-4" />}
                Run backtest
              </button>
            </div>
          </div>

          {btErr ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
              {btErr}
            </p>
          ) : null}

          {bt ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["CAGR", `${bt.metrics.cagr_pct}%`],
                  ["Buy & hold CAGR", `${bt.metrics.buy_hold_cagr_pct}%`],
                  ["Max drawdown", `${bt.metrics.max_drawdown_pct}%`],
                  ["Sharpe", String(bt.metrics.sharpe)],
                  ["Trades", String(bt.metrics.trades)],
                  ["Win rate", bt.metrics.win_rate_pct != null ? `${bt.metrics.win_rate_pct}%` : "—"],
                  ["Final equity", money(bt.metrics.final_equity)],
                  ["Total return", `${bt.metrics.total_return_pct}%`],
                ].map(([k, v]) => (
                  <div key={k} className="glass-inset rounded-xl px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{k}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{v}</p>
                  </div>
                ))}
              </div>

              <div className="glass rounded-2xl p-4 sm:p-5">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Equity · {bt.symbol} · {bt.strategy}
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RLineChart data={bt.equity_curve}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} width={56} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="strategy" name="Strategy" stroke="#f59e0b" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="buy_hold" name="Buy & hold" stroke="#64748b" dot={false} strokeWidth={1.5} />
                    </RLineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {bt.trades?.length ? (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent signals</h3>
                  <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
                    {[...bt.trades].reverse().map((t, i) => (
                      <li
                        key={`${t.date}-${t.side}-${i}`}
                        className="flex justify-between gap-2 border-b border-white/5 py-1.5 tabular-nums"
                      >
                        <span className="text-zinc-500">{t.date}</span>
                        <span
                          className={
                            t.side === "buy" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-rose-600 dark:text-rose-400"
                          }
                        >
                          {t.side.toUpperCase()}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200">{t.price}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bt.disclaimer ? <p className="text-[11px] text-zinc-500">{bt.disclaimer}</p> : null}
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
