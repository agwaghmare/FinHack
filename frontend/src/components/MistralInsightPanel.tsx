import type { ReactNode } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";

/** Light formatting for Mistral markdown-ish replies (**bold**, bullets, numbered lists). */
export function MistralFormattedText({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-4">
      {blocks.map((block, bi) => {
        const rawLines = block.split("\n");
        const lines = rawLines.map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;

        const trimmed = lines.map((l) => l.trim());
        const allBullets = trimmed.every(
          (l) => /^[-*•]\s/.test(l) || /^[-*•]\s*\*\*/.test(l),
        );
        if (allBullets && trimmed.length > 0) {
          return (
            <ul
              key={bi}
              className="space-y-2.5 border-l-2 border-zinc-300/80 pl-4 dark:border-zinc-600"
            >
              {trimmed.map((l, i) => (
                <li
                  key={i}
                  className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200"
                >
                  <span className="mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 align-middle dark:bg-zinc-500" />
                  {formatInlineBold(l.replace(/^[-*•]\s*/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        const allNumbered = trimmed.every((l) => /^\d+\.\s/.test(l));
        if (allNumbered && trimmed.length > 1) {
          return (
            <ol
              key={bi}
              className="list-decimal space-y-2.5 pl-5 text-[13px] leading-relaxed text-zinc-700 marker:text-zinc-500 dark:text-zinc-200 dark:marker:text-zinc-400"
            >
              {trimmed.map((l, i) => (
                <li key={i} className="pl-1">
                  {formatInlineBold(l.replace(/^\d+\.\s*/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        const first = trimmed[0];
        if (first.startsWith("### ")) {
          return (
            <h4
              key={bi}
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              {formatInlineBold(first.slice(4))}
            </h4>
          );
        }
        if (first.startsWith("## ")) {
          return (
            <h3
              key={bi}
              className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              {formatInlineBold(first.slice(3))}
            </h3>
          );
        }
        if (first.startsWith("# ")) {
          return (
            <h3
              key={bi}
              className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              {formatInlineBold(first.slice(2))}
            </h3>
          );
        }

        return (
          <p
            key={bi}
            className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200"
          >
            {formatInlineBold(block.trim())}
          </p>
        );
      })}
    </div>
  );
}

function formatInlineBold(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong
          key={i}
          className="font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

type Variant = "violet" | "sky";

const variantStyles: Record<
  Variant,
  {
    shell: string;
    glow: string;
    iconBg: string;
    badge: string;
    contentWell: string;
  }
> = {
  violet: {
    shell:
      "border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] via-zinc-50/90 to-white dark:from-violet-950/40 dark:via-zinc-950/80 dark:to-zinc-950",
    glow: "from-violet-500/25 via-fuchsia-500/10 to-transparent",
    iconBg:
      "bg-violet-500/15 text-violet-600 ring-violet-500/35 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-violet-400/30",
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:border-violet-400/25 dark:bg-violet-500/15 dark:text-violet-200",
    contentWell:
      "glass-inset border-violet-500/20 shadow-inner",
  },
  sky: {
    shell:
      "border-sky-500/25 bg-gradient-to-br from-sky-500/[0.07] via-zinc-50/90 to-white dark:from-sky-950/35 dark:via-zinc-950/80 dark:to-zinc-950",
    glow: "from-sky-500/20 via-indigo-500/10 to-transparent",
    iconBg:
      "bg-sky-500/15 text-sky-600 ring-sky-500/35 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-400/30",
    badge:
      "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:border-sky-400/25 dark:bg-sky-500/15 dark:text-sky-100",
    contentWell:
      "glass-inset border-sky-500/20 shadow-inner",
  },
};

type MistralInsightPanelProps = {
  id?: string;
  title: string;
  subtitle: string;
  variant: Variant;
  action?: ReactNode;
  isLoading: boolean;
  hasContent: boolean;
  error?: string | null;
  children: ReactNode;
  emptyHint: string;
  updatingHint?: string;
};

export function MistralInsightPanel({
  id,
  title,
  subtitle,
  variant,
  action,
  isLoading,
  hasContent,
  error,
  children,
  emptyHint,
  updatingHint = "Refreshing…",
}: MistralInsightPanelProps) {
  const v = variantStyles[variant];
  const showUpdating = isLoading && hasContent;

  return (
    <section
      id={id}
      className={`relative scroll-mt-24 overflow-hidden rounded-2xl border p-0 shadow-lg shadow-zinc-900/5 dark:shadow-black/40 ${v.shell}`}
    >
      <div
        className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br ${v.glow} blur-3xl`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-gradient-to-tr ${v.glow} blur-3xl opacity-60`}
        aria-hidden
      />

      <div className="relative p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${v.iconBg}`}
            >
              <Bot className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                  {title}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${v.badge}`}
                >
                  <Sparkles className="h-3 w-3 opacity-80" />
                  Mistral AI
                </span>
                {showUpdating ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {updatingHint}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {subtitle}
              </p>
            </div>
          </div>
          {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-100">
            {error}
          </div>
        ) : null}

        <div
          className={`mt-6 rounded-2xl border p-5 sm:p-6 ${v.contentWell}`}
        >
          {isLoading && !hasContent ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80">
                <Loader2 className="h-7 w-7 animate-spin text-zinc-500 dark:text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Generating insight…
              </p>
              <p className="max-w-xs text-xs text-zinc-500">
                Mistral is reading your portfolio context. This usually takes a few seconds.
              </p>
            </div>
          ) : hasContent ? (
            <div className="prose-mistral max-w-none">{children}</div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyHint}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
