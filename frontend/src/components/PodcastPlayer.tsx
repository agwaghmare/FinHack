import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, Square } from "lucide-react";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  /** MP3 blob URL */
  audioUrl: string | null;
  /** When no MP3, script for browser read-aloud */
  scriptText?: string | null;
  title?: string;
};

export function PodcastPlayer({ audioUrl, scriptText, title = "Market close" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ttsActive, setTtsActive] = useState(false);
  const [ttsElapsed, setTtsElapsed] = useState(0);
  const ttsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;

    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    a.src = audioUrl;
    a.load();

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
      window.speechSynthesis.cancel();
    };
  }, []);

  function togglePlay() {
    const a = audioRef.current;
    if (audioUrl && a) {
      if (playing) a.pause();
      else void a.play().catch(() => {});
      return;
    }
    if (scriptText?.trim()) {
      if (ttsActive) {
        window.speechSynthesis.cancel();
        if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
        setTtsActive(false);
        setTtsElapsed(0);
        return;
      }
      const u = new SpeechSynthesisUtterance(scriptText);
      // Tune browser TTS for a more natural, less robotic cadence.
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /en-us|en_us/i.test(v.lang) && /aria|jenny|zira|davis|samantha|google us english/i.test(v.name)) ??
        voices.find((v) => /en-us|en_us/i.test(v.lang)) ??
        voices[0];
      if (preferred) u.voice = preferred;
      const start = Date.now();
      setTtsActive(true);
      setTtsElapsed(0);
      ttsTimerRef.current = setInterval(() => {
        setTtsElapsed((Date.now() - start) / 1000);
      }, 250);
      u.onend = () => {
        if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
        setTtsActive(false);
        setTtsElapsed(0);
      };
      u.onerror = () => {
        if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
        setTtsActive(false);
      };
      window.speechSynthesis.speak(u);
    }
  }

  function seekPct(pct: number) {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = (pct / 100) * duration;
  }

  function restart() {
    const a = audioRef.current;
    if (a && audioUrl) {
      a.currentTime = 0;
      void a.play().catch(() => {});
    }
  }

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;
  const mode: "mp3" | "tts" | "none" = audioUrl ? "mp3" : scriptText ? "tts" : "none";

  return (
    <div className="mt-4 space-y-3 rounded-xl glass-inset p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-400">{title}</p>
        {mode === "mp3" && (
          <span className="text-[11px] tabular-nums text-zinc-500">
            {formatTime(current)} / {formatTime(duration)}
            {duration > 0 && (
              <span className="ml-2 text-zinc-600">
                ({((current / duration) * 100).toFixed(0)}% listened)
              </span>
            )}
          </span>
        )}
        {mode === "tts" && (
          <span className="text-[11px] tabular-nums text-zinc-500">
            Read-aloud · {formatTime(ttsElapsed)} elapsed
          </span>
        )}
      </div>

      {mode === "none" && (
        <p className="text-xs text-zinc-500">Generate a podcast or use read-aloud when script is available.</p>
      )}

      {mode === "mp3" && (
        <>
          <audio ref={audioRef} preload="metadata" className="hidden" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={restart}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              title="Restart"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                audioRef.current?.pause();
                if (audioRef.current) audioRef.current.currentTime = 0;
                setPlaying(false);
                setCurrent(0);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="block">
            <span className="sr-only">Seek</span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progressPct}
              onChange={(e) => seekPct(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-zinc-100"
            />
          </label>
          <p className="text-[10px] text-zinc-600">
            Drag to scrub · Space-like behavior: pause resumes from current position.
          </p>
        </>
      )}

      {mode === "tts" && !audioUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-zinc-200"
          >
            {ttsActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
          </button>
          <span className="text-xs text-zinc-500">
            {ttsActive ? "Pause stops read-aloud" : "Play full script in browser voice"}
          </span>
        </div>
      )}
    </div>
  );
}
