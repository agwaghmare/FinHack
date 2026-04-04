import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { BookOpen, ExternalLink, Loader2, Mic, Sparkles, Trophy } from "lucide-react";
import { api, postLearnModuleAudio } from "../lib/api";
import { loadCertificates, saveCertificateRecord, type StoredCertificate } from "../lib/certificateStorage";
import { ClerkUserGate } from "../components/ClerkUserGate";
import { CrossAssetStressLab } from "../components/CrossAssetStressLab";
import { useCrossAssetStressLab } from "../hooks/useCrossAssetStressLab";

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
  const { user } = useUser();
  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    "Learner";
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
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorReply, setTutorReply] = useState<string | null>(null);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorErr, setTutorErr] = useState<string | null>(null);
  const [storedCerts, setStoredCerts] = useState<StoredCertificate[]>(() => loadCertificates());
  const stressModel = useCrossAssetStressLab();

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
    setTutorReply(null);
    setTutorErr(null);
    setTutorQuestion("");
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
    try {
      const c = await api.learnCertificate(userId, selected);
      setCert(c);
      const cred = (c as { credential?: string }).credential?.trim();
      const title =
        (c as { title?: string }).title?.trim() || detail?.title || "Module completion";
      if (cred) {
        saveCertificateRecord({
          moduleId: selected,
          moduleTitle: title,
          credential: cred,
          certificate_hash: (c as { certificate_hash?: string }).certificate_hash,
          issued_at: (c as { issued_at?: string }).issued_at,
          userName: displayName,
        });
        setStoredCerts(loadCertificates());
      }
    } catch {
      setCert({ error: "Could not load certificate." });
    }
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

  async function askTutor() {
    if (!selected || tutorQuestion.trim().length < 3) return;
    setTutorBusy(true);
    setTutorErr(null);
    try {
      const r = (await api.learnTutor(selected, tutorQuestion.trim())) as {
        reply?: string;
        error?: string;
      };
      if (r.error) setTutorErr(String(r.error));
      else setTutorReply((r.reply ?? "").trim() || "No response text returned.");
    } catch (e) {
      setTutorErr(e instanceof Error ? e.message : "Tutor request failed");
    } finally {
      setTutorBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Learn
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Financial education & inclusion
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Short modules and quizzes — plus an <strong className="text-zinc-700 dark:text-zinc-300">AI tutor</strong>{" "}
          powered by <strong className="text-zinc-700 dark:text-zinc-300">Mistral AI</strong>{" "}
          (<code className="text-xs">MISTRAL_API_KEY</code>). The real-portfolio{" "}
          <strong className="text-zinc-700 dark:text-zinc-300">AI holdings coach</strong> also uses Mistral. Insights
          and other panels still use Gemini/OpenAI. Not investment advice.
        </p>
      </header>

      <section
        id="mission"
        className="scroll-mt-24 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4 dark:border-emerald-500/20 dark:bg-emerald-950/20"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Hackathon alignment
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          FinSight uses AI for <strong>trustworthy education</strong> (explainers, tutor, “why this matters”) and for{" "}
          <strong>research & portfolio support</strong> (headline summaries, strategy framing, holdings coach) — with
          clear limits: no personalized trade instructions; human oversight and professional advice still matter.
        </p>
      </section>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
        <div id="modules" className="scroll-mt-24 flex flex-col gap-2">
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

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <CrossAssetStressLab variant="page" model={stressModel} anchorId="cross-asset-stress" />
            <div className="glass rounded-2xl border border-violet-500/20 p-6 dark:border-violet-500/15">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">AI tutor</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Ask anything about the <strong className="text-zinc-800 dark:text-zinc-200">selected module</strong>. Answers
              come from <strong className="text-zinc-800 dark:text-zinc-200">Mistral AI</strong>.
            </p>
            {selected ? (
              <div className="mt-4 space-y-3">
                <label className="sr-only" htmlFor="learn-tutor-q">
                  Your question
                </label>
                <textarea
                  id="learn-tutor-q"
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                  placeholder='e.g. "What is liquidity in one sentence?" or "Why do ETFs matter for beginners?"'
                  value={tutorQuestion}
                  onChange={(e) => setTutorQuestion(e.target.value)}
                  maxLength={2000}
                />
                {tutorQuestion.trim().length < 3 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Type at least <strong>3 characters</strong>.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={askTutor}
                  disabled={tutorBusy || tutorQuestion.trim().length < 3}
                  title={
                    tutorQuestion.trim().length < 3
                      ? "Enter at least 3 characters in the box above"
                      : "Send question to the AI tutor (Mistral)"
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-violet-600/55 disabled:text-white/90"
                >
                  {tutorBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Ask AI tutor
                </button>
                {tutorErr && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">{tutorErr}</p>
                )}
                {tutorReply && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Answer</p>
                    <p className="mt-2 whitespace-pre-wrap">{tutorReply}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Select a module to unlock the tutor.</p>
            )}
            </div>
          </div>

          <section
            id="certificates"
            className="glass scroll-mt-24 rounded-2xl border border-amber-500/20 p-6 dark:border-amber-500/15"
          >
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Your certificates</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              Modules you&apos;ve opened with <strong className="text-zinc-400">View certificate</strong> after passing
              are listed here. Each shows your name and credential ID from the server.
            </p>
            {storedCerts.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-500">
                No certificates saved yet. Pass a module quiz and use &quot;View certificate&quot; to add one.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {storedCerts.map((c) => (
                  <li
                    key={`${c.moduleId}-${c.credential}`}
                    className="rounded-xl border border-zinc-700/80 bg-gradient-to-br from-zinc-900/90 to-zinc-950 p-4 shadow-inner"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">
                      FinSight Learn
                    </p>
                    <p className="mt-1 text-base font-semibold text-white">{c.moduleTitle}</p>
                    <p className="mt-3 text-xs text-zinc-500">
                      Learner name
                    </p>
                    <p className="font-medium text-zinc-200">{c.userName}</p>
                    <p className="mt-2 text-xs text-zinc-500">Credential ID</p>
                    <p className="break-all font-mono text-[11px] text-emerald-400/90">{c.credential}</p>
                    {c.issued_at ? (
                      <p className="mt-2 text-[11px] text-zinc-600">
                        Issued {new Date(c.issued_at).toLocaleString()}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] text-zinc-600">
                      Saved {new Date(c.savedAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div id="quiz" className="glass scroll-mt-24 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white">Quiz</h2>
            <div className="mt-4 space-y-4">
              {(quiz?.questions ?? []).map((qq, i) => {
                return (
                  <div key={i} className="rounded-xl border border-zinc-800 p-4">
                    <p className="text-sm text-zinc-200">{qq.q ?? qq.prompt}</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {(qq.options ?? []).map((opt, j) => (
                        <label
                          key={j}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700/80 bg-zinc-900/40 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900/70 has-[:checked]:border-emerald-600/50 has-[:checked]:bg-emerald-950/30"
                        >
                          <input
                            type="radio"
                            name={`q-${i}`}
                            className="mt-0.5 shrink-0"
                            checked={answers[i] === j}
                            onChange={() => {
                              const next = [...answers];
                              next[i] = j;
                              setAnswers(next);
                            }}
                          />
                          <span className="leading-snug">{opt}</span>
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
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  (cert as { error?: string }).error
                    ? "border-amber-700/40 bg-amber-950/30 text-amber-100"
                    : "border-emerald-700/40 bg-emerald-950/30"
                }`}
              >
                {(cert as { error?: string }).error ? (
                  <p>{(cert as { error: string }).error}</p>
                ) : (
                  <>
                    <p className="font-semibold text-emerald-100">
                      Certificate: {(cert as { title?: string }).title ?? "Module completion"}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-emerald-200/80">
                      Credential ID: {(cert as { credential?: string }).credential ?? "Pending"}
                    </p>
                    {(cert as { certificate_hash?: string }).certificate_hash ? (
                      <p className="mt-1 text-[11px] text-emerald-300/70">
                        Unique hash: {(cert as { certificate_hash?: string }).certificate_hash}
                      </p>
                    ) : null}
                    {(cert as { issued_at?: string }).issued_at ? (
                      <p className="mt-1 text-[11px] text-emerald-400/60">
                        Issued: {new Date((cert as { issued_at: string }).issued_at).toLocaleString()}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-emerald-500/80">
                      Added to <strong className="text-emerald-200/90">Your certificates</strong> above.
                    </p>
                  </>
                )}
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
