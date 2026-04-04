import type { InvestmentStyleId, RiskToleranceId } from "./investmentPreferences";

const BY_RISK: Record<NonNullable<RiskToleranceId>, string[]> = {
  conservative: ["VTI", "BND", "VGIT", "SCHD", "KO"],
  moderate: ["VTI", "VXUS", "AAPL", "MSFT", "JNJ"],
  balanced_growth: ["VOO", "QQQ", "AAPL", "MSFT", "AVGO"],
  aggressive: ["QQQ", "NVDA", "MSFT", "GOOGL", "META"],
};

/** Five liquid symbols tailored to risk + optional style tags (illustrative, not advice). */
export function suggestedHoldings(
  risk: RiskToleranceId | null,
  styles: InvestmentStyleId[],
): string[] {
  const r = risk ?? "moderate";
  const pool = [...BY_RISK[r]];
  const styleSet = new Set(styles);

  if (styleSet.has("dividend_income")) {
    pool[4] = "VYM";
    pool[1] = pool[1] === "BND" ? "BND" : "SCHD";
  }
  if (styleSet.has("growth")) {
    pool[3] = "NVDA";
    pool[2] = "MSFT";
  }
  if (styleSet.has("value")) {
    pool[2] = "BRK.B";
    pool[4] = "JPM";
  }
  if (styleSet.has("index_core")) {
    return ["VTI", "VOO", "QQQ", "IEFA", "AGG"];
  }
  if (styleSet.has("small_cap")) {
    pool[4] = "IWM";
  }
  if (styleSet.has("momentum")) {
    pool[0] = "MTUM";
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of pool) {
    const u = s.toUpperCase();
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
    if (out.length >= 5) break;
  }
  return out.slice(0, 5);
}
