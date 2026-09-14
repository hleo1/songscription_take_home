import { useState } from "react";
import { Info, Minus, Pencil, Plus, RotateCcw } from "lucide-react";
import { MaskIcon } from "@/components/shared";
import { NOTES } from "@/lib/format";
import type { Editable } from "@/lib/models";
import { cn } from "@/lib/utils";

/* Tempo / transpose / hands cards shown at the top of the song detail. */

export function ControlCard({
  label,
  action,
  children,
  className,
}: {
  label: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-3", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* --- Inline numeric editor used by the tempo / transpose pencil buttons --- */
function InlineNumberEdit({
  value,
  min,
  max,
  suffix,
  onCommit,
  onCancel,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onCommit: (v: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const v = parseInt(draft, 10);
    if (Number.isFinite(v)) onCommit(Math.max(min, Math.min(max, v)));
    else onCancel();
  };
  return (
    <div className="flex h-10 items-baseline gap-1 text-foreground">
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.preventDefault(); // cancel the edit without closing the panel
            onCancel();
          }
        }}
        aria-label="Value"
        className="h-10 w-20 min-w-0 rounded-md border border-primary/40 bg-background px-1 py-0 text-4xl font-bold leading-10 tabular-nums outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* Small pencil button for a control card's top-right corner. */
function EditPencil({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Pencil className="h-3 w-3" />
    </button>
  );
}

/* Large value readout shared by the tempo and transpose cards. */
function BigValue({ value, unit }: { value: React.ReactNode; unit: string }) {
  return (
    <div className="flex h-10 items-baseline gap-1 text-foreground">
      <span className="text-4xl font-bold leading-10 tabular-nums">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

/* −/+ buttons shared by the tempo and transpose cards. */
function StepButtons({
  label,
  onStep,
}: {
  label: string;
  onStep: (delta: -1 | 1) => void;
}) {
  const className =
    "grid flex-1 place-items-center rounded-md bg-secondary py-1.5 text-foreground transition-all hover:bg-secondary/80 active:scale-95";
  return (
    <div className="mt-2.5 flex items-center justify-between gap-2">
      <button
        aria-label={`Decrease ${label}`}
        onClick={() => onStep(-1)}
        className={className}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={`Increase ${label}`}
        onClick={() => onStep(1)}
        className={className}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RevertButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="grid h-4 w-4 place-items-center rounded transition-colors hover:text-foreground"
    >
      <RotateCcw className="h-3 w-3" />
    </button>
  );
}

function ConceptLabel({ label, href }: { label: string; href: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Learn about ${label.toLowerCase()} on Wikipedia (opens in a new tab)`}
        title={`About ${label.toLowerCase()} — Wikipedia`}
        onClick={(event) => event.stopPropagation()}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}

/* --- BPM stepper --- */
export function BpmCard({
  bpm,
  original,
  onChange,
}: {
  bpm: number;
  original: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(20, Math.min(240, v));
  const changed = bpm !== original;
  const [editing, setEditing] = useState(false);
  return (
    <ControlCard
      label={
        <ConceptLabel
          label="Tempo"
          href="https://en.wikipedia.org/wiki/Tempo"
        />
      }
      action={
        <EditPencil label="Edit tempo" onClick={() => setEditing(true)} />
      }
    >
      {editing ? (
        <InlineNumberEdit
          value={bpm}
          min={20}
          max={240}
          suffix="BPM"
          onCommit={(v) => {
            onChange(v);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <BigValue value={bpm} unit="BPM" />
      )}
      <StepButtons label="BPM" onStep={(d) => onChange(clamp(bpm + d))} />
      <div className="mt-2 flex h-4 items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        {changed && (
          <>
            <span className="tabular-nums">{original}</span>
            <span className="text-primary">→</span>
            <span className="font-semibold text-accent tabular-nums">
              {bpm}
            </span>
            <RevertButton
              title={`Revert to original (${original})`}
              onClick={() => onChange(original)}
            />
          </>
        )}
      </div>
    </ControlCard>
  );
}

/* --- Hands toggle --- */
export function HandsCard({
  hand,
  onChange,
}: {
  hand: "left" | "right" | "both";
  onChange: (h: "left" | "right" | "both") => void;
}) {
  const leftOn = hand === "left" || hand === "both";
  const rightOn = hand === "right" || hand === "both";
  const toggle = (side: "left" | "right") => {
    let l = leftOn;
    let r = rightOn;
    if (side === "left") l = !l;
    else r = !r;
    // Deselecting the only active hand switches to the other one.
    if (!l && !r) return onChange(side === "left" ? "right" : "left");
    onChange(l && r ? "both" : l ? "left" : "right");
  };
  return (
    <ControlCard label="Hands">
      <div className="flex gap-1.5">
        {(["left", "right"] as const).map((side) => {
          const active = side === "left" ? leftOn : rightOn;
          return (
            <button
              key={side}
              onClick={() => toggle(side)}
              title={`${side} hand`}
              aria-label={`${side} hand`}
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center rounded-lg border py-2 transition-all active:scale-95",
                active
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <MaskIcon src={`/icons/${side}-hand.svg`} className="h-5 w-5" />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex h-4 items-center justify-center text-[10px] capitalize text-muted-foreground">
        {hand === "both" ? "Both hands" : `${hand} only`}
      </div>
    </ControlCard>
  );
}

/* --- Transpose + key --- */
export function TransposeCard({
  meta,
  root,
  mode,
  onChange,
}: {
  meta: Editable;
  /** The song's original key; transpose is relative to it. */
  root: number;
  mode: "Major" | "Minor";
  onChange: (p: Partial<Editable>) => void;
}) {
  const clamp = (v: number) => Math.max(-12, Math.min(12, v));
  const targetRoot = (((root + meta.transpose) % 12) + 12) % 12;
  const [editing, setEditing] = useState(false);
  return (
    <ControlCard
      label={
        <ConceptLabel
          label="Transpose"
          href="https://en.wikipedia.org/wiki/Transposition_(music)"
        />
      }
      action={
        <EditPencil label="Edit transpose" onClick={() => setEditing(true)} />
      }
    >
      {editing ? (
        <InlineNumberEdit
          value={meta.transpose}
          min={-12}
          max={12}
          suffix="semi"
          onCommit={(v) => {
            onChange({ transpose: v });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <BigValue
          value={meta.transpose > 0 ? `+${meta.transpose}` : meta.transpose}
          unit="semi"
        />
      )}
      <StepButtons
        label="transpose"
        onStep={(d) => onChange({ transpose: clamp(meta.transpose + d) })}
      />
      <div className="mt-2 flex h-4 items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        {meta.transpose !== 0 ? (
          <span>
            {NOTES[root]} <span className="text-primary">→</span>{" "}
            <span className="font-semibold text-accent">
              {NOTES[targetRoot]}
            </span>
          </span>
        ) : (
          <span>
            Key{" "}
            <span className="font-semibold text-foreground">
              {NOTES[root]}
            </span>{" "}
            {mode === "Major" ? "maj" : "min"}
          </span>
        )}
        {meta.transpose !== 0 && (
          <RevertButton
            title="Revert to the original key"
            onClick={() => onChange({ transpose: 0 })}
          />
        )}
      </div>
    </ControlCard>
  );
}
