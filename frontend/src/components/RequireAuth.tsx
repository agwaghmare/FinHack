import { useAuth } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";
import { useClerkEnabled } from "./ClerkAuth";

/**
 * When Clerk is configured, only signed-in users may access nested routes.
 * When Clerk is not configured, visitors stay on the public marketing pages.
 */
export function RequireAuth() {
  const clerkOn = useClerkEnabled();
  if (!clerkOn) {
    return <Navigate to="/" replace />;
  }
  return <RequireAuthInner />;
}

function RequireAuthInner() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Checking your session…</p>
      </div>
    );
  }
  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
