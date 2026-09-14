"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Headphones, LoaderCircle, Pause } from "lucide-react";
import { fmtDuration } from "@/lib/format";
import type { Song } from "@/lib/models";
import { claimPlayback } from "@/lib/playback";
import { cn } from "@/lib/utils";

export function AudioPreviewButton({ song }: { song: Song }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState({ elapsed: 0, duration: 0 });
  const updatePosition = (audio: HTMLAudioElement) => {
    setPosition({
      elapsed: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  };
  const progress =
    position.duration > 0
      ? Math.min(100, Math.max(0, (position.elapsed / position.duration) * 100))
      : 0;
  const timeLabel = `${fmtDuration(position.elapsed)} / ${fmtDuration(position.duration)}`;

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [song.audioUrl]);

  const label = !song.audioUrl
    ? `No audio available for ${song.title}`
    : failed
      ? `Could not play ${song.title}. Click to retry.`
      : `${playing || loading ? "Pause" : "Play"} ${song.title} preview`;

  return (
    <span className="relative inline-flex shrink-0">
      <audio
        ref={audioRef}
        src={song.audioUrl ?? undefined}
        preload="none"
        onLoadedMetadata={(event) => updatePosition(event.currentTarget)}
        onDurationChange={(event) => updatePosition(event.currentTarget)}
        onTimeUpdate={(event) => updatePosition(event.currentTarget)}
        onSeeked={(event) => updatePosition(event.currentTarget)}
        onEmptied={() => setPosition({ elapsed: 0, duration: 0 })}
        onPlay={(event) => claimPlayback(event.currentTarget)}
        onPlaying={() => {
          setPlaying(true);
          setLoading(false);
        }}
        onPause={() => {
          setPlaying(false);
          setLoading(false);
        }}
        // Playback restarts from the top, so empty the ring instead of leaving it full.
        onEnded={() => {
          setPosition((p) => ({ ...p, elapsed: 0 }));
          setPlaying(false);
          setLoading(false);
        }}
        onError={() => {
          setFailed(true);
          setPlaying(false);
          setLoading(false);
        }}
      />
      <button
        type="button"
        title={position.duration > 0 ? `${label} · ${timeLabel}` : label}
        aria-label={label}
        aria-pressed={playing || loading}
        disabled={!song.audioUrl}
        className={cn(
          "relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary disabled:opacity-40",
          (playing || loading) && "bg-primary/10",
        )}
        onClick={async (event) => {
          event.stopPropagation();
          const audio = audioRef.current;
          if (!audio || !song.audioUrl) return;
          if (loading || !audio.paused) {
            audio.pause();
            setLoading(false);
            return;
          }
          if (failed) audio.load();
          setFailed(false);
          setLoading(true);
          try {
            await audio.play();
          } catch (error) {
            // Pausing or switching tracks while loading intentionally aborts play.
            if (!(
              error instanceof DOMException && error.name === "AbortError"
            )) {
              setFailed(true);
              setLoading(false);
              setPlaying(false);
            }
          }
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 36 36"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
        >
          <circle
            cx="18"
            cy="18"
            r="16.5"
            fill="none"
            strokeWidth="1"
            className="stroke-primary/40"
          />
          <circle
            cx="18"
            cy="18"
            r="16.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            pathLength="100"
            strokeDasharray={`${progress} 100`}
            strokeLinecap="round"
            opacity={progress > 0 ? 1 : 0}
            className="transition-[stroke-dasharray] duration-200 motion-reduce:transition-none"
          />
        </svg>
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : failed ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Headphones className="h-4 w-4" />
        )}
      </button>
      {position.duration > 0 && (
        <span
          role="progressbar"
          aria-label={`${song.title} playback progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-valuetext={timeLabel}
          className="sr-only"
        />
      )}
      {failed && (
        <span role="alert" className="sr-only">
          Audio could not be played. Click the preview button to retry.
        </span>
      )}
    </span>
  );
}
