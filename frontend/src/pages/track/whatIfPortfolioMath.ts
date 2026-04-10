/** Helpers for What-If portfolio / stock projections (client-side, illustrative). */

export type OhlcBar = { date?: string; close?: number };

export function normalizeBars(raw: unknown): OhlcBar[] {
  const bars = (raw as { bars?: OhlcBar[] } | null)?.bars;
  if (!Array.isArray(bars)) return [];
  return bars
    .filter((b) => b && typeof b.date === "string" && typeof b.close === "number" && b.close > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export type PriceAnchorResult = {
  start: { price: number; date: string };
  end: { price: number; date: string };
  /** True if we could not go back full `yearsAgo` (earliest bar is newer than target date). */
  partialHistory: boolean;
};

/** Close on or before (today - yearsAgo), and latest close. */
export function priceAnchors(bars: OhlcBar[], yearsAgo: number): PriceAnchorResult | null {
  if (bars.length === 0) return null;
  const end = bars[bars.length - 1];
  const endPrice = Number(end.close);
  const endDate = String(end.date);
  if (!Number.isFinite(endPrice)) return null;

  const target = new Date();
  target.setFullYear(target.getFullYear() - yearsAgo);
  const cutoff = target.toISOString().slice(0, 10);

  let start = bars[0];
  for (const b of bars) {
    const d = String(b.date);
    if (d <= cutoff && typeof b.close === "number") start = b;
    else if (d > cutoff) break;
  }
  const startPrice = Number(start.close);
  const startDate = String(start.date);
  if (!Number.isFinite(startPrice) || startPrice <= 0) return null;

  const partialHistory = startDate > cutoff;

  if (startDate === endDate && bars.length > 1) {
    return {
      start: { price: Number(bars[0].close), date: String(bars[0].date) },
      end: { price: endPrice, date: endDate },
      partialHistory: String(bars[0].date) > cutoff,
    };
  }

  return {
    start: { price: startPrice, date: startDate },
    end: { price: endPrice, date: endDate },
    partialHistory,
  };
}

export function yearsBetweenDates(isoStart: string, isoEnd: string): number {
  const a = new Date(isoStart + (isoStart.includes("T") ? "" : "T12:00:00")).getTime();
  const b = new Date(isoEnd + (isoEnd.includes("T") ? "" : "T12:00:00")).getTime();
  const d = (b - a) / (365.25 * 24 * 3600 * 1000);
  return Math.max(1 / 365, d);
}

export function cagrFromPrices(startPrice: number, endPrice: number, years: number): number | null {
  if (years <= 0 || startPrice <= 0 || endPrice <= 0) return null;
  return Math.pow(endPrice / startPrice, 1 / years) - 1;
}

export function futureValueLumpSum(pv: number, annualRate: number, years: number): number {
  if (years <= 0) return pv;
  return pv * Math.pow(1 + annualRate, years);
}

export function periodForHistoryYears(years: number): string {
  if (years <= 2) return "5y";
  if (years <= 5) return "5y";
  if (years <= 10) return "10y";
  return "max";
}
