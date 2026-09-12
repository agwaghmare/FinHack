import type { InvestmentStyleId, RiskToleranceId } from "../lib/investmentPreferences";
import { RISK_OPTIONS, STYLE_OPTIONS } from "../lib/investmentPreferences";

type Props = {
  riskTolerance: RiskToleranceId | null;
  styles: InvestmentStyleId[];
  onRiskChange: (id: RiskToleranceId) => void;
  onToggleStyle: (id: InvestmentStyleId) => void;
  disabled?: boolean;
  /** Extra class on the outer wrapper */
  className?: string;
};

export function InvestmentPreferencesFields({
  riskTolerance,
  styles,
  onRiskChange,
  onToggleStyle,
  disabled,
  className = "",
}: Props) {
  const styleSet = new Set(styles);

  return (
    <div className={`space-y-8 ${className}`}>
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Risk tolerance</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          This shapes how we frame volatility and position sizing in education and tools — not personalized
          investment advice.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {RISK_OPTIONS.map((r) => {
            const checked = riskTolerance === r.id;
            return (
              <label
                key={r.id}
                className={`flex cursor-pointer flex-col rounded-xl border p-4 transition ${
                  checked
                    ? "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-white/10 dark:hover:border-zinc-600"
                } ${disabled ? "pointer-events-none opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="risk-tolerance"
                    className="mt-1"
                    checked={checked}
                    onChange={() => onRiskChange(r.id)}
                    disabled={disabled}
                  />
                  <span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.label}</span>
                    <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-500">{r.description}</span>
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Investment style focus</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Choose any that apply. We use this to tune summaries and examples — you can change it anytime in
          Settings.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {STYLE_OPTIONS.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                styleSet.has(s.id)
                  ? "border-amber-500/50 bg-amber-500/5"
                  : "border-zinc-200 bg-white dark:border-white/10"
              } ${disabled ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-zinc-500"
                checked={styleSet.has(s.id)}
                onChange={() => onToggleStyle(s.id)}
                disabled={disabled}
              />
              <span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.label}</span>
                {s.hint ? (
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-500">{s.hint}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
