import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen, ExternalLink, Loader2, Mic, Trophy } from "lucide-react";
import { api, postLearnModuleAudio } from "../lib/api";
import { ClerkUserGate } from "../components/ClerkUserGate";

type ModuleItem = {
  id: string;
  title: string;
  summary?: string;
  duration_min?: number;
  topics?: string[];
  question_count?: number;
};

type QuizQuestion = { q?: string; prompt?: string; options?: string[] };

const investopediaLinks: Record<string, { label: string; url: string }[]> = {
  "market-basics": [
    { label: "ETF explained", url: "https://www.investopedia.com/terms/e/etf.asp" },
    { label: "Liquidity basics", url: "https://www.investopedia.com/terms/l/liquidity.asp" },
  ],
  "macro-trends": [
    { label: "Inflation guide", url: "https://www.investopedia.com/terms/i/inflation.asp" },
    { label: "Interest rates", url: "https://www.investopedia.com/terms/i/interestrate.asp" },
  ],
  "risk-management": [
    { label: "Diversification", url: "https://www.investopedia.com/terms/d/diversification.asp" },
    { label: "Position sizing", url: "https://www.investopedia.com/terms/p/positionsize.asp" },
  ],
  "news-sentiment": [
    { label: "Sentiment analysis", url: "https://www.investopedia.com/terms/s/sentimentindicator.asp" },
  ],
  "paper-trading": [
    { label: "Paper trading", url: "https://www.investopedia.com/terms/p/papertrade.asp" },
  ],
};

function LearnContent({ userId }: { userId: string }) {
  const location = useLocation();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModuleItem | null>(null);
  const [quiz, setQuiz] = useState<{ questions?: QuizQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitResult, setSubmitResult] = useState<unknown>(null);
  const [cert, setCert] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [audioBusy, setAudioBusy] = useState<string | null>(null);

  useEffect(() => {
    api
      .learnModules()
      .then((r) => {
        const list = (r as { modules?: ModuleItem[] }).modules ?? [];
        setModules(list);
        if (list[0]) setSelected(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSubmitResult(null);
    setCert(null);
    Promise.all([api.learnModule(selected), api.learnQuiz(selected)]).then(
      ([d, q]) => {
        setDetail(d as ModuleItem);
        setQuiz(q as { questions?: QuizQuestion[] });
        const n = (q as { questions?: QuizQuestion[] }).questions?.length ?? 0;
        setAnswers(Array.from({ length: n }, () => 0));
      },
    );
  }, [selected]);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [location.hash]);

  async function submitQuiz() {
    if (!selected) return;
    const res = await api.learnSubmitQuiz(selected, answers);
    setSubmitResult(res);
  }

  async function fetchCert() {
    if (!selected) return;
    const c = await api.learnCertificate(userId, selected);
    setCert(c);
  }

  async function playModuleAudio(mid: string) {
    setAudioBusy(mid);
    try {
      const out = await postLearnModuleAudio(mid);
      if (out instanceof Blob) {
        const url = URL.createObjectURL(out);
        const a = new Audio(url);
        a.play();
        a.onended = () => URL.revokeObjectURL(url);
      } else if (out && "error" in out && out.error) {
        const u = new SpeechSynthesisUtterance(
          "TTS unavailable. Configure ElevenLabs or read the module text.",
        );
        window.speechSynthesis.speak(u);
      }
    } finally {
      setAudioBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Learn
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Modules & quizzes
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Learn with short modules, quick quizzes, and simple certificates.
        </p>
      </header>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Videos to watch</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Introductory explainers (YouTube — opens in a new tab).
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {[
            {
              label: "Khan Academy: finance & capital markets (playlist)",
              url: "https://www.youtube.com/playlist?list=PL8FB14A2200B87185",
            },
            {
              label: "SEC: introduction to investing",
              url: "https://www.investor.gov/introduction-investing",
            },
            {
              label: "CFA Institute: markets explained (topic hub)",
              url: "https://www.cfainstitute.org/en/research/financial-analytics",
            },
          ].map((v) => (
            <li key={v.url}>
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
              >
                {v.label}
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Podcasts & columnists
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Independent voices — not affiliated with FinSight.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <a
              href="https://www.schwab.com/learn/story"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-300"
            >
              Schwab Learn <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>{" "}
            — plain-English articles and explainers.
          </li>
          <li>
            <a
              href="https://www.goldmansachs.com/insights/goldman-sachs-exchanges"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-300"
            >
              Goldman Sachs Exchanges (podcast) <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </li>
          <li>
            Spencer Jakab —{" "}
            <a
              href="https://www.wsj.com/news/author/spencer-jakab"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-300"
            >
              WSJ columns & articles <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </li>
        </ul>
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading modules…
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div id="modules" className="scroll-mt-24 space-y-2">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m.id)}
              className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                selected === m.id
                  ? "border-zinc-200 bg-zinc-900 text-white dark:border-zinc-700"
                  : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
              }`}
            >
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
              <span className="flex-1">{m.title}</span>
              {typeof m.question_count === "number" && (
                <span className="text-[10px] tabular-nums text-zinc-500">{m.question_count} qs</span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Module</h2>
              {selected && (
                <button
                  type="button"
                  disabled={!!audioBusy}
                  onClick={() => playModuleAudio(selected)}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200"
                >
                  {audioBusy === selected ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  Listen
                </button>
              )}
            </div>
            {detail ? (
              <div className="mt-4 space-y-4 text-sm text-zinc-300">
                <p className="text-lg font-semibold text-white">{detail.title}</p>
                <p className="leading-relaxed text-zinc-400">{detail.summary}</p>
                {typeof detail.duration_min === "number" && (
                  <p className="text-xs text-zinc-500">Estimated time: {detail.duration_min} minutes</p>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Key topics
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(detail.topics ?? []).map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Recommended reading
                  </p>
                  <div className="space-y-2">
                    {(investopediaLinks[detail.id] ?? []).map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200"
                      >
                        {link.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Select a module to begin.</p>
            )}
          </div>

          <div id="quiz" className="glass scroll-mt-24 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white">Quiz</h2>
            <div className="mt-4 space-y-4">
              {(quiz?.questions ?? []).map((qq, i) => {
                return (
                  <div key={i} className="rounded-xl border border-zinc-800 p-4">
                    <p className="text-sm text-zinc-200">{qq.q ?? qq.prompt}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(qq.options ?? []).map((opt, j) => (
                        <label
                          key={j}
                          className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400"
                        >
                          <input
                            type="radio"
                            name={`q-${i}`}
                            checked={answers[i] === j}
                            onChange={() => {
                              const next = [...answers];
                              next[i] = j;
                              setAnswers(next);
                            }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitQuiz}
                className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-900 dark:bg-white"
              >
                Submit answers
              </button>
              <button
                type="button"
                onClick={fetchCert}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-600 px-4 py-2 text-xs font-medium text-zinc-200"
              >
                <Trophy className="h-3.5 w-3.5" />
                View certificate
              </button>
            </div>
            {submitResult != null && (
              <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">
                  Score: {(submitResult as { score?: number }).score ?? 0}%
                </p>
                <p className="mt-1 text-zinc-400">
                  {(submitResult as { passed?: boolean }).passed
                    ? "Great work. You passed this module."
                    : "Keep going. Review the module and try again."}
                </p>
              </div>
            )}
            {cert != null && (
              <div className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm">
                <p className="font-semibold text-emerald-100">
                  Certificate: {(cert as { title?: string }).title ?? "Module completion"}
                </p>
                <p className="mt-1 text-emerald-200/80">
                  Credential ID: {(cert as { credential?: string }).credential ?? "Pending"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Learn() {
  return (
    <ClerkUserGate>
      {(userId) => <LearnContent userId={userId} />}
    </ClerkUserGate>
  );
}
