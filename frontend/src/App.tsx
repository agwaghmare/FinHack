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
import { Onboarding } from "./pages/Onboarding";
import { RequireOnboarding } from "./components/RequireOnboarding";

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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }
  if (isSignedIn) {
    return <Navigate to="/pulse" replace />;
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
              <Route path="pulse" element={<Market />} />
              <Route path="portfolio" element={<RealPortfolio />} />
              <Route path="paper-lab" element={<PaperTrading />} />
              <Route path="macro-regime" element={<CommodityLens />} />
              <Route path="commodities" element={<Navigate to="/macro-regime" replace />} />
              <Route path="insights" element={<Insights />} />
              <Route path="ai" element={<Navigate to="/insights" replace />} />
              <Route path="learn" element={<Learn />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="settings" element={<Settings />} />
              <Route path="market" element={<Navigate to="/pulse" replace />} />
              <Route path="trade" element={<Navigate to="/paper-lab" replace />} />
              <Route path="dashboard" element={<Navigate to="/pulse" replace />} />
              <Route path="news" element={<Navigate to="/pulse" replace />} />
              <Route path="*" element={<Navigate to="/pulse" replace />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
