"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  CatalogPage,
  Editable,
  LibrarySettings,
  PracticeLog,
  Song,
  SongWithHistory,
} from "@/lib/models";
import { pausePlayback } from "@/lib/playback";
export type { Editable } from "@/lib/models";
export type ViewMode = LibrarySettings["view"];
export type SortKey = LibrarySettings["sort"];
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently played" },
  { key: "added", label: "Recently added" },
  { key: "alpha", label: "Alphabetical" },
];
type Data = CatalogPage;
type Change =
  | { url: string; method: "PATCH"; body: object }
  | { url: string; method: "DELETE"; body?: undefined };
interface Store extends LibrarySettings {
  search: string;
  selectedId: string | null;
  /** The selected song: from the current page, or as last seen once a write
      moves it off the page (so the detail panel stays open). */
  selectedSong: Song | undefined;
  /** The selected song's practice history; null while it loads. */
  history: PracticeLog[] | null;
  open: (id: string) => void;
  close: () => void;
  getMeta: (s: Song) => Editable;
  update: (id: string, p: Partial<Editable>) => void;
  rename: (id: string, title: string) => void;
  setView: (v: ViewMode) => void;
  setSort: (s: SortKey) => void;
  toggleDir: () => void;
  setSearch: (s: string) => void;
  /** Searches and saves the term to recent searches (Enter, or picking one). */
  submitSearch: (s: string) => void;
  setGenreFilter: (v: string[]) => void;
  setTagsFilter: (v: string[]) => void;
  setFavoriteOnly: (v: boolean) => void;
  clearFilters: () => void;
  reveal: (id: string) => void;
  remove: (id: string) => void;
  catalog: Song[];
  allGenres: string[];
  allTags: string[];
  previousSearches: string[];
  saving: boolean;
  loading: boolean;
  error: string | null;
  retry: () => void;
  page: number;
  pages: number;
  total: number;
  libraryTotal: number;
  setPage: (p: number) => void;
}
const Ctx = createContext<Store | null>(null);
/** Client state for the catalog page. Edits apply optimistically, then queue
    as sequential PATCHes; each write responds with the refreshed catalog page.
    The search term lives only here and rides along as ?search= on every
    catalog request, so it resets on reload. */
export function StoreProvider({
  children,
  initialData,
  previewData,
}: {
  children: React.ReactNode;
  /** The first page, rendered on the server; skips the initial client fetch. */
  initialData?: Data;
  /** Fixed data for design previews; nothing is fetched or saved. */
  previewData?: Data;
}) {
  const [data, setData] = useState<Data | null>(
    previewData ?? initialData ?? null,
  );
  const [selectedId, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  // The open song as last seen, with its history once fetched. The panel reads
  // it when the song isn't on the current page: opened via /?song=<id>, or
  // moved off by a write (e.g. un-favoriting it under the Favorites filter).
  const [pinned, setPinned] = useState<
    (Omit<SongWithHistory, "history"> & { history: PracticeLog[] | null }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearchState] = useState("");
  const pageRef = useRef(1);
  const searchRef = useRef("");
  const queue = useRef<Change[]>([]);
  // The change currently on the wire (never merged into or dropped).
  const sending = useRef<Change | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  // Page and search for the next catalog request (read at send time).
  const catalogQuery = () =>
    `page=${pageRef.current}&search=${encodeURIComponent(searchRef.current)}`;
  // Every request that returns a catalog page claims a version up front; a
  // slower response that lost the race is dropped rather than applied.
  const apply = (d: Data, version: number) => {
    if (version !== generation.current) return;
    setData(d);
    pageRef.current = d.page;
    // Keep the open song current while it's on the page.
    setPinned((p) => {
      if (!p) return p;
      const song = d.songs.find((s) => s.id === p.song.id);
      return song ? { ...p, song, meta: d.metadata[song.id] } : p;
    });
  };
  const load = async () => {
    if (previewData) return;
    const version = ++generation.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/songs?${catalogQuery()}`, {
        cache: "no-store",
      });
      if (!r.ok) throw Error("Could not load your library.");
      const d: Data = await r.json();
      apply(d, version);
      return d;
    } finally {
      setLoading(false);
    }
  };
  // A failed catalog load isn't shown to the user: the last page (or the
  // loading screen) stays up and the load is retried shortly.
  const refresh = (): Promise<Data | undefined> =>
    load().catch(async () => {
      const version = generation.current;
      await new Promise((r) => setTimeout(r, 3000));
      // A newer catalog request has taken over; it retries on its own.
      return version === generation.current ? refresh() : undefined;
    });
  // Selects a song and fetches its history (plus the song itself when it isn't
  // on `page`). Edits made while that loads are kept.
  const openSong = (id: string, page: Data | null) => {
    if (selectedRef.current !== id) pausePlayback();
    selectedRef.current = id;
    setSelected(id);
    const song = page?.songs.find((s) => s.id === id);
    setPinned(
      song && page ? { song, meta: page.metadata[id], history: null } : null,
    );
    if (previewData) return;
    fetch(`/api/songs/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) =>
        r.ok ? (r.json() as Promise<SongWithHistory>) : Promise.reject(),
      )
      .then((d) => {
        if (selectedRef.current !== id) return;
        setPinned((p) =>
          p?.song.id === id ? { ...p, history: d.history } : d,
        );
      })
      .catch(() => {
        if (selectedRef.current === id)
          setError("Could not load this song's practice history.");
      });
  };
  const close = () => {
    selectedRef.current = null;
    setSelected(null);
    setPinned(null);
  };
  // The open song is mirrored in ?song=<id>, so a reload or shared link
  // reopens it and Back closes it. `pushed`: the current history entry was
  // added by opening, so closing goes back to the entry before it.
  const pushed = useRef(false);
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  });
  const songParam = () =>
    new URLSearchParams(window.location.search).get("song");
  const showSong = (id: string, page: Data | null) => {
    openSong(id, page);
    if (previewData) return;
    const url = `?song=${encodeURIComponent(id)}`;
    if (pushed.current) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    pushed.current = true;
  };
  const hideSong = () => {
    close();
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else if (songParam())
      window.history.replaceState(null, "", window.location.pathname);
  };
  useEffect(() => {
    // Back/Forward between entries with and without ?song=.
    const onPop = () => {
      const id = songParam();
      pushed.current = !!id;
      if (!id) close();
      else if (id !== selectedRef.current) openSong(id, latest.current);
    };
    window.addEventListener("popstate", onPop);
    // /?song=<id> (a reload, a shared link, returning from practice) opens
    // that song once loaded.
    const id = songParam();
    const first = initialData ? Promise.resolve(initialData) : refresh();
    void first.then((d) => {
      if (id) openSong(id, d ? d : null);
    });
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const drain = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    // stale: the list on screen may not match the server (after a delete or a
    // dropped change) and needs a re-fetch. rejected: a change was dropped.
    let stale = false;
    let rejected = false;
    try {
      while (queue.current.length) {
        const c = queue.current[0];
        sending.current = c;
        const version = ++generation.current;
        // A PATCH returns the refreshed page, so no follow-up GET is needed.
        const r =
          c.method === "PATCH"
            ? await fetch(`${c.url}?${catalogQuery()}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(c.body),
              })
            : await fetch(c.url, { method: "DELETE" });
        // A server error may pass on retry, so the change stays queued.
        if (r.status >= 500)
          throw Error(
            c.method === "DELETE"
              ? "Could not delete this song."
              : "Changes could not be saved. Retry to keep your edits.",
          );
        queue.current.shift();
        sending.current = null;
        if (!r.ok) {
          // A 4xx (e.g. the song is already gone) won't pass on retry: drop it
          // rather than block every later change.
          stale = rejected = true;
        } else if (c.method === "DELETE") {
          stale = true;
        } else if (!queue.current.length) {
          // Only the last write of a burst refreshes the list, so pending
          // optimistic edits aren't clobbered mid-flight.
          apply(await r.json(), version);
          stale = false;
        }
      }
      if (stale) await refresh();
      if (rejected) setError("Some changes couldn't be saved and were undone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      busy.current = false;
      sending.current = null;
      setSaving(false);
      setLoading(false);
    }
  };
  const enqueue = (change: Change) => {
    if (previewData) return;
    const last = queue.current.at(-1);
    // Quick repeated edits to one target (e.g. tapping tempo +) merge into the
    // queued PATCH that hasn't been sent yet, so a burst costs one request.
    if (
      last &&
      last !== sending.current &&
      last.method === "PATCH" &&
      change.method === "PATCH" &&
      last.url === change.url
    )
      last.body = { ...last.body, ...change.body };
    else queue.current.push(change);
    void drain();
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.current.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  if (!data)
    return (
      <main className="grid min-h-screen place-content-center gap-4 text-center">
        <p role="status">Loading your library…</p>
      </main>
    );
  // A settings change re-queries the catalog, so the list shows a spinner until
  // the write comes back with the new page (drain clears it).
  const settings = (patch: Partial<LibrarySettings>) => {
    pageRef.current = 1;
    if (!previewData) setLoading(true);
    setData((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d));
    enqueue({ url: "/api/settings", method: "PATCH", body: patch });
  };
  // Search isn't a setting: update it locally; the caller decides what
  // request carries it (a GET on its own, or a settings write).
  const applySearch = (term: string) => {
    searchRef.current = term;
    setSearchState(term);
    pageRef.current = 1;
  };
  const clearAll = () => {
    applySearch("");
    settings({ genreFilter: [], tagsFilter: [], favoriteOnly: false });
  };
  const filtering =
    !!search.trim() ||
    data.settings.genreFilter.length > 0 ||
    data.settings.tagsFilter.length > 0 ||
    data.settings.favoriteOnly;
  return (
    <Ctx.Provider
      value={{
        ...data.settings,
        search,
        selectedId,
        open: (id) => showSong(id, data),
        close: hideSong,
        selectedSong: selectedId
          ? (data.songs.find((s) => s.id === selectedId) ??
            (pinned?.song.id === selectedId ? pinned.song : undefined))
          : undefined,
        history: pinned?.song.id === selectedId ? pinned.history : null,
        getMeta: (s) =>
          pinned?.song.id === s.id ? pinned.meta : data.metadata[s.id],
        update: (id, patch) => {
          setPinned((o) =>
            o?.song.id === id ? { ...o, meta: { ...o.meta, ...patch } } : o,
          );
          setData((d) =>
            d?.metadata[id]
              ? {
                  ...d,
                  metadata: {
                    ...d.metadata,
                    [id]: { ...d.metadata[id], ...patch },
                  },
                }
              : d,
          );
          enqueue({
            url: `/api/songs/${encodeURIComponent(id)}`,
            method: "PATCH",
            body: patch,
          });
        },
        rename: (id, title) => {
          setPinned((o) =>
            o?.song.id === id ? { ...o, song: { ...o.song, title } } : o,
          );
          setData((d) =>
            d
              ? {
                  ...d,
                  songs: d.songs.map((s) =>
                    s.id === id ? { ...s, title } : s,
                  ),
                }
              : d,
          );
          enqueue({
            url: `/api/songs/${encodeURIComponent(id)}`,
            method: "PATCH",
            body: { title },
          });
        },
        setView: (view) => settings({ view }),
        setSort: (sort) =>
          settings({ sort, dir: sort === "alpha" ? "asc" : "desc" }),
        toggleDir: () =>
          settings({ dir: data.settings.dir === "asc" ? "desc" : "asc" }),
        setSearch: (term) => {
          applySearch(term);
          void refresh();
        },
        // The list reloads once the save lands, so the recent searches it
        // returns include the term just submitted.
        submitSearch: (term) => {
          applySearch(term);
          if (!term.trim() || previewData) return void refresh();
          void fetch("/api/searches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ term }),
          })
            .catch(() => {}) // a missing suggestion shouldn't block the search
            .finally(() => void refresh());
        },
        setGenreFilter: (genreFilter) => settings({ genreFilter }),
        setTagsFilter: (tagsFilter) => settings({ tagsFilter }),
        setFavoriteOnly: (favoriteOnly) => settings({ favoriteOnly }),
        clearFilters: clearAll,
        // Show a song (e.g. one just uploaded) and open its detail. Active
        // filters would hide a new song, so they're cleared first.
        reveal: (id) => {
          pageRef.current = 1;
          if (filtering) clearAll();
          else void refresh();
          showSong(id, data);
        },
        remove: (id) => {
          hideSong();
          const url = `/api/songs/${encodeURIComponent(id)}`;
          // The delete queues behind the edit already on its way; unsent edits
          // to this song are dropped, since they'd fail once it's gone.
          queue.current = queue.current.filter(
            (c) => c === sending.current || c.url !== url,
          );
          enqueue({ url, method: "DELETE" });
        },
        catalog: data.songs,
        allGenres: data.allGenres,
        allTags: data.allTags,
        previousSearches: data.previousSearches,
        saving,
        loading,
        error,
        // Re-sends queued changes; with nothing queued the failure was a load,
        // so re-fetch the page (and the open song's history).
        retry: () => {
          if (queue.current.length) return void drain();
          void refresh();
          if (selectedRef.current) openSong(selectedRef.current, data);
        },
        page: data.page,
        pages: data.pages,
        total: data.total,
        libraryTotal: data.libraryTotal,
        setPage: (p) => {
          pageRef.current = p;
          hideSong();
          refresh();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw Error("StoreProvider missing");
  return c;
}
