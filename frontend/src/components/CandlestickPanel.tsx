import { useEffect, useState } from "react";
import { apiBase } from "../lib/api";

/** @deprecated kept for callers that still import the type */
export type OhlcBar = {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
};

type Props = {
  symbol: string;
  /** yfinance period e.g. 1y, 6mo */
  period?: string;
  /** yfinance interval e.g. 1d, 1wk */
  interval?: string;
};

/**
 * Server-rendered candlesticks via mplfinance (`GET /market/ohlc/chart.png`).
 */
export function CandlestickPanel({
  symbol,
  period = "1y",
  interval = "1d",
}: Props) {
  const sym = symbol.trim().toUpperCase() || "NVDA";
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const qs = new URLSearchParams({
    symbol: sym,
    period,
    interval,
  });
  const src = `${apiBase}/market/ohlc/chart.png?${qs.toString()}`;

  useEffect(() => {
    setErr(null);
    setLoaded(false);
  }, [sym, period, interval, src]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {sym} · candlesticks (mplfinance)
        </p>
        {!loaded && !err && (
          <span className="text-xs text-zinc-500">Loading chart…</span>
        )}
        {err && <span className="text-xs text-amber-600 dark:text-amber-500">{err}</span>}
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
        <img
          src={src}
          alt={`${sym} OHLC candlestick chart`}
          className="h-auto w-full max-h-[min(420px,70vh)] object-contain"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(true);
            setErr(
              "Chart PNG failed to load. Ensure the API is running (pip install mplfinance), GET /market/ohlc/chart.png works, and CORS allows this origin.",
            );
          }}
        />
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
        Yahoo Finance OHLC via yfinance, rendered with matplotlib + mplfinance on the server.
      </p>
    </div>
  );
}
