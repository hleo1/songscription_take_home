import { useEffect, useRef, useState } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { Headphones, Pause } from "lucide-react";
import { fmtDuration } from "@/lib/format";
import type { Song } from "@/lib/models";
import { claimPlayback } from "@/lib/playback";

/* --- MP3 preview: piano-roll art over a themed waveform (wavesurfer.js) --- */
export function Player({ song }: { song: Song }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Preview
      </div>
      {song.audioUrl ? (
        <>
          <img
            src="/piano-roll.jpeg"
            alt="Piano roll visualization"
            className="mb-3 aspect-[16/7] w-full rounded-lg object-cover"
          />
          <Waveform
            key={song.audioUrl}
            url={song.audioUrl}
            title={song.title}
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          No audio attached to this song yet.
        </p>
      )}
    </div>
  );
}

function Waveform({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // The waveform draws on a canvas, which can't resolve CSS variables, so
  // read the theme colors from :root once.
  const [colors] = useState(() => {
    const root = getComputedStyle(document.documentElement);
    const hsl = (name: string) => `hsl(${root.getPropertyValue(name).trim()})`;
    return {
      wave: hsl("--rule"),
      progress: hsl("--primary"),
      cursor: hsl("--accent"),
    };
  });
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    // Fetched directly: Supabase Storage allows cross-origin reads.
    url,
    height: 48,
    waveColor: colors.wave, // unplayed
    progressColor: colors.progress, // played
    cursorColor: colors.cursor,
    cursorWidth: 1,
    barWidth: 2,
    barGap: 2,
    barRadius: 2,
    normalize: true,
  });

  useEffect(() => {
    if (!wavesurfer) return;
    setReady(false);
    setFailed(false);
    const onReady = () => setReady(true);
    const onError = () => setFailed(true);
    // wavesurfer's <audio> isn't in the document, so register it directly.
    const onPlay = () => claimPlayback(wavesurfer.getMediaElement());
    wavesurfer.on("ready", onReady);
    wavesurfer.on("error", onError);
    wavesurfer.on("play", onPlay);
    return () => {
      wavesurfer.un("ready", onReady);
      wavesurfer.un("error", onError);
      wavesurfer.un("play", onPlay);
    };
  }, [wavesurfer]);

  const duration = wavesurfer?.getDuration() ?? 0;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        disabled={!ready || failed}
        onClick={() => wavesurfer?.playPause()}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:brightness-105 active:scale-95 disabled:opacity-40"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Headphones className="h-4 w-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div ref={containerRef} className="w-full" />
        {failed ? (
          <p role="alert" className="mt-1 text-xs text-primary">
            This audio could not be loaded.
          </p>
        ) : (
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{fmtDuration(Math.floor(currentTime))}</span>
            <span>{ready ? fmtDuration(Math.floor(duration)) : "–:––"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
