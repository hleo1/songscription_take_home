import { Clock } from "lucide-react";
import { AudioPreviewButton } from "@/components/AudioPreviewButton";
import { Cover, FavoriteStar, LastPractice } from "@/components/shared";
import { fmtDuration, unpracticedLabel } from "@/lib/format";
import { useStore } from "@/lib/store";

/* Grid view — cover-forward album wall. */
export function SongGrid() {
  const { open, getMeta, catalog, update } = useStore();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {catalog.map((s, i) => {
        const m = getMeta(s);
        return (
          <div
            key={s.id}
            onClick={() => open(s.id)}
            className="group cursor-pointer animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="relative">
              <Cover
                song={s}
                className="aspect-square w-full transition-transform duration-300 group-hover:-translate-y-1"
              />
              <button
                title={m.favorite ? "Unfavorite" : "Favorite"}
                onClick={(e) => {
                  e.stopPropagation();
                  update(s.id, { favorite: !m.favorite });
                }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-border bg-card/85 backdrop-blur-sm"
              >
                <FavoriteStar active={m.favorite} />
              </button>
            </div>
            <div className="mt-2.5 px-0.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{s.title}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.artist}
                  </p>
                </div>
                <AudioPreviewButton song={s} />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fmtDuration(s.durationSec)}
                </span>
                {s.lastAccuracy === null ? (
                  <span className="ml-auto font-bold uppercase tracking-[0.06em] text-primary">
                    {unpracticedLabel(s)}
                  </span>
                ) : (
                  <span className="ml-auto">
                    <LastPractice song={s} />
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
