import { useUser } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { InvestmentPreferencesFields } from "../components/InvestmentPreferencesFields";
import {
  FINHACK_INVESTMENT_PREFS_KEY,
  type InvestmentPrefs,
  type InvestmentStyleId,
  type RiskToleranceId,
  parseInvestmentPrefs,
} from "../lib/investmentPreferences";

export function Onboarding() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<InvestmentPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setPrefs(parseInvestmentPrefs(user.unsafeMetadata?.[FINHACK_INVESTMENT_PREFS_KEY]));
  }, [user]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-100 via-white to-zinc-100 dark:from-black dark:via-zinc-950 dark:to-black">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const existing = parseInvestmentPrefs(user.unsafeMetadata?.[FINHACK_INVESTMENT_PREFS_KEY]);
  if (existing.onboardingComplete) {
    return <Navigate to="/pulse" replace />;
  }

  const working = prefs ?? existing;

  function setRisk(id: RiskToleranceId) {
    setPrefs((p) => ({ ...(p ?? working), riskTolerance: id }));
  }

  function toggleStyle(id: InvestmentStyleId) {
    setPrefs((p) => {
      const base = p ?? working;
      const next = new Set(base.styles);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...base, styles: [...next] };
    });
  }

  async function saveAndExit(next: InvestmentPrefs) {
    if (!user) return;
    setSaving(true);
    setErr(null);
    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          [FINHACK_INVESTMENT_PREFS_KEY]: next,
        },
      });
      navigate("/pulse", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    const risk = prefs?.riskTolerance ?? working.riskTolerance;
    if (!risk) {
      setErr("Please select a risk tolerance to continue.");
      return;
    }
    const next: InvestmentPrefs = {
      ...working,
      ...(prefs ?? {}),
      riskTolerance: risk,
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };
    await saveAndExit(next);
  }

  async function handleSkip() {
    const next: InvestmentPrefs = {
      ...working,
      ...(prefs ?? {}),
      riskTolerance: prefs?.riskTolerance ?? working.riskTolerance ?? "moderate",
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };
    await saveAndExit(next);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-white to-zinc-100 dark:from-black dark:via-zinc-950 dark:to-black">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Welcome</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Tailor FinSight to you
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">
            Set your risk comfort and style preferences. We use this for education, framing, and examples — not
            as financial advice. You can update these anytime in Settings.
          </p>
        </header>

        <div className="glass rounded-2xl p-6 shadow-xl dark:shadow-black/40">
          <InvestmentPreferencesFields
            riskTolerance={prefs?.riskTolerance ?? working.riskTolerance}
            styles={prefs?.styles ?? working.styles}
            onRiskChange={setRisk}
            onToggleStyle={toggleStyle}
            disabled={saving}
          />

          {err ? (
            <p className="mt-6 text-sm text-amber-700 dark:text-amber-200" role="alert">
              {err}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSkip()}
              className="order-2 text-center text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300 sm:order-1"
            >
              Skip for now (use defaults)
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleContinue()}
              className="order-1 inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900 sm:order-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save &amp; continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
