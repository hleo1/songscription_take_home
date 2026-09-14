/* API shapes, matching the FastAPI models (backend/app/models.py), which
   validate every request. */

/** A user's desired playback settings for one song. */
export interface Editable {
  bpm: number;
  hand: "left" | "right" | "both";
  transpose: number;
  tags: string[];
  favorite: boolean;
}

export interface LibrarySettings {
  view: "list" | "grid";
  genreFilter: string[];
  tagsFilter: string[];
  favoriteOnly: boolean;
  sort: "recent" | "added" | "alpha";
  dir: "asc" | "desc";
  // Playback settings: stored and editable, not yet applied to audio.
  instrument: "grand" | "bright" | "electric" | "felt";
  volume: number;
}

/** A completed practice session. `minutes` is derived from date → endTime on read. */
export interface PracticeLog {
  id: string;
  date: string;
  endTime: string;
  minutes: number;
  accuracy: number;
}

/** A practice_sessions row: open while endTime is null; ending it sets
    endTime and accuracy together. */
export interface PracticeSession {
  id: string;
  song_id: string;
  startTime: string;
  endTime: string | null;
  accuracy: number | null;
}

/** A song as listed in the catalog. Its editable settings and tags are in
    `CatalogPage.metadata`; its full practice history comes from `SongWithHistory`. */
export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  coverUrl: string | null;
  durationSec: number;
  bpm: number;
  originalRoot: number;
  originalMode: "Major" | "Minor";
  addedAt: string;
  audioUrl: string | null;
  /** Start of the latest finished practice session; "" if never practiced. */
  lastPracticed: string;
  /** Accuracy of that session; null if never practiced. */
  lastAccuracy: number | null;
}

/** GET /api/songs/:id: one song with its settings and practice history (oldest first). */
export interface SongWithHistory {
  song: Song;
  meta: Editable;
  history: PracticeLog[];
}

/** One catalog page, as returned by GET /api/songs and the write endpoints.
    `songs` holds only this page (up to 20). */
export interface CatalogPage {
  songs: Song[];
  metadata: Record<string, Editable>;
  settings: LibrarySettings;
  previousSearches: string[];
  allTags: string[];
  allGenres: string[];
  total: number;
  libraryTotal: number;
  page: number;
  pages: number;
}
