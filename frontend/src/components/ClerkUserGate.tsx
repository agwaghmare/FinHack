import { useUser } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useClerkEnabled } from "./ClerkAuth";

type Props = { children: (userId: string) => ReactNode };

/**
 * Renders `children` with a stable user id. When Clerk is not configured,
 * uses "demo" without calling `useUser` (which would throw outside ClerkProvider).
 */
export function ClerkUserGate({ children }: Props) {
  const clerkOn = useClerkEnabled();
  if (!clerkOn) {
    return <>{children("demo")}</>;
  }
  return <ClerkUserInner>{children}</ClerkUserInner>;
}

function ClerkUserInner({ children }: Props) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        <p>Loading account…</p>
      </div>
    );
  }
  return <>{children(user?.id ?? "demo")}</>;
}
