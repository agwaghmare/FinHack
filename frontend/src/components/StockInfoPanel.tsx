import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { CandlestickPanel } from "./CandlestickPanel";

export type StockInfoPayload = {
  symbol?: string;
  long_name?: string;
  sector?: string;
  industry?: string;
  summary?: string;
  trailing_pe?: number;
  forward_pe?: number;
  trailing_eps?: number;
  market_cap?: number;
  logo_url?: string | null;
  error?: string;
};

function fmtCap(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

export function StockInfoPanel({
  symbol,
  showChart = true,
  chartPeriod = "6mo",
}: {
  symbol: string;
  showChart?: boolean;
  chartPeriod?: string;
}) {
  const sym = symbol.trim().toUpperCase();
  const [data, setData] = useState<StockInfoPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sym) return;
    let cancelled = false;
    setLoading(true);
    api
      .stockInfo(sym)
      .then((r) => {
        if (!cancelled) setData(r as StockInfoPayload);
      })
      .catch(() => {
        if (!cancelled) setData({ error: "Could not load company data" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sym]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading {sym}…
      </div>
    );
  }

  if (data?.error && !data.long_name) {
    return <p className="text-sm text-amber-600 dark:text-amber-300">{data.error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {data?.logo_url ? (
          <img
            src={data.logo_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-zinc-700 bg-white object-contain p-1"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-zinc-100">{data?.long_name ?? sym}</p>
          <p className="text-xs text-zinc-500">
            {[data?.sector, data?.industry].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[10px] uppercase text-zinc-500">Trailing P/E</dt>
          <dd className="font-medium tabular-nums text-zinc-200">
            {data?.trailing_pe != null ? data.trailing_pe.toFixed(2) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-zinc-500">Forward P/E</dt>
          <dd className="font-medium tabular-nums text-zinc-200">
            {data?.forward_pe != null ? data.forward_pe.toFixed(2) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-zinc-500">EPS (ttm)</dt>
          <dd className="font-medium tabular-nums text-zinc-200">
            {data?.trailing_eps != null ? data.trailing_eps.toFixed(2) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-zinc-500">Market cap</dt>
          <dd className="font-medium tabular-nums text-zinc-200">{fmtCap(data?.market_cap)}</dd>
        </div>
      </dl>
      {data?.summary ? (
        <p className="line-clamp-6 text-sm leading-relaxed text-zinc-400">{data.summary}</p>
      ) : null}
      {showChart ? (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <CandlestickPanel symbol={sym} period={chartPeriod} interval="1d" />
        </div>
      ) : null}
    </div>
  );
}
