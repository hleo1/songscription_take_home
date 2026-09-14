import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Clock, Heart, Pencil, Play, Trash2, X } from "lucide-react";
import { Cover } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useEscape, useScrollLock } from "@/lib/dialog";
import { fmtDuration, NOTES } from "@/lib/format";
import type { PracticeLog, Song } from "@/lib/models";
import { useStore, Editable } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BpmCard, HandsCard, TransposeCard } from "./controls";
import { Player } from "./Player";
import { PracticeHistory } from "./PracticeHistory";
import { TagsCard } from "./TagsCard";

/** Slide-in sheet for the selected song. Renders nothing when none is selected. */
export function SongDetail() {
  const { selectedSong: song, history, close } = useStore();
  const open = !!song;

  // Escape handled inside the panel first (cancelling an edit, closing the
  // practice log) leaves the panel open.
  useEscape(close, { enabled: open });
  // Only the sheet scrolls while it's open.
  useScrollLock(open);

  if (!song) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fade-up_0.2s_ease-out]"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${song.title} details`}
        className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl"
        style={{ animation: "sheet-in 0.28s cubic-bezier(.16,1,.3,1)" }}
      >
        <DetailContent
          key={song.id}
          song={song}
          history={history}
          onClose={close}
        />
      </div>
    </div>,
    document.body,
  );
}

function DetailContent({
  song,
  history,
  onClose,
}: {
  song: Song;
  history: PracticeLog[] | null;
  onClose: () => void;
}) {
  const { getMeta, update, error, retry } = useStore();
  const meta = getMeta(song);
  const set = (patch: Partial<Editable>) => update(song.id, patch);

  return (
    <div className="flex h-full flex-col">
      {/* Hero header */}
      <div className="relative shrink-0 border-b border-border bg-card p-5 pb-4">
        <div className="relative flex items-start gap-4">
          <Cover
            song={song}
            className="h-16 w-16 shrink-0 border border-border sm:h-20 sm:w-20"
          />
          <div className="min-w-0 flex-1 pt-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {song.genre}
            </div>
            <EditableTitle song={song} />
            <p className="truncate text-sm text-muted-foreground">
              {song.artist}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">
                {fmtDuration(song.durationSec)}
              </span>
              <span>
                · {song.bpm} BPM · {NOTES[song.originalRoot]}{" "}
                {song.originalMode}
              </span>
              <span>
                · Added{" "}
                {new Date(song.addedAt).toLocaleDateString(undefined, {
                  timeZone: "UTC",
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FavoriteButton
              on={meta.favorite}
              onToggle={() => set({ favorite: !meta.favorite })}
            />
            <DeleteButton song={song} />
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-secondary/40 text-muted-foreground transition-colors hover:text-foreground"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          {/* Playback controls + preview */}
          <div className="space-y-4">
            <section className="space-y-4 border-b border-border/60 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <BpmCard
                  bpm={meta.bpm}
                  original={song.bpm}
                  onChange={(bpm) => set({ bpm })}
                />
                <TransposeCard
                  meta={meta}
                  root={song.originalRoot}
                  mode={song.originalMode}
                  onChange={set}
                />
                <HandsCard
                  hand={meta.hand}
                  onChange={(hand) => set({ hand })}
                />
              </div>
              <PracticeEntry song={song} />
            </section>
            <Player song={song} />
          </div>

          {/* Tags + history */}
          <div className="space-y-4">
            <TagsCard tags={meta.tags} onChange={(tags) => set({ tags })} />
            <PracticeHistory song={song} history={history} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {error}{" "}
            <button onClick={retry} className="underline text-primary">
              Retry
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/* --- Editable song title (pencil to rename) --- */
function EditableTitle({ song }: { song: Song }) {
  const { rename } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(song.title);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== song.title) rename(song.id, v);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.preventDefault(); // cancel the edit without closing the panel
            setDraft(song.title);
            setEditing(false);
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Song title"
        className="h-9 w-full rounded-md border border-primary/40 bg-background px-1.5 py-0 font-display text-2xl leading-8 text-foreground outline-none focus:border-primary"
      />
    );
  }
  return (
    <div className="flex h-9 items-center gap-1.5">
      <h2 className="truncate font-display text-2xl text-foreground">
        {song.title}
      </h2>
      <button
        onClick={() => {
          setDraft(song.title);
          setEditing(true);
        }}
        title="Rename song"
        aria-label="Rename song"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FavoriteButton({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full border border-border transition-all active:scale-90",
        on
          ? "bg-primary text-primary-foreground"
          : "bg-secondary/40 text-muted-foreground hover:text-foreground",
      )}
      title={on ? "Remove favorite" : "Add favorite"}
    >
      <Heart
        className={cn("h-4 w-4 transition-all", on && "scale-110 fill-current")}
      />
    </button>
  );
}

/* --- Delete song (trash, then confirm in a centered modal) --- */
function DeleteButton({ song }: { song: Song }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        title={`Delete ${song.title}`}
        aria-label={`Delete ${song.title}`}
        className="grid h-8 w-8 place-items-center rounded-full border border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-red-700/40 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {confirming && (
        <ConfirmDelete song={song} onClose={() => setConfirming(false)} />
      )}
    </>
  );
}

function ConfirmDelete({ song, onClose }: { song: Song; onClose: () => void }) {
  const { remove } = useStore();
  // Capture phase: runs before the detail panel's listener, so Escape closes
  // only this dialog.
  useEscape(onClose, { capture: true });

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-up_0.2s_ease-out]" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete ${song.title}`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
        style={{ animation: "pop-in 0.22s cubic-bezier(.16,1,.3,1)" }}
      >
        <h3 className="font-display text-lg leading-tight">Delete song?</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">{song.title}</span>?
          This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button onClick={() => remove(song.id)}>Delete</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PracticeEntry({ song }: { song: Song }) {
  const router = useRouter();
  const { getMeta, error: saveError } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section>
      {/* Not disabled while saving: the start request sends the current tempo /
          transpose / hands itself, so it needn't wait for queued writes. */}
      <Button
        disabled={busy || !!saveError}
        className="w-full"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const { bpm, hand, transpose } = getMeta(song);
            const r = await fetch("/api/practice/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                songId: song.id,
                settings: { bpm, hand, transpose },
              }),
            });
            const result = await r.json();
            if (!r.ok) throw Error(result.error || "Could not start practice");
            router.push(`/practice?id=${result.id}`);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not start practice",
            );
            setBusy(false);
          }
        }}
      >
        <Play className="mr-2 h-4 w-4" />
        {busy ? "Starting…" : "Start Practice"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
