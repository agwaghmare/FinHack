import { Loader2, X } from "lucide-react";
import { StockInfoPanel } from "./StockInfoPanel";

export type CompareRow = {
  symbol: string;
  longName?: string;
  sector?: string;
  perf1m?: number | null;
  perf6m?: number | null;
  perf1y?: number | null;
  trend?: "up" | "down" | "flat";
};

type Props = {
  open: boolean;
  symbol: string;
  onClose: () => void;
  compareInput: string;
  onCompareInputChange: (value: string) => void;
  onApplyCompare: () => void;
  compareRows: CompareRow[];
  compareLoading: boolean;
};

export function MarketStockLookupModal({
  open,
  symbol,
  onClose,
  compareInput,
  onCompareInputChange,
  onApplyCompare,
  compareRows,
  compareLoading,
}: Props) {
  if (!open || !symbol) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="glass-overlay absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="glass-modal relative z-10 max-h-[min(90vh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{symbol}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <StockInfoPanel symbol={symbol} showChart chartPeriod="1y" />
        <div className="glass-inset mt-5 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Sector + performance comparison
            </h3>
            <span className="text-[11px] text-zinc-500">Compare multiple securities side by side</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="glass-input min-w-[14rem] flex-1 rounded-lg px-3 py-2 text-xs uppercase text-zinc-900 dark:text-zinc-100"
              value={compareInput}
              onChange={(e) => onCompareInputChange(e.target.value)}
              placeholder="e.g. NVDA,AMD,QQQ"
            />
            <button
              type="button"
              onClick={onApplyCompare}
              className="glass-chip rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-white/50 dark:text-zinc-300 dark:hover:bg-white/15"
            >
              Compare
            </button>
          </div>
          {compareLoading ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comparison…
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {compareRows.map((r) => {
                const trendClass =
                  r.trend === "up" ? "text-emerald-400" : r.trend === "down" ? "text-rose-400" : "text-zinc-400";
                const fmt = (n: number | null | undefined) =>
                  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
                return (
                  <div key={r.symbol} className="rounded-lg glass-inset p-3">
                    <p className="text-base font-semibold text-zinc-100">{r.symbol}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{r.longName ?? "—"}</p>
                    <p className="mt-1 text-xs text-zinc-400">Sector: {r.sector ?? "Unknown"}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded bg-zinc-900 p-1.5">
                        <p className="text-[10px] text-zinc-500">1M</p>
                        <p className="font-semibold text-zinc-200">{fmt(r.perf1m)}</p>
                      </div>
                      <div className="rounded bg-zinc-900 p-1.5">
                        <p className="text-[10px] text-zinc-500">6M</p>
                        <p className="font-semibold text-zinc-200">{fmt(r.perf6m)}</p>
                      </div>
                      <div className="rounded bg-zinc-900 p-1.5">
                        <p className="text-[10px] text-zinc-500">1Y</p>
                        <p className="font-semibold text-zinc-200">{fmt(r.perf1y)}</p>
                      </div>
                    </div>
                    <p className={`mt-2 text-xs font-medium ${trendClass}`}>
                      Trend: {r.trend === "up" ? "Uptrend" : r.trend === "down" ? "Downtrend" : "Sideways"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
