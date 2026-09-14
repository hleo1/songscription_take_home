"use client";

import { LibraryPage } from "@/components/library/LibraryPage";
import { StoreProvider } from "@/lib/store";
import type { CatalogPage } from "@/lib/models";

const emptyLibrary: CatalogPage = {
  songs: [],
  metadata: {},
  allTags: [],
  allGenres: [],
  previousSearches: [],
  total: 0,
  libraryTotal: 0,
  page: 1,
  pages: 1,
  settings: {
    view: "grid",
    genreFilter: [],
    tagsFilter: [],
    favoriteOnly: false,
    sort: "recent",
    dir: "desc",
    instrument: "grand",
    volume: 80,
  },
};

export default function EmptyCatalogPreview() {
  return (
    <StoreProvider previewData={emptyLibrary}>
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-2 text-xs text-muted-foreground">
        <span>Empty catalog preview · Your songs are still saved.</span>
        <a href="/" className="text-primary underline">
          Back to your library
        </a>
      </div>
      <LibraryPage />
    </StoreProvider>
  );
}
