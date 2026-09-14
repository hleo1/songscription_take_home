import { useState } from "react";
import { Check, Tag, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ControlCard } from "./controls";

/* --- Tags editor: current tags, an add field, and suggestions from every tag used --- */
export function TagsCard({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const { allTags } = useStore();
  const [input, setInput] = useState("");
  const add = (t: string) => {
    const v =
      allTags.find(
        (existing) => existing.toLowerCase() === t.trim().toLowerCase(),
      ) ?? t.trim();
    if (v && tags.length < 20 && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  return (
    <ControlCard
      label={
        <span className="flex items-center gap-1">
          <Tag className="h-3 w-3" /> Custom tags
        </span>
      }
    >
      {/* One fixed-height line each (scrolling sideways) so the card doesn't
          resize as tags, suggestions, or the "Add a new tag" prompt come and go. */}
      <div className="flex h-6 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-full bg-primary/15 pl-2.5 pr-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/30"
          >
            <span className="truncate" title={t}>
              {t}
            </span>
            <button
              onClick={() => onChange(tags.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full hover:bg-primary/30"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add(input)}
            maxLength={40}
            aria-label="Add tag"
            placeholder="Add tag…"
            className="w-20 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          <button
            aria-label="Save tag"
            disabled={!input.trim()}
            onClick={() => add(input)}
            className={cn(
              "grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground",
              !input.trim() && "invisible",
            )}
          >
            <Check className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div
        aria-label="Tag suggestions"
        className="mt-2 flex h-5 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {input.trim() &&
          !allTags.some(
            (t) => t.toLowerCase() === input.trim().toLowerCase(),
          ) && (
            <button
              className="h-5 max-w-full shrink-0 truncate text-xs text-primary"
              onClick={() => add(input)}
            >
              Add a new tag: “{input.trim()}”
            </button>
          )}
        {/* suggestions */}
        {allTags
          .filter(
            (s) =>
              !tags.includes(s) &&
              s.toLowerCase().includes(input.toLowerCase()),
          )
          .map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="h-5 max-w-full shrink-0 truncate rounded-full border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              + {s}
            </button>
          ))}
      </div>
    </ControlCard>
  );
}
