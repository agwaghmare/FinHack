/** Stored under Clerk `unsafeMetadata[FINHACK_INVESTMENT_PREFS_KEY]`. */

export const FINHACK_INVESTMENT_PREFS_KEY = "finhack_investment_prefs";

export type RiskToleranceId =
  | "conservative"
  | "moderate"
  | "balanced_growth"
  | "aggressive";

export type InvestmentStyleId =
  | "dividend_income"
  | "growth"
  | "value"
  | "index_core"
  | "momentum"
  | "small_cap";

export type InvestmentPrefs = {
  riskTolerance: RiskToleranceId | null;
  styles: InvestmentStyleId[];
  /** Set true after onboarding or skip. */
  onboardingComplete: boolean;
  updatedAt?: string;
};

export const RISK_OPTIONS: {
  id: RiskToleranceId;
  label: string;
  description: string;
}[] = [
  {
    id: "conservative",
    label: "Conservative",
    description: "Prioritize capital preservation and lower volatility.",
  },
  {
    id: "moderate",
    label: "Moderate",
    description: "Balance growth and stability.",
  },
  {
    id: "balanced_growth",
    label: "Growth-oriented",
    description: "Higher equity tilt; comfortable with more swings for long-term growth.",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Maximize long-term growth; tolerate significant drawdowns.",
  },
];

export const STYLE_OPTIONS: { id: InvestmentStyleId; label: string; hint?: string }[] = [
  { id: "dividend_income", label: "Dividend income", hint: "Yield-focused equities" },
  { id: "growth", label: "Growth stocks", hint: "Earnings expansion, reinvestment" },
  { id: "value", label: "Value stocks", hint: "Discounts to fundamentals" },
  { id: "index_core", label: "Index / core", hint: "Broad market or factor core" },
  { id: "momentum", label: "Momentum / tactical", hint: "Trend or relative strength" },
  { id: "small_cap", label: "Small cap", hint: "Smaller companies, higher risk" },
];

export function defaultInvestmentPrefs(): InvestmentPrefs {
  return {
    riskTolerance: null,
    styles: [],
    onboardingComplete: false,
  };
}

export function parseInvestmentPrefs(raw: unknown): InvestmentPrefs {
  if (!raw || typeof raw !== "object") return defaultInvestmentPrefs();
  const o = raw as Record<string, unknown>;
  const risk = o.riskTolerance;
  const validRisk = RISK_OPTIONS.some((r) => r.id === risk) ? (risk as RiskToleranceId) : null;
  const stylesRaw = o.styles;
  const allowed = new Set(STYLE_OPTIONS.map((s) => s.id));
  const styles = Array.isArray(stylesRaw)
    ? (stylesRaw.filter((x) => typeof x === "string" && allowed.has(x as InvestmentStyleId)) as InvestmentStyleId[])
    : [];
  return {
    riskTolerance: validRisk,
    styles,
    onboardingComplete: o.onboardingComplete === true,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
  };
}

export function isStyleId(id: string): id is InvestmentStyleId {
  return STYLE_OPTIONS.some((s) => s.id === id);
}
