import { useAuth } from "@clerk/clerk-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import {
  ClerkSignInPage,
  ClerkSignUpPage,
  useClerkEnabled,
} from "./components/ClerkAuth";
import { RequireAuth } from "./components/RequireAuth";
import { Market } from "./pages/Market";
import { Alerts } from "./pages/Alerts";
import { Settings } from "./pages/Settings";
import { PaperTrading } from "./pages/PaperTrading";
import { Insights } from "./pages/Insights";
import { Learn } from "./pages/Learn";
import { CommodityLens } from "./pages/CommodityLens";
import { Welcome } from "./pages/Welcome";
import { RealPortfolio } from "./pages/RealPortfolio";
import { Trading } from "./pages/Trading";
import { Onboarding } from "./pages/Onboarding";
import { RequireOnboarding } from "./components/RequireOnboarding";
import {
  TrackBudget,
  TrackCashFlow,
  TrackGoals,
  TrackMortgage,
  TrackOverview,
  TrackSpending,
  TrackSubscriptions,
  TrackTaxes,
  TrackWhatIf,
} from "./pages/track";

function WelcomeOrRedirect() {
  const clerkOn = useClerkEnabled();
  if (!clerkOn) {
    return <Welcome />;
  }
  return <WelcomeOrRedirectAuthed />;
}

function WelcomeOrRedirectAuthed() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }
  if (isSignedIn) {
    return <Navigate to="/invest/pulse" replace />;
  }
  return <Welcome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomeOrRedirect />} />
        <Route path="/sign-in/*" element={<ClerkSignInPage />} />
        <Route path="/sign-up/*" element={<ClerkSignUpPage />} />
        <Route element={<RequireAuth />}>
          <Route path="onboarding" element={<Onboarding />} />
          <Route element={<RequireOnboarding />}>
            <Route element={<Layout />}>
              <Route path="invest/pulse" element={<Market />} />
              <Route path="invest/portfolio" element={<RealPortfolio />} />
              <Route path="invest/paper-lab" element={<PaperTrading />} />
              <Route path="invest/trading" element={<Trading />} />
              <Route path="invest/macro-regime" element={<CommodityLens />} />
              <Route path="invest/commodities" element={<Navigate to="/invest/macro-regime" replace />} />
              <Route path="invest/insights" element={<Insights />} />
              <Route path="invest/ai" element={<Navigate to="/invest/insights" replace />} />
              <Route path="invest/learn" element={<Learn />} />
              <Route path="invest/alerts" element={<Alerts />} />
              <Route path="track/overview" element={<TrackOverview />} />
              <Route path="track/spending" element={<TrackSpending />} />
              <Route path="track/budget" element={<TrackBudget />} />
              <Route path="track/cash-flow" element={<TrackCashFlow />} />
              <Route path="track/subscriptions" element={<TrackSubscriptions />} />
              <Route path="track/goals" element={<TrackGoals />} />
              <Route path="track/mortgage" element={<TrackMortgage />} />
              <Route path="track/taxes" element={<TrackTaxes />} />
              <Route path="track/what-if" element={<TrackWhatIf />} />
              <Route path="settings" element={<Settings />} />
              <Route path="market" element={<Navigate to="/invest/pulse" replace />} />
              <Route path="trade" element={<Navigate to="/invest/trading" replace />} />
              <Route path="trading" element={<Navigate to="/invest/trading" replace />} />
              <Route path="news" element={<Navigate to="/invest/pulse" replace />} />
              <Route path="dashboard" element={<Navigate to="/invest/pulse" replace />} />
              <Route path="pulse" element={<Navigate to="/invest/pulse" replace />} />
              <Route path="portfolio" element={<Navigate to="/invest/portfolio" replace />} />
              <Route path="paper-lab" element={<Navigate to="/invest/paper-lab" replace />} />
              <Route path="macro-regime" element={<Navigate to="/invest/macro-regime" replace />} />
              <Route path="commodities" element={<Navigate to="/invest/macro-regime" replace />} />
              <Route path="insights" element={<Navigate to="/invest/insights" replace />} />
              <Route path="ai" element={<Navigate to="/invest/insights" replace />} />
              <Route path="learn" element={<Navigate to="/invest/learn" replace />} />
              <Route path="alerts" element={<Navigate to="/invest/alerts" replace />} />
              <Route path="track" element={<Navigate to="/track/overview" replace />} />
              <Route path="invest" element={<Navigate to="/invest/pulse" replace />} />
              <Route path="*" element={<Navigate to="/invest/pulse" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
