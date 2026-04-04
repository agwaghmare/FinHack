/** Helpers for total return and Sharpe from OHLC close series (education / illustration). */

export function closesFromBars(raw: unknown): number[] {
  const bars = Array.isArray(raw) ? raw : [];
  return bars
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const c = Number((b as { close?: unknown }).close);
      return Number.isFinite(c) && c > 0 ? c : null;
    })
    .filter((v): v is number => v != null);
}

/** Simple buy-and-hold return over the sample window. */
export function totalReturnPct(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const a = closes[0];
  const b = closes[closes.length - 1];
  if (a <= 0) return null;
  return ((b / a) - 1) * 100;
}

/**
 * Annualized Sharpe from daily closes (log returns), rf ≈ 0.
 * Not a fund prospectus metric — illustrative for the UI.
 */
export function sharpeAnnualizedFromDailyCloses(closes: number[]): number | null {
  if (closes.length < 40) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 20) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
  const std = Math.sqrt(variance);
  if (std < 1e-12) return null;
  return (mean / std) * Math.sqrt(252);
}
