import { useState } from "react";
import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Check,
  Heart,
  LayoutGrid,
  List,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, SortKey } from "@/lib/store";

/* ---- Search bar with recent-search suggestions ---- */
export function SearchBar({
  draft,
  setDraft,
  setSearch,
  submitSearch,
  suggestions,
}: {
  draft: string;
  setDraft: (v: string) => void;
  setSearch: (v: string) => void;
  submitSearch: (v: string) => void;
  suggestions: string[];
}) {
  const [focused, setFocused] = useState(false);
  const query = draft.trim().toLowerCase();
  // Newest first from the API; show only the three closest matches.
  const matches = suggestions
    .filter((s) => s.toLowerCase() !== query && s.toLowerCase().includes(query))
    .slice(0, 3);
  const showSuggestions = focused && matches.length > 0;

  // An explicit submit (Enter or picking a suggestion) is what earns a term a
  // place in the recent searches — plain keystrokes just filter.
  const submit = (term: string) => {
    setDraft(term);
    setFocused(false);
    submitSearch(term);
  };

  return (
    <div className="relative">
      <form
        className="relative flex items-center"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search your library"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={200}
          placeholder="Search…"
          className="w-60 pl-9 pr-8"
        />
        {draft && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setDraft("");
              setSearch("");
            }}
            className="absolute right-2 grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>
      {showSuggestions && (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 rounded-xl border border-border bg-card p-1.5 shadow-2xl"
          style={{ animation: "pop-in 0.15s ease-out" }}
        >
          <div className="mb-1 px-2 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recent searches
          </div>
          {matches.map((term) => (
            <button
              key={term}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(term)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{term}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Grid vs List view toggle ---- */
export function ViewToggle({
  view,
  setView,
}: {
  view: "list" | "grid";
  setView: (v: "list" | "grid") => void;
}) {
  const items = [
    { key: "list" as const, icon: <List className="h-4 w-4" />, label: "List" },
    {
      key: "grid" as const,
      icon: <LayoutGrid className="h-4 w-4" />,
      label: "Grid",
    },
  ];
  return (
    <div className="flex items-center rounded-lg border border-border bg-secondary/40 p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setView(it.key)}
          title={`${it.label} view`}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-all",
            view === it.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.icon}
          <span className="hidden sm:inline">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---- Sort-by control (dropdown + direction) ---- */
export function SortControl({
  sort,
  setSort,
  dir,
  toggleDir,
}: {
  sort: SortKey;
  setSort: (s: SortKey) => void;
  dir: "asc" | "desc";
  toggleDir: () => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-secondary/40">
      <Popover
        align="end"
        className="w-52 p-1.5"
        trigger={
          <span className="flex h-8 items-center gap-1.5 rounded-l-md px-3 text-sm font-medium text-foreground hover:bg-secondary">
            <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Sort:</span>
            {/* Every label occupies the same grid cell, so the trigger is
                always as wide as the longest one. */}
            <span className="grid">
              {SORT_OPTIONS.map((o) => (
                <span
                  key={o.key}
                  aria-hidden={o.key !== sort}
                  className={cn(
                    "col-start-1 row-start-1",
                    o.key !== sort && "invisible",
                  )}
                >
                  {o.label}
                </span>
              ))}
            </span>
          </span>
        }
      >
        <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sort by
        </div>
        <div className="flex flex-col">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setSort(o.key)}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                sort === o.key
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-secondary",
              )}
            >
              {o.label}
              {sort === o.key && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </Popover>
      <button
        onClick={toggleDir}
        title={dir === "asc" ? "Ascending" : "Descending"}
        className="grid h-8 w-8 place-items-center rounded-r-md border-l border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {dir === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/* ---- Filter chip (toggleable pill) ---- */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ---- Filter control (chips inside a dropdown) ---- */
export function FilterControl({
  genres,
  tags,
  genreFilter,
  setGenreFilter,
  tagsFilter,
  setTagsFilter,
  favoriteOnly,
  setFavoriteOnly,
  active,
  onClear,
}: {
  genres: string[];
  tags: string[];
  genreFilter: string[];
  setGenreFilter: (v: string[]) => void;
  tagsFilter: string[];
  setTagsFilter: (v: string[]) => void;
  favoriteOnly: boolean;
  setFavoriteOnly: (v: boolean) => void;
  active: number;
  onClear: () => void;
}) {
  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
  return (
    <Popover
      align="end"
      className="w-80 p-3"
      trigger={
        <span
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 text-sm font-medium transition-colors hover:bg-secondary",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <ListFilter className="h-3.5 w-3.5" />
          Filter
          {/* Always rendered (hidden at 0) so the button doesn't widen when a
              filter is picked. */}
          <span
            aria-hidden={active === 0}
            className={cn(
              "grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground",
              active === 0 && "invisible",
            )}
          >
            {active}
          </span>
        </span>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </span>
        {active > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <Chip
        active={favoriteOnly}
        onClick={() => setFavoriteOnly(!favoriteOnly)}
      >
        <Heart className={cn("h-3.5 w-3.5", favoriteOnly && "fill-current")} />
        Favorites
      </Chip>

      {genres.length > 0 && (
        <>
          <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Genre
          </div>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Chip
                key={g}
                active={genreFilter.includes(g)}
                onClick={() => toggle(genreFilter, g, setGenreFilter)}
              >
                {g}
              </Chip>
            ))}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <>
          <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip
                key={t}
                active={tagsFilter.includes(t)}
                onClick={() => toggle(tagsFilter, t, setTagsFilter)}
              >
                {t}
              </Chip>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}
