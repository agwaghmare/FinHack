import { useState } from "react";
import { HelpCircle, Loader2, X } from "lucide-react";
import { api } from "../lib/api";

type ExplainResp = {
  mode?: string;
  explanation?: string;
  what_it_is?: string;
  why_it_moves?: string;
  what_it_means_for_you?: string;
};

type Props = {
  context: Record<string, unknown>;
  label?: string;
  className?: string;
};

export function WhyMattersButton({ context, label = "Why this matters", className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExplainResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = (await api.explainWhy(context)) as ExplainResp;
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load explanation");
    } finally {
      setLoading(false);
    }
  }

  function openSheet() {
    setOpen(true);
    void load();
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openSheet();
        }}
        title="Plain-English explanation"
        className={
          className ??
          "inline-flex items-center gap-1 rounded-full border border-zinc-600/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 hover:border-zinc-400 hover:text-white"
        }
      >
        <HelpCircle className="h-3 w-3" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Why this matters</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Educational only — not investment advice. Add GEMINI_API_KEY for richer AI phrasing.
            </p>

            {loading && (
              <div className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Building explanation…
              </div>
            )}
            {err && (
              <p className="mt-4 text-sm text-amber-400">{err}</p>
            )}
            {!loading && !err && data && (
              <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
                {data.explanation ? (
                  <div className="whitespace-pre-wrap text-zinc-200">{data.explanation}</div>
                ) : (
                  <>
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        What it is
                      </h4>
                      <p className="mt-1">{data.what_it_is}</p>
                    </section>
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Why it moves
                      </h4>
                      <p className="mt-1">{data.why_it_moves}</p>
                    </section>
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        What it means for you
                      </h4>
                      <p className="mt-1">{data.what_it_means_for_you}</p>
                    </section>
                  </>
                )}
                {data.mode && (
                  <p className="text-[10px] text-zinc-600">Mode: {data.mode}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
