/** Local-only personal finance model for Track (demo / prototype). */

export const TRACK_FINANCE_STORAGE_KEY = "fs.trackFinance.v1";

export type SpendCategory =
  | "food"
  | "rent"
  | "subscriptions"
  | "travel"
  | "dining"
  | "transport"
  | "utilities"
  | "other";

export const CATEGORY_LABELS: Record<SpendCategory, string> = {
  food: "Groceries",
  rent: "Rent / housing",
  subscriptions: "Subscriptions",
  travel: "Travel",
  dining: "Dining out",
  transport: "Transport",
  utilities: "Utilities",
  other: "Other",
};

export const CATEGORY_COLORS: Record<SpendCategory, string> = {
  food: "#34d399",
  rent: "#818cf8",
  subscriptions: "#f472b6",
  travel: "#38bdf8",
  dining: "#fbbf24",
  transport: "#a78bfa",
  utilities: "#94a3b8",
  other: "#64748b",
};

export interface TrackTransaction {
  id: string;
  date: string;
  amount: number;
  category: SpendCategory;
  merchant?: string;
}

export interface TrackBudget {
  category: SpendCategory;
  monthlyLimit: number;
}

export interface TrackSubscription {
  id: string;
  name: string;
  amount: number;
  cadence: "monthly" | "annual";
  category: SpendCategory;
}

export interface TrackGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
}

export interface TrackMortgage {
  principal: number;
  annualRatePct: number;
  termYears: number;
  extraMonthlyPrincipal: number;
}

export type TaxFilingStatus = "single" | "married_joint";

export interface TrackTax {
  filingStatus: TaxFilingStatus;
  annualGrossIncome: number;
  pretax401kAnnual: number;
  otherDeductionsAnnual: number;
}

export interface TrackFinanceState {
  monthlyIncome: number;
  emergencyFundTarget: number;
  emergencyFundBalance: number;
  monthlyDebtPayments: number;
  transactions: TrackTransaction[];
  budgets: TrackBudget[];
  subscriptions: TrackSubscription[];
  goals: TrackGoal[];
  mortgage: TrackMortgage;
  tax: TrackTax;
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function ym(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(yMonth: string, delta: number): string {
  const [y, m] = yMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return ym(d);
}

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function subscriptionsMonthlyTotal(subs: TrackSubscription[]): number {
  return subs.reduce((acc, s) => acc + (s.cadence === "annual" ? s.amount / 12 : s.amount), 0);
}

export function transactionsInMonth(transactions: TrackTransaction[], yMonth: string): TrackTransaction[] {
  return transactions.filter((t) => monthKeyFromIso(t.date) === yMonth);
}

export function spendingByCategory(transactions: TrackTransaction[], yMonth: string): Record<SpendCategory, number> {
  const empty: Record<SpendCategory, number> = {
    food: 0,
    rent: 0,
    subscriptions: 0,
    travel: 0,
    dining: 0,
    transport: 0,
    utilities: 0,
    other: 0,
  };
  for (const t of transactionsInMonth(transactions, yMonth)) {
    empty[t.category] += t.amount;
  }
  return empty;
}

export function totalSpendingInMonth(transactions: TrackTransaction[], yMonth: string): number {
  return transactionsInMonth(transactions, yMonth).reduce((a, t) => a + t.amount, 0);
}

/** Category totals including recurring subscriptions (allocated by subscription category). */
export function categoryTotalsWithRecurring(state: TrackFinanceState, yMonth: string): Record<SpendCategory, number> {
  const base = spendingByCategory(state.transactions, yMonth);
  for (const s of state.subscriptions) {
    const m = s.cadence === "annual" ? s.amount / 12 : s.amount;
    base[s.category] += m;
  }
  return base;
}

export function totalOutflowInMonth(state: TrackFinanceState, yMonth: string): number {
  return Object.values(categoryTotalsWithRecurring(state, yMonth)).reduce((a, b) => a + b, 0);
}

export function lastNYearMonths(n: number, anchorYm: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(addMonths(anchorYm, -i));
  }
  return out;
}

export function currentYearMonth(): string {
  return ym(new Date());
}

export function defaultTrackFinanceState(): TrackFinanceState {
  const now = new Date();
  const txs: TrackTransaction[] = [];

  const push = (monthsAgo: number, day: number, amount: number, category: SpendCategory, merchant: string) => {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
    txs.push({
      id: id("tx"),
      date: d.toISOString().slice(0, 10),
      amount,
      category,
      merchant,
    });
  };

  for (let mo = 0; mo < 4; mo++) {
    push(mo, 1, 1850, "rent", "Rent");
    push(mo, 5, 420 + mo * 15, "food", "Whole Foods");
    push(mo, 8, 280 + mo * 40, "dining", "Restaurants");
    push(mo, 10, 95, "utilities", "Electric");
    push(mo, 12, 140, "transport", "Transit + gas");
    push(mo, 18, mo === 0 ? 220 : 80, "travel", mo === 0 ? "Weekend trip" : "Local");
    push(mo, 22, 55, "other", "Misc");
    if (mo === 1) push(mo, 6, 180, "dining", "Weekend brunch");
    if (mo === 0) {
      push(mo, 7, 95, "dining", "Friday dinner");
      push(mo, 14, 120, "dining", "Saturday night");
    }
  }

  const budgets: TrackBudget[] = [
    { category: "food", monthlyLimit: 500 },
    { category: "rent", monthlyLimit: 1900 },
    { category: "dining", monthlyLimit: 200 },
    { category: "subscriptions", monthlyLimit: 120 },
    { category: "travel", monthlyLimit: 150 },
    { category: "transport", monthlyLimit: 200 },
    { category: "utilities", monthlyLimit: 150 },
    { category: "other", monthlyLimit: 100 },
  ];

  const subscriptions: TrackSubscription[] = [
    { id: id("sub"), name: "Netflix", amount: 15.99, cadence: "monthly", category: "subscriptions" },
    { id: id("sub"), name: "Spotify", amount: 11.99, cadence: "monthly", category: "subscriptions" },
    { id: id("sub"), name: "Cloud storage", amount: 2.99, cadence: "monthly", category: "subscriptions" },
    { id: id("sub"), name: "Gym", amount: 39, cadence: "monthly", category: "other" },
    { id: id("sub"), name: "News", amount: 10, cadence: "monthly", category: "subscriptions" },
    { id: id("sub"), name: "Software", amount: 12, cadence: "monthly", category: "subscriptions" },
  ];

  const goals: TrackGoal[] = [
    {
      id: id("goal"),
      title: "Emergency fund",
      targetAmount: 12000,
      currentAmount: 4800,
      monthlyContribution: 400,
    },
    {
      id: id("goal"),
      title: "Vacation",
      targetAmount: 3500,
      currentAmount: 900,
      monthlyContribution: 200,
    },
    {
      id: id("goal"),
      title: "Down payment",
      targetAmount: 60000,
      currentAmount: 12000,
      monthlyContribution: 800,
    },
  ];

  return {
    monthlyIncome: 7200,
    emergencyFundTarget: 21600,
    emergencyFundBalance: 4800,
    monthlyDebtPayments: 320,
    transactions: txs,
    budgets,
    subscriptions,
    goals,
    mortgage: {
      principal: 385000,
      annualRatePct: 6.25,
      termYears: 30,
      extraMonthlyPrincipal: 0,
    },
    tax: {
      filingStatus: "single",
      annualGrossIncome: 86400,
      pretax401kAnnual: 6000,
      otherDeductionsAnnual: 0,
    },
  };
}

export function loadTrackFinanceState(): TrackFinanceState {
  try {
    const raw = localStorage.getItem(TRACK_FINANCE_STORAGE_KEY);
    if (!raw) return defaultTrackFinanceState();
    const parsed = JSON.parse(raw) as Partial<TrackFinanceState>;
    const base = defaultTrackFinanceState();
    return {
      ...base,
      ...parsed,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : base.transactions,
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : base.budgets,
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : base.subscriptions,
      goals: Array.isArray(parsed.goals) ? parsed.goals : base.goals,
      mortgage: parsed.mortgage ? { ...base.mortgage, ...parsed.mortgage } : base.mortgage,
      tax: parsed.tax ? { ...base.tax, ...parsed.tax } : base.tax,
    };
  } catch {
    return defaultTrackFinanceState();
  }
}

export function saveTrackFinanceState(state: TrackFinanceState) {
  try {
    localStorage.setItem(TRACK_FINANCE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Standard monthly mortgage payment (principal + interest). */
export function mortgageMonthlyPI(principal: number, annualRatePct: number, termYears: number): number {
  const n = termYears * 12;
  if (n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

export interface AmortizationSummary {
  months: number;
  totalPaid: number;
  totalInterest: number;
}

export function amortizeWithExtra(
  principal: number,
  annualRatePct: number,
  scheduledPayment: number,
  extraMonthly: number,
): AmortizationSummary {
  let balance = principal;
  const r = annualRatePct / 100 / 12;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 600;
  while (balance > 0.01 && months < maxMonths) {
    months += 1;
    const interest = balance * r;
    totalInterest += interest;
    let principalPart = scheduledPayment - interest;
    if (principalPart < 0) principalPart = 0;
    principalPart += extraMonthly;
    if (principalPart > balance) principalPart = balance;
    balance -= principalPart;
  }
  return {
    months,
    totalPaid: principal + totalInterest,
    totalInterest,
  };
}

/** Simplified 2024-ish US federal ordinary income estimate (demo only — not tax advice). */
const BRACKETS_SINGLE = [
  { upTo: 11600, rate: 0.1 },
  { upTo: 47150, rate: 0.12 },
  { upTo: 100525, rate: 0.22 },
  { upTo: 191950, rate: 0.24 },
  { upTo: 243725, rate: 0.32 },
  { upTo: 609350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

const BRACKETS_MFJ = [
  { upTo: 23200, rate: 0.1 },
  { upTo: 94300, rate: 0.12 },
  { upTo: 201050, rate: 0.22 },
  { upTo: 383900, rate: 0.24 },
  { upTo: 487450, rate: 0.32 },
  { upTo: 731200, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

const STANDARD_SINGLE = 14600;
const STANDARD_MFJ = 29200;

export function estimateFederalIncomeTax(
  taxableIncome: number,
  filing: TaxFilingStatus,
): { tax: number; marginalRate: number } {
  const brackets = filing === "married_joint" ? BRACKETS_MFJ : BRACKETS_SINGLE;
  let remaining = Math.max(0, taxableIncome);
  let tax = 0;
  let prev = 0;
  let marginal = brackets[brackets.length - 1].rate;
  for (const b of brackets) {
    const width = Math.min(remaining, b.upTo - prev);
    if (width > 0) {
      tax += width * b.rate;
      remaining -= width;
      marginal = b.rate;
    }
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return { tax, marginalRate: marginal };
}

export function taxEstimateFromProfile(tax: TrackTax): {
  taxableIncome: number;
  federalTax: number;
  effectiveRate: number;
  marginalRate: number;
  standardDeduction: number;
} {
  const std = tax.filingStatus === "married_joint" ? STANDARD_MFJ : STANDARD_SINGLE;
  const taxableIncome = Math.max(
    0,
    tax.annualGrossIncome - tax.pretax401kAnnual - std - tax.otherDeductionsAnnual,
  );
  const { tax: federalTax, marginalRate } = estimateFederalIncomeTax(taxableIncome, tax.filingStatus);
  const effectiveRate = tax.annualGrossIncome > 0 ? federalTax / tax.annualGrossIncome : 0;
  return {
    taxableIncome,
    federalTax,
    effectiveRate,
    marginalRate,
    standardDeduction: std,
  };
}

export interface CashFlowMonth {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export function cashFlowSeries(state: TrackFinanceState, monthsBack: number): CashFlowMonth[] {
  const anchor = currentYearMonth();
  const keys = lastNYearMonths(monthsBack, anchor);
  return keys.map((m) => {
    const expenses = totalOutflowInMonth(state, m);
    const income = state.monthlyIncome;
    return { month: m, income, expenses, net: income - expenses };
  });
}

export interface HealthScoreResult {
  score: number;
  label: string;
  factors: string[];
}

export function computeFinancialHealthScore(state: TrackFinanceState, anchorYm: string): HealthScoreResult {
  const income = state.monthlyIncome;
  const spend = totalOutflowInMonth(state, anchorYm);
  const savingsRate = income > 0 ? (income - spend) / income : 0;

  const avgSpend =
    lastNYearMonths(3, anchorYm).reduce((a, m) => a + totalOutflowInMonth(state, m), 0) / 3;
  const emergencyMonths = avgSpend > 0 ? state.emergencyFundBalance / avgSpend : 0;

  let budgetPenalty = 0;
  let budgetCount = 0;
  const byCat = categoryTotalsWithRecurring(state, anchorYm);
  for (const b of state.budgets) {
    budgetCount += 1;
    const actual = byCat[b.category];
    if (actual > b.monthlyLimit) {
      budgetPenalty += Math.min(40, ((actual - b.monthlyLimit) / b.monthlyLimit) * 100);
    }
  }
  const budgetScore = budgetCount ? Math.max(0, 100 - budgetPenalty / budgetCount) : 85;

  const savingsScore = Math.max(0, Math.min(100, 50 + savingsRate * 200));
  const emergencyScore = Math.max(0, Math.min(100, emergencyMonths * 25));
  const dti = income > 0 ? state.monthlyDebtPayments / income : 0;
  const debtScore = Math.max(0, Math.min(100, 100 - dti * 400));

  const score = Math.round(savingsScore * 0.3 + budgetScore * 0.25 + emergencyScore * 0.25 + debtScore * 0.2);
  const factors: string[] = [];
  if (savingsRate < 0.1) factors.push("Savings rate is below 10% of income — consider trimming discretionary categories.");
  if (emergencyMonths < 3) factors.push("Emergency fund covers fewer than 3 months of spending at current pace.");
  if (budgetPenalty > 15) factors.push("Several categories are over budget — dining and subscriptions are common leaks.");
  if (dti > 0.15) factors.push("Debt payments are a sizable share of income — payoff order may help free cash to invest.");
  if (factors.length === 0) factors.push("Solid baseline — keep funding goals and revisit budgets monthly.");

  const label =
    score >= 80 ? "Strong" : score >= 60 ? "Good" : score >= 40 ? "Needs improvement" : "High priority fixes";

  return { score: Math.min(100, Math.max(0, score)), label, factors };
}

export function spendingInsights(
  state: TrackFinanceState,
  thisYm: string,
): string[] {
  const prevYm = addMonths(thisYm, -1);
  const income = state.monthlyIncome;
  const thisCat = categoryTotalsWithRecurring(state, thisYm);
  const prevCat = categoryTotalsWithRecurring(state, prevYm);
  const lines: string[] = [];

  (Object.keys(thisCat) as SpendCategory[]).forEach((c) => {
    const now = thisCat[c];
    const was = prevCat[c];
    if (income > 0 && now > 0) {
      const pct = (now / income) * 100;
      if (pct >= 8) {
        const delta = was > 0 ? ((now - was) / was) * 100 : 0;
        const arrow = delta > 5 ? `(↑${delta.toFixed(0)}% from last month)` : delta < -5 ? `(↓${Math.abs(delta).toFixed(0)}% from last month)` : "";
        lines.push(
          `You spent ${pct.toFixed(0)}% of income on ${CATEGORY_LABELS[c]} this month ${arrow}`.trim(),
        );
      }
    }
  });

  const weekend = transactionsInMonth(state.transactions, thisYm).filter((t) => {
    const d = new Date(t.date + "T12:00:00");
    const day = d.getDay();
    return day === 0 || day === 6;
  });
  const weekday = transactionsInMonth(state.transactions, thisYm).filter((t) => {
    const d = new Date(t.date + "T12:00:00");
    const day = d.getDay();
    return day >= 1 && day <= 5;
  });
  const wend = weekend.reduce((a, t) => a + t.amount, 0);
  const wday = weekday.reduce((a, t) => a + t.amount, 0);
  const wdayAvg = wday / Math.max(1, weekday.length) || 0;
  const wendAvg = wend / Math.max(1, weekend.length) || 0;
  if (wendAvg > wdayAvg * 1.2 && weekend.length > 0) {
    lines.push("You spend more on weekends — consider a weekend spending cap for dining and entertainment.");
  }

  const maxGrowth = (Object.keys(thisCat) as SpendCategory[]).reduce<{ cat: SpendCategory; pct: number } | null>(
    (best, c) => {
      const was = prevCat[c];
      const now = thisCat[c];
      if (was > 20 && now > was) {
        const g = ((now - was) / was) * 100;
        if (!best || g > best.pct) return { cat: c, pct: g };
      }
      return best;
    },
    null,
  );
  if (maxGrowth != null && maxGrowth.pct > 15) {
    lines.push(
      `${CATEGORY_LABELS[maxGrowth.cat]} is your fastest-growing category vs last month (+${maxGrowth.pct.toFixed(0)}%).`,
    );
  }

  const subCount = state.subscriptions.length;
  const subTotal = subscriptionsMonthlyTotal(state.subscriptions);
  if (subCount > 0) {
    lines.push(`You have ${subCount} recurring subscriptions totaling ~$${subTotal.toFixed(0)}/month — audit unused apps.`);
  }

  const saved = income - totalOutflowInMonth(state, thisYm);
  if (saved > 200) {
    lines.push(`You saved about $${saved.toFixed(0)} this month after expenses — consider routing part to Invest.`);
  }

  return lines.slice(0, 8);
}

export function budgetAlerts(state: TrackFinanceState, yMonth: string): string[] {
  const byCat = categoryTotalsWithRecurring(state, yMonth);
  const alerts: string[] = [];
  for (const b of state.budgets) {
    const actual = byCat[b.category];
    if (actual > b.monthlyLimit) {
      const over = ((actual - b.monthlyLimit) / b.monthlyLimit) * 100;
      alerts.push(`You are ${over.toFixed(0)}% over budget in ${CATEGORY_LABELS[b.category].toLowerCase()}.`);
    }
  }
  return alerts;
}

export function whatIfInvestMonthly(
  monthlyContribution: number,
  annualReturnPct: number,
  years: number,
): number {
  const r = annualReturnPct / 100 / 12;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r <= 0) return monthlyContribution * n;
  return monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
}
