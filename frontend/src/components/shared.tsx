import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Song } from "@/lib/models";
import { Heart } from "lucide-react";

/** A monochrome image asset tinted with the current text color (CSS mask). */
export function MaskIcon({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const mask = `url(${src}) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={cn("bg-current", className)}
      style={{ mask, WebkitMask: mask }}
    />
  );
}

export function accuracyColor(v: number) {
  if (v >= 80) return "hsl(var(--primary))"; // burnt sienna — strong
  if (v >= 60) return "hsl(33 45% 50%)"; // warm ochre
  return "hsl(33 14% 55%)"; // faded brown
}

/** "90% · Yesterday" for a practiced song; nothing if it was never practiced. */
export function LastPractice({ song }: { song: Song }) {
  if (song.lastAccuracy === null) return null;
  return (
    <>
      <span
        className="font-medium"
        style={{ color: accuracyColor(song.lastAccuracy) }}
      >
        {song.lastAccuracy}%
      </span>{" "}
      · {relTime(song.lastPracticed)}
    </>
  );
}

/** Notation thumbnail — a sheet-music staff with notes, deterministic per song.
    Score-led artwork per the Score Shelf identity (no decorative cover art). */
export function Cover({
  song,
  className,
}: {
  song: Song;
  className?: string;
}) {
  // Hash the id so every song gets its own pattern (uploaded ids are UUIDs).
  let seed = 0;
  for (const ch of song.id) seed = (seed * 31 + ch.charCodeAt(0)) % 100003;
  seed ||= 1;
  // deterministic note positions along the staff
  const notes = Array.from({ length: 7 }, (_, i) => {
    const x = 14 + i * 12;
    const step = Math.abs(Math.sin(seed * 2.3 + i * 1.7));
    const y = 30 + Math.round(step * 40); // within the 5-line staff band
    return { x, y };
  });

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-card",
        className,
      )}
    >
      {song.coverUrl ? (
        // Album art / artist image when we have one (seeded or found on upload)
        <img
          src={song.coverUrl}
          alt={`${song.title} cover`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Fallback: score-led notation thumbnail, deterministic per song
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* five-line staff */}
          {[30, 40, 50, 60, 70].map((y) => (
            <line
              key={y}
              x1="6"
              y1={y}
              x2="94"
              y2={y}
              className="stroke-[hsl(var(--rule))]"
              strokeWidth="1"
            />
          ))}
          {/* stems + noteheads */}
          {notes.map((n, i) => (
            <g key={i}>
              <line
                x1={n.x + 2.6}
                y1={n.y}
                x2={n.x + 2.6}
                y2={n.y - 16}
                className="stroke-primary"
                strokeWidth="1.1"
              />
              <ellipse
                cx={n.x}
                cy={n.y}
                rx="3.1"
                ry="2.3"
                className="fill-primary"
                transform={`rotate(-18 ${n.x} ${n.y})`}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

export function FavoriteStar({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <Heart
      className={cn(
        "h-4 w-4 transition-all",
        active
          ? "fill-primary text-primary"
          : "text-muted-foreground/50 hover:text-muted-foreground",
        className,
      )}
    />
  );
}
