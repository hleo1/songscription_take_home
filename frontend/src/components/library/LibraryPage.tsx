import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Music4, Plus } from "lucide-react";
import { AddSong } from "./AddSong";
import { SongGrid } from "./SongGrid";
import { SongList } from "./SongList";
import { FilterControl, SearchBar, SortControl, ViewToggle } from "./Toolbar";
import { MaskIcon } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

/** The catalog: toolbar, list/grid, pager and upload. */
export function LibraryPage() {
  const {
    view,
    setView,
    sort,
    setSort,
    dir,
    toggleDir,
    catalog,
    search,
    setSearch,
    submitSearch,
    genreFilter,
    setGenreFilter,
    tagsFilter,
    setTagsFilter,
    favoriteOnly,
    setFavoriteOnly,
    clearFilters,
    reveal,
    allGenres,
    allTags,
    saving,
    loading,
    error,
    retry,
    page,
    pages,
    total,
    libraryTotal,
    setPage,
    previousSearches,
  } = useStore();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  // Typing filters on its own shortly after you stop, rather than on Enter.
  useEffect(() => {
    if (draft === search) return;
    const t = setTimeout(() => setSearch(draft), 250);
    return () => clearTimeout(t);
  }, [draft, search, setSearch]);
  const activeFilters =
    genreFilter.length + tagsFilter.length + (favoriteOnly ? 1 : 0);

  return (
    <div className="min-h-screen">
      {/* Sticky top bar: brand + library toolbar */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-2 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Music4 className="h-4 w-4" />
            </span>
            <span className="font-display text-lg tracking-tight">
              Songscription
            </span>
            <Link
              href="/settings"
              title="Settings"
              aria-label="Settings"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <MaskIcon src="/icons/sound-setting.png" className="h-6 w-6" />
            </Link>
          </div>
          {/* Library title + UI settings */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 py-3">
            <div>
              <h1 className="text-lg font-semibold">
                What would you like to practice?
              </h1>
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? "song" : "songs"}
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SearchBar
                draft={draft}
                setDraft={setDraft}
                setSearch={setSearch}
                submitSearch={submitSearch}
                suggestions={previousSearches}
              />
              <FilterControl
                genres={allGenres}
                tags={allTags}
                genreFilter={genreFilter}
                setGenreFilter={setGenreFilter}
                tagsFilter={tagsFilter}
                setTagsFilter={setTagsFilter}
                favoriteOnly={favoriteOnly}
                setFavoriteOnly={setFavoriteOnly}
                active={activeFilters}
                onClear={clearFilters}
              />
              <SortControl
                sort={sort}
                setSort={setSort}
                dir={dir}
                toggleDir={toggleDir}
              />
              <ViewToggle view={view} setView={setView} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-28 pt-6">
        {error && (
          <div className="mb-4 flex items-center justify-end gap-3 text-xs text-red-700">
            <span role="alert">
              {error}{" "}
              <button className="underline text-primary" onClick={retry}>
                Retry
              </button>
            </span>
          </div>
        )}

        {catalog.length === 0 && !loading && (
          <p className="py-12 text-center text-muted-foreground">
            {libraryTotal === 0 && !search.trim() && activeFilters === 0
              ? "Welcome to Songscription, upload your first MIDI file to start learning your favorite songs!"
              : "No songs match your search."}
          </p>
        )}
        {/* Catalog — dimmed behind a spinner while results are being fetched.
            The min height while loading keeps the spinner clear of the pager. */}
        <div className={cn("relative", loading && "min-h-24")}>
          <div
            key={view}
            className={cn(
              "transition-opacity duration-150",
              loading && "pointer-events-none opacity-40",
            )}
          >
            {view === "list" ? <SongList /> : <SongGrid />}
          </div>
          {loading && (
            <div
              role="status"
              aria-label="Loading songs"
              className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-10"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
        <nav
          aria-label="Catalog pages"
          className="mt-8 flex items-center justify-center gap-5"
        >
          <Button
            disabled={page <= 1 || saving}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {pages}
          </span>
          <Button
            disabled={page >= pages || saving}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      </main>

      <AddSong
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={reveal}
      />
      {/* Upload FAB — bottom center */}
      <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center">
        <Button
          onClick={() => setAdding(true)}
          size="lg"
          className="gap-2 rounded-full px-6 shadow-2xl shadow-primary/30"
        >
          <Plus className="h-5 w-5" />
          Upload MIDI
        </Button>
      </div>
    </div>
  );
}
