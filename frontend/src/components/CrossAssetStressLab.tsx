import { FlaskConical, Lock } from "lucide-react";
import {
  type CrossAssetStressLabModel,
  type LockMode,
  useCrossAssetStressLab,
} from "../hooks/useCrossAssetStressLab";
import { ETF_AG_PROXIES } from "../lib/crossAssetStress";

export { useCrossAssetStressLab } from "../hooks/useCrossAssetStressLab";

const MODES: { id: LockMode; label: string; hint: string }[] = [
  { id: "all", label: "All three", hint: "Move oil, USD, and rates together." },
  { id: "usd_rates", label: "USD + rates", hint: "Oil shock held flat (0%)." },
  { id: "oil_usd", label: "Oil + USD", hint: "Policy rate shock held flat (0 bp)." },
  { id: "oil_rates", label: "Oil + rates", hint: "USD strength held flat (neutral)." },
];

type Variant = "page" | "sidebar";

type Props = {
  variant?: Variant;
  model: CrossAssetStressLabModel;
  /** Anchor id (page layout only; one per page for #hash links). */
  anchorId?: string;
};

/** Use with `useCrossAssetStressLab()` when you need a single shared state (e.g. sidebar + main). */
export function CrossAssetStressLab({ variant = "page", model, anchorId }: Props) {
  const compact = variant === "sidebar";
  const {
    loading,
    locked,
    lockMode,
    setLockMode,
    oilShock,
    setOilShock,
    usdShock,
    setUsdShock,
    ratesShock,
    setRatesShock,
    scenario,
  } = model;

  return (
    <section
      id={compact ? undefined : anchorId ?? "cross-asset-stress"}
      className={`scroll-mt-24 rounded-2xl border border-amber-500/20 dark:border-amber-500/15 ${
        compact
          ? "w-full max-w-[240px] bg-gradient-to-b from-amber-500/[0.06] to-zinc-900/40 p-3 shadow-lg shadow-black/20"
          : "bg-gradient-to-br from-amber-500/[0.06] to-zinc-900/40 p-5"
      }`}
    >
      <div className={`flex gap-2 ${compact ? "flex-col items-stretch" : "flex-wrap items-start gap-3"}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 ${
            compact ? "h-9 w-9 self-center" : "h-10 w-10"
          }`}
        >
          <FlaskConical className={`text-amber-500 ${compact ? "h-4 w-4" : "h-5 w-5"}`} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold uppercase tracking-wide text-zinc-500 ${compact ? "text-[10px]" : "text-sm"}`}>
            Cross-asset stress lab
          </h2>
          <p
            className={`leading-relaxed text-zinc-600 dark:text-zinc-400 ${
              compact ? "mt-1 text-[10px] leading-snug" : "mt-1 text-xs"
            }`}
          >
            Illustrative stress: oil (%), USD strength (rank), policy rate shock (bp). Not a model of your book — a
            teaching layer for cross-asset intuition. Choose which two factors to explore; the rest stay at baseline.
          </p>
        </div>
      </div>

      <p className={`mt-3 font-medium uppercase tracking-wide text-zinc-500 ${compact ? "text-[9px]" : "mt-4 text-[11px]"}`}>
        What moves?
      </p>
      <div className={compact ? "mt-1.5 flex flex-col gap-1.5" : "mt-2 flex flex-wrap gap-2"}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setLockMode(m.id)}
            title={m.hint}
            className={`border text-left transition ${
              compact
                ? "rounded-lg px-2 py-1.5 text-[10px] font-semibold leading-tight"
                : "rounded-full px-3 py-1.5 text-xs font-semibold"
            } ${
              lockMode === m.id
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                : "border-zinc-600 bg-zinc-950/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {lockMode !== "all" ? (
        <p
          className={`mt-2 flex gap-1.5 text-zinc-500 ${compact ? "items-start text-[9px] leading-snug" : "items-center text-[11px]"}`}
        >
          <Lock className={`shrink-0 text-amber-500/80 ${compact ? "mt-0.5 h-2.5 w-2.5" : "h-3 w-3"}`} aria-hidden />
          Locked inputs stay at zero shock (baseline). Switch mode to change which sliders are active.
        </p>
      ) : null}

      <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-1" : "gap-4 sm:grid-cols-2 lg:grid-cols-3"}`}>
        <SliderRow
          compact={compact}
          label="Oil shock (%)"
          min={-30}
          max={40}
          value={locked.oil ? 0 : oilShock}
          disabled={locked.oil}
          accent="zinc"
          low="-30%"
          high="+40%"
          onChange={(v) => setOilShock(v)}
        />
        <SliderRow
          compact={compact}
          label="USD strength (rank units)"
          min={-20}
          max={20}
          value={locked.usd ? 0 : usdShock}
          disabled={locked.usd}
          accent="amber"
          low="Weaker USD"
          high="Stronger USD"
          onChange={(v) => setUsdShock(v)}
        />
        <SliderRow
          compact={compact}
          label="Policy rate shock (bp)"
          min={-50}
          max={100}
          value={locked.rates ? 0 : ratesShock}
          disabled={locked.rates}
          accent="emerald"
          low="-50 bp"
          high="+100 bp"
          onChange={(v) => setRatesShock(v)}
        />
      </div>

      <dl className={`mt-4 grid gap-2 text-sm ${compact ? "grid-cols-1" : "mt-6 grid-cols-2 lg:grid-cols-3"}`}>
        <div className={`rounded-xl border border-zinc-700/80 bg-zinc-950/50 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
          <dt className={`font-medium uppercase tracking-wide text-zinc-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            Stressed WTI
          </dt>
          <dd className={`mt-0.5 font-semibold tabular-nums text-zinc-100 ${compact ? "text-sm" : ""}`}>
            {loading ? "…" : `$${scenario.stressedOil.toFixed(2)}`}
          </dd>
        </div>
        <div className={`rounded-xl border border-zinc-700/80 bg-zinc-950/50 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
          <dt className={`font-medium uppercase tracking-wide text-zinc-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            Energy-heavy proxy (100)
          </dt>
          <dd className={`mt-0.5 font-semibold tabular-nums text-zinc-100 ${compact ? "text-sm" : ""}`}>
            {scenario.portfolioProxy.toFixed(1)}
          </dd>
        </div>
        <div className={`rounded-xl border border-zinc-700/80 bg-zinc-950/50 ${compact ? "px-2 py-1.5" : "px-3 py-2 sm:col-span-2 lg:col-span-1"}`}>
          <dt className={`font-medium uppercase tracking-wide text-zinc-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            Ag/USD-sensitive proxy (100)
          </dt>
          <dd className={`mt-0.5 font-semibold tabular-nums text-zinc-100 ${compact ? "text-sm" : ""}`}>
            {scenario.agProxy.toFixed(1)}
          </dd>
        </div>
      </dl>
      <p className={`leading-relaxed text-zinc-500 ${compact ? "mt-2 text-[8px] leading-snug" : "mt-3 text-[10px]"}`}>
        Proxies: {ETF_AG_PROXIES.join(", ")} — corn and soybeans often trade via futures or sector ETFs; ethanol
        linkage is one channel among many.
      </p>
    </section>
  );
}

/** Self-contained lab (fetches data, internal state) — use when only one instance is mounted. */
export function CrossAssetStressLabStandalone(props: Omit<Props, "model">) {
  const stressModel = useCrossAssetStressLab();
  return <CrossAssetStressLab {...props} model={stressModel} />;
}

function SliderRow({
  compact,
  label,
  min,
  max,
  value,
  disabled,
  accent,
  low,
  high,
  onChange,
}: {
  compact?: boolean;
  label: string;
  min: number;
  max: number;
  value: number;
  disabled: boolean;
  accent: "zinc" | "amber" | "emerald";
  low: string;
  high: string;
  onChange: (n: number) => void;
}) {
  const accentClass =
    accent === "amber" ? "accent-amber-600" : accent === "emerald" ? "accent-emerald-600" : "accent-zinc-400";
  return (
    <label
      className={`flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/40 ${
        compact ? "gap-1 p-2" : "gap-2 p-3"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`font-semibold uppercase tracking-wide text-zinc-500 ${compact ? "text-[8px] leading-tight" : "text-[10px]"}`}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accentClass} ${disabled ? "cursor-not-allowed" : ""}`}
      />
      <div className={`flex justify-between text-zinc-500 ${compact ? "text-[8px]" : "text-[10px]"}`}>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </label>
  );
}
