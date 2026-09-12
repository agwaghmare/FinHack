import { ClerkProvider, useAuth, SignIn, SignUp } from "@clerk/clerk-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setClerkTokenGetter } from "../lib/api";

export const ClerkEnabledContext = createContext(false);

const apiBase =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001";

function TokenBridge() {
  const { getToken, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    setClerkTokenGetter(() => getToken());
    return () => setClerkTokenGetter(null);
  }, [getToken, isLoaded]);
  return null;
}

async function resolvePublishableKey(): Promise<string> {
  const env = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  if (env?.startsWith("pk_")) return env;
  try {
    const r = await fetch(`${apiBase}/auth/clerk-config`);
    const d = (await r.json()) as { publishable_key?: string };
    if (d.publishable_key?.startsWith("pk_")) return d.publishable_key;
  } catch {
    /* ignore */
  }
  return "";
}

export function ClerkAuthRoot({ children }: { children: ReactNode }) {
  const [pk, setPk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const k = await resolvePublishableKey();
      if (!cancelled) setPk(k || "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (pk === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!pk) {
    return (
      <ClerkEnabledContext.Provider value={false}>
        {children}
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-500/30 bg-amber-950/90 px-4 py-3 text-xs text-amber-200 shadow-lg">
          Set{" "}
          <code className="rounded bg-black/30 px-1">VITE_CLERK_PUBLISHABLE_KEY</code>{" "}
          in <code className="rounded bg-black/30 px-1">frontend/.env</code> (same value as{" "}
          <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
          in the API <code className="rounded bg-black/30 px-1">.env</code>) or expose it via{" "}
          <code className="rounded bg-black/30 px-1">GET /auth/clerk-config</code>.
        </div>
      </ClerkEnabledContext.Provider>
    );
  }

  return (
    <ClerkEnabledContext.Provider value={true}>
      <ClerkProvider
        publishableKey={pk}
        afterSignOutUrl="/"
        signInFallbackRedirectUrl="/invest/pulse"
        signUpFallbackRedirectUrl="/onboarding"
      >
        <TokenBridge />
        {children}
      </ClerkProvider>
    </ClerkEnabledContext.Provider>
  );
}

export function ClerkSignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-violet-100 dark:from-zinc-950 dark:via-black dark:to-emerald-950/50" />
        <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-600/20" />
        <div className="absolute right-1/4 bottom-20 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-600/20" />
      </div>
      <div className="glass max-w-xl rounded-2xl p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400/90">FinSight</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Build your future with us
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Start investing early and secure your future with FinSight.
        </p>
      </div>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/invest/pulse"
        forceRedirectUrl="/invest/pulse"
      />
    </div>
  );
}

export function ClerkSignUpPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-violet-100 dark:from-zinc-950 dark:via-black dark:to-emerald-950/50" />
        <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-600/20" />
        <div className="absolute right-1/4 bottom-20 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-600/20" />
      </div>
      <div className="glass max-w-xl rounded-2xl p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400/90">FinSight</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Build your future with us
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Start investing early and secure your future with FinSight.
        </p>
      </div>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
        forceRedirectUrl="/onboarding"
      />
    </div>
  );
}

export function useClerkEnabled() {
  return useContext(ClerkEnabledContext);
}
