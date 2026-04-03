/** Demo portfolio + sparkline helpers */

export const demoHoldings = [
  { symbol: "SPY", weight: 0.42, value: 168_400, pnl: 4.2 },
  { symbol: "QQQ", weight: 0.28, value: 112_200, pnl: 6.1 },
  { symbol: "IWM", weight: 0.15, value: 60_000, pnl: -1.3 },
  { symbol: "TLT", weight: 0.15, value: 60_000, pnl: 0.8 },
];

export const demoSpark = [
  { i: 0, v: 100 },
  { i: 1, v: 102 },
  { i: 2, v: 101 },
  { i: 3, v: 105 },
  { i: 4, v: 104 },
  { i: 5, v: 108 },
  { i: 6, v: 110 },
];

export const demoHeadlines = [
  {
    title: "Equities digest mixed macro prints as yields pause",
    sentiment: "neutral" as const,
    summary: "Cross-asset flows show balanced risk appetite.",
  },
  {
    title: "Tech leadership extends on earnings resilience",
    sentiment: "bullish" as const,
    summary: "Mega-cap growth continues to absorb flows.",
  },
  {
    title: "Credit spreads widen modestly on supply",
    sentiment: "bearish" as const,
    summary: "Investment grade sees light pressure.",
  },
];
