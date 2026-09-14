import { z } from "zod";

/* ---- Request validation (zod) ---- */

export const handSchema = z.enum(["left", "right", "both"]);
/** A user's desired playback settings for one song. */
export const editableSchema = z
  .object({
    bpm: z.number().int().min(20).max(240),
    hand: handSchema,
    transpose: z.number().int().min(-12).max(12),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .transform((v) => [...new Set(v)]),
    favorite: z.boolean(),
  })
  .strict();
/** The playback settings Start Practice saves before opening a session. */
export const practiceSettingsSchema = editableSchema
  .pick({ bpm: true, hand: true, transpose: true })
  .partial();
export const settingsSchema = z
  .object({
    view: z.enum(["list", "grid"]),
    genreFilter: z
      .array(z.string().trim().min(1).max(80))
      .max(50)
      .transform((v) => [...new Set(v)]),
    tagsFilter: z
      .array(z.string().trim().min(1).max(40))
      .max(50)
      .transform((v) => [...new Set(v)]),
    favoriteOnly: z.boolean(),
    sort: z.enum(["recent", "added", "alpha"]),
    dir: z.enum(["asc", "desc"]),
    // Playback settings: stored and editable, not yet applied to audio.
    instrument: z.enum(["grand", "bright", "electric", "felt"]),
    volume: z.number().int().min(0).max(100),
  })
  .strict();
// Patch accepted by PATCH /api/songs/[id]: per-user settings (Editable) plus the
// song-level title, which lives on the songs table rather than song_settings.
export const songPatchSchema = editableSchema
  .partial()
  .extend({ title: z.string().trim().min(1).max(200).optional() })
  .strict();
export const newSongSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    artist: z.string().trim().min(1).max(200),
    genre: z.string().trim().min(1).max(80),
    durationSec: z.number().int().min(1).max(86400),
    bpm: z.number().int().min(20).max(240),
    originalRoot: z.number().int().min(0).max(11),
    originalMode: z.enum(["Major", "Minor"]),
    audioUrl: z
      .url()
      .refine((v) => /^https?:\/\//.test(v), "Use an HTTP or HTTPS audio URL")
      .nullable(),
    coverUrl: z
      .url()
      .refine((v) => /^https?:\/\//.test(v), "Use an HTTP or HTTPS image URL")
      .nullable(),
  })
  .strict();

export type Hand = z.infer<typeof handSchema>;
export type Editable = z.infer<typeof editableSchema>;
export type LibrarySettings = z.infer<typeof settingsSchema>;
export type NewSong = z.infer<typeof newSongSchema>;

/* ---- API response shapes ---- */

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
