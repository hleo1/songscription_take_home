import { Clock } from "lucide-react";
import { AudioPreviewButton } from "@/components/AudioPreviewButton";
import { Cover, FavoriteStar, LastPractice } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmtDuration, unpracticedLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/* List view — rows with album art, tags, practice summary, preview. */
export function SongList() {
  const { open, selectedId, getMeta, update, catalog } = useStore();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
      {catalog.map((s, i) => {
        const m = getMeta(s);
        return (
          <Card
            key={s.id}
            onClick={() => open(s.id)}
            className={cn(
              "group flex cursor-pointer items-center gap-4 p-3 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 animate-fade-up",
              selectedId === s.id &&
                "border-primary/40 shadow-lg shadow-primary/5",
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="relative">
              <Cover song={s} className="h-16 w-16" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {s.genre}
              </div>
              <div className="flex items-center gap-2">
                <h3 className="truncate font-display text-lg leading-tight">
                  {s.title}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    update(s.id, { favorite: !m.favorite });
                  }}
                  title={m.favorite ? "Unfavorite" : "Favorite"}
                  className="shrink-0 transition-transform active:scale-90"
                >
                  <FavoriteStar active={m.favorite} className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {s.artist}
              </div>
              {/* Fixed single-line height so rows line up with or without tags. */}
              <div className="mt-1.5 flex h-6 items-center gap-1.5 overflow-hidden">
                {m.tags.map((t) => (
                  <Badge
                    key={t}
                    variant="primary"
                    className="shrink-0 text-[10px] leading-4"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            {/* preview button */}
            <AudioPreviewButton song={s} />

            {/* duration */}
            <div className="hidden w-14 shrink-0 items-center justify-center gap-1 text-xs text-muted-foreground md:flex">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold tabular-nums">
                {fmtDuration(s.durationSec)}
              </span>
            </div>

            {/* Latest accuracy and practice date, matching the grid summary. */}
            <div className="hidden w-28 shrink-0 flex-col items-end lg:flex">
              {s.lastAccuracy !== null ? (
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  <LastPractice song={s} />
                </span>
              ) : (
                <span className="grid h-7 w-full place-items-center whitespace-nowrap rounded-full border border-primary/40 px-2 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {unpracticedLabel(s)}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
