import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Timer, X } from "lucide-react";
import { accuracyColor } from "@/components/shared";
import { useEscape } from "@/lib/dialog";
import { fmtMinSec, lastNDays, weekday } from "@/lib/format";
import type { PracticeLog, Song } from "@/lib/models";

/* --- Five-day practice history: time intensity and daily average accuracy --- */
export function PracticeHistory({
  song,
  history,
}: {
  song: Song;
  /** Null while the song's history is loading. */
  history: PracticeLog[] | null;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const logs = history ?? [];
  const dates = logs.map((log) => log.date.slice(0, 10)).sort();
  const latest = dates.at(-1);
  // The window ends today, so paging has to reach back from today to the oldest log.
  const today = new Date().toISOString().slice(0, 10);
  const span = dates.length
    ? Math.round((Date.parse(today) - Date.parse(dates[0])) / 86400000) + 1
    : 0;
  const maxPage = Math.max(0, Math.ceil(span / 5) - 1);
  const currentPage = Math.min(page, maxPage);
  const days = lastNDays(logs, (currentPage + 1) * 5).slice(0, 5);
  useEffect(() => setPage(0), [song.id, latest]);
  const level = (minutes: number) =>
    minutes === 0
      ? 0
      : minutes < 12
        ? 1
        : minutes < 22
          ? 2
          : minutes < 32
            ? 3
            : 4;
  const colors = [
    "hsl(37 30% 90%)",
    "hsl(27 45% 76%)",
    "hsl(20 46% 62%)",
    "hsl(16 50% 50%)",
    "hsl(var(--primary))",
  ];
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const active = days.filter((day) => day.sessions > 0).length;
  const dateLabel = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const arrowClass =
    "grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-30";

  return (
    <section
      aria-label="Daily practice average accuracy"
      className="rounded-xl border border-border bg-card p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Daily practice average accuracy
        </span>
        <button
          onClick={() => setLogOpen(true)}
          disabled={!history}
          title="View full practice log"
          aria-label="View full practice log"
          className="shrink-0 whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
        >
          View All Logs
        </button>
      </div>
      <div aria-live="polite">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
          <span>
            {dateLabel(days[0].date)} – {dateLabel(days[4].date)}
          </span>
          <span>
            {history ? `${fmtMinSec(total)} · ${active}/5 days` : "Loading…"}
          </span>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <div className="pb-5">
            <button
              aria-label="Previous five days"
              title="Previous five days"
              disabled={currentPage >= maxPage}
              onClick={() => setPage(currentPage + 1)}
              className={arrowClass}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {days.map((day) => {
              const shade = level(day.minutes);
              const description = `${day.date}: ${day.sessions ? `${day.accuracy}% average accuracy, ${fmtMinSec(day.minutes)} practiced` : "No practice"}`;
              return (
                <div key={day.date} className="min-w-0 text-center">
                  <div
                    role="img"
                    aria-label={description}
                    title={description}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg ring-1 ring-inset ring-black/5"
                    style={{
                      background: colors[shade],
                      color: shade >= 3 ? "white" : "hsl(var(--foreground))",
                    }}
                  >
                    <span className="text-[9px] font-medium opacity-75">
                      {weekday(day.date)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums sm:text-lg">
                      {day.sessions ? `${day.accuracy}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {dateLabel(day.date)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pb-5">
            <button
              aria-label="Next five days"
              title="Next five days"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className={arrowClass}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex shrink-0 gap-0.5" aria-hidden="true">
          {colors.map((color) => (
            <span
              key={color}
              className="h-2 w-2 rounded-sm"
              style={{ background: color }}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          The darker the shade, the more you practiced.
        </p>
      </div>
      {logOpen && (
        <PracticeLogModal
          song={song}
          history={logs}
          onClose={() => setLogOpen(false)}
        />
      )}
    </section>
  );
}

/* --- Full practice log modal --- */
function PracticeLogModal({
  song,
  history,
  onClose,
}: {
  song: Song;
  history: PracticeLog[];
  onClose: () => void;
}) {
  // Capture phase: runs before the detail panel's listener, so Escape closes
  // only this log.
  useEscape(onClose, { capture: true });

  const logs = [...history].reverse(); // newest first
  const totalMin = history.reduce((a, l) => a + l.minutes, 0);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-up_0.2s_ease-out]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        style={{ animation: "pop-in 0.22s cubic-bezier(.16,1,.3,1)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Practice log
            </div>
            <h3 className="truncate font-display text-lg leading-tight">
              {song.title}
            </h3>
            <div className="text-xs text-muted-foreground">
              {history.length} sessions · {fmtMinSec(totalMin)} total
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {logs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No practice sessions logged yet.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-2 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {fmtDate(l.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="tabular-nums text-muted-foreground">
                      {fmtMinSec(l.minutes)}
                    </span>
                    <span
                      className="w-10 text-right font-semibold tabular-nums"
                      style={{ color: accuracyColor(l.accuracy) }}
                    >
                      {l.accuracy}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
