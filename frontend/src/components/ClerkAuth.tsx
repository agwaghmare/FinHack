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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
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
      <ClerkProvider publishableKey={pk} afterSignOutUrl="/" signInFallbackRedirectUrl="/pulse" signUpFallbackRedirectUrl="/pulse">
        <TokenBridge />
        {children}
      </ClerkProvider>
    </ClerkEnabledContext.Provider>
  );
}

export function ClerkSignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4">
      <div className="max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">FutureSight</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
          Build your future with us
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Start investing early and secure your future with FutureSight.
        </p>
      </div>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/pulse"
        forceRedirectUrl="/pulse"
      />
    </div>
  );
}

export function ClerkSignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4">
      <div className="max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">FutureSight</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
          Build your future with us
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Start investing early and secure your future with FutureSight.
        </p>
      </div>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/pulse"
        forceRedirectUrl="/pulse"
      />
    </div>
  );
}

export function useClerkEnabled() {
  return useContext(ClerkEnabledContext);
}
