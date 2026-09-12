import { useUser } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { FINHACK_INVESTMENT_PREFS_KEY, parseInvestmentPrefs } from "../lib/investmentPreferences";

/**
 * Redirects to `/onboarding` until investment prefs are marked complete.
 * Mount `/onboarding` as a sibling route outside this wrapper.
 */
export function RequireOnboarding() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading your profile…</p>
      </div>
    );
  }

  const raw = user?.unsafeMetadata?.[FINHACK_INVESTMENT_PREFS_KEY];
  const prefs = parseInvestmentPrefs(raw);

  if (!prefs.onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
