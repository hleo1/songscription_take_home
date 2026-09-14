import random
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from .models import NewSong
from .supabase_client import BUCKET, admin

# Single local-prototype identity. Replace with a verified session before any
# public deployment (and add RLS keyed on auth.uid()).
USER_ID = "local-demo"

# Runs independent Supabase requests concurrently. Only leaf queries are
# submitted (never work that submits more), so the pool can't deadlock.
_pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="supabase")


def now_iso() -> str:
    """Same format as JavaScript's toISOString(), which the stored timestamps use."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def get_settings() -> dict:
    """The user's library settings; active filters live one-per-row in library_filters."""
    # admin() is called inside the task: each thread must use its own client.
    filters_f = _pool.submit(
        lambda: admin().table("library_filters").select("kind,value").eq("user_id", USER_ID).execute().data
    )
    row = admin().table("library_settings").select("*").eq("user_id", USER_ID).single().execute().data
    filters = filters_f.result()

    def of(kind: str) -> list[str]:
        return sorted(f["value"] for f in filters if f["kind"] == kind)

    return {
        "view": row["view"],
        "genreFilter": of("genre"),
        "tagsFilter": of("tag"),
        "favoriteOnly": row["favoriteOnly"],
        "sort": row["sort"],
        "dir": row["dir"],
        "instrument": row["instrument"],
        "volume": row["volume"],
    }


def _songs_query():
    """Songs with their settings, tags and latest finished practice session."""
    return (
        admin()
        .table("songs")
        .select("*, song_settings(*), song_tags(tag), practice_sessions(startTime, accuracy)")
        .eq("user_id", USER_ID)
        .not_.is_("practice_sessions.endTime", "null")
        .order("startTime", desc=True, foreign_table="practice_sessions")
        .order("id", desc=True, foreign_table="practice_sessions")
        .limit(1, foreign_table="practice_sessions")
    )


def _to_song(row: dict) -> tuple[dict, dict] | None:
    """(song, meta) for a songs-query row, or None if it has no settings row."""
    ss = row["song_settings"]
    if not ss:
        return None
    last = row["practice_sessions"][0] if row["practice_sessions"] else None
    meta = {
        "bpm": ss["bpm"],
        "hand": ss["hand"],
        "transpose": ss["transpose"],
        "tags": sorted(t["tag"] for t in row["song_tags"]),
        "favorite": ss["favorite"],
    }
    song = {
        **{k: row[k] for k in ("id", "title", "artist", "genre", "coverUrl", "durationSec", "bpm")},
        **{k: row[k] for k in ("originalRoot", "originalMode", "addedAt", "audioUrl")},
        "lastPracticed": last["startTime"] if last else "",
        "lastAccuracy": last["accuracy"] if last else None,
    }
    return song, meta


def get_catalog_page(page: int, search: str) -> dict:
    """One catalog page. Filtering, sorting and paging run in the catalog_page
    function; only the page's songs are then fetched with their details.
    Everything but that second fetch runs concurrently."""
    catalog_f = _pool.submit(
        lambda: admin()
        .rpc("catalog_page", {"p_user_id": USER_ID, "p_search": search, "p_page": page})
        .execute()
        .data
    )
    searches_f = _pool.submit(get_searches)
    settings = get_settings()
    c = catalog_f.result()
    songs: list[dict] = []
    metadata: dict[str, dict] = {}
    if c["ids"]:
        rows = {r["id"]: r for r in _songs_query().in_("id", c["ids"]).execute().data}
        # Keep catalog_page's order; skip a song deleted between the two queries.
        for id in c["ids"]:
            s = _to_song(rows[id]) if id in rows else None
            if s:
                songs.append(s[0])
                metadata[id] = s[1]
    return {
        "songs": songs,
        "metadata": metadata,
        "settings": settings,
        "previousSearches": searches_f.result(),
        "allTags": c["tags"],
        "allGenres": c["genres"],
        "total": c["total"],
        "libraryTotal": c["libraryTotal"],
        "page": c["page"],
        "pages": c["pages"],
    }


def get_song(id: str) -> dict | None:
    """One song with its settings and full practice history (oldest first), or
    None if the user doesn't own it. Loaded when the detail panel opens."""
    res = _songs_query().eq("id", id).maybe_single().execute()
    # Ownership is checked by the songs query; the sessions are read only if it passes.
    s = _to_song(res.data) if res and res.data else None
    if not s:
        return None
    logs = (
        admin()
        .table("practice_sessions")
        .select("id, startTime, endTime, accuracy")
        .eq("song_id", id)
        .not_.is_("endTime", "null")
        .order("startTime")
        .order("id")
        .execute()
        .data
    )
    history = [
        {
            "id": p["id"],
            "date": p["startTime"],
            "endTime": p["endTime"],
            # Duration is derived from the timestamps rather than stored.
            "minutes": max(
                0.0,
                (datetime.fromisoformat(p["endTime"]) - datetime.fromisoformat(p["startTime"])).total_seconds() / 60,
            ),
            "accuracy": p["accuracy"],
        }
        for p in logs
    ]
    return {"song": s[0], "meta": s[1], "history": history}


def get_searches() -> list[str]:
    rows = (
        admin()
        .table("searches")
        .select("term")
        .eq("user_id", USER_ID)
        .order("searchedAt", desc=True)
        .limit(10)
        .execute()
        .data
    )
    return [r["term"] for r in rows]


def update_song(id: str, patch: dict) -> bool:
    """Applies a song patch atomically (update_song). Returns False if the song
    isn't in this user's library."""
    return admin().rpc("update_song", {"p_user_id": USER_ID, "p_song_id": id, "p_patch": patch}).execute().data


def update_settings(patch: dict) -> None:
    """Applies a settings patch atomically (set_library_settings)."""
    admin().rpc("set_library_settings", {"p_user_id": USER_ID, "p_patch": patch}).execute()


def record_search(term: str) -> None:
    """Remembers a search term for the recent-search suggestions. Only explicit
    submissions land here — keystrokes filter the list without being saved."""
    value = term.strip()
    if not value:
        return
    admin().table("searches").upsert(
        {"user_id": USER_ID, "term": value, "searchedAt": now_iso()},
        on_conflict="user_id,term",
    ).execute()


def create_song(song: NewSong, audio: bytes) -> str:
    """Stores the MP3 and creates the song with its default settings."""
    sb = admin()
    id = str(uuid.uuid4())
    path = f"{id}.mp3"
    sb.storage.from_(BUCKET).upload(path, audio, {"content-type": "audio/mpeg"})
    try:
        sb.rpc(
            "create_song",
            {
                "p_user_id": USER_ID,
                "p_id": id,
                "p_title": song.title,
                "p_artist": song.artist,
                "p_genre": song.genre,
                "p_cover_url": None,  # set later by the cover agent; until then the app shows the score SVG
                "p_duration": song.durationSec,
                "p_bpm": song.bpm,
                "p_root": song.originalRoot,
                "p_mode": song.originalMode,
                "p_added": now_iso(),
                "p_audio_url": sb.storage.from_(BUCKET).get_public_url(path),
            },
        ).execute()
    except Exception:
        # Don't strand the uploaded audio when the song row wasn't created.
        sb.storage.from_(BUCKET).remove([path])
        raise
    return id


def delete_song(id: str) -> bool:
    """Deletes a song with its settings, tags, practice sessions and audio file.
    Returns False when the song isn't in this user's library."""
    sb = admin()
    # Settings, tags and practice sessions cascade from the songs row.
    deleted = sb.table("songs").delete().eq("id", id).eq("user_id", USER_ID).execute().data
    if not deleted:
        return False
    try:
        sb.storage.from_(BUCKET).remove([f"{id}.mp3"])
    except Exception:
        pass  # Best effort: a stranded audio object shouldn't fail the delete.
    return True


def set_song_cover(id: str, cover_url: str) -> None:
    """Patch a song's album art after the cover agent resolves an image URL."""
    admin().table("songs").update({"coverUrl": cover_url}).eq("id", id).eq("user_id", USER_ID).execute()


def get_practice_session(id: str | None) -> dict | None:
    """A practice session by id, or the user's open session when no id is given.
    Sessions belong to the user through their song."""
    q = admin().table("practice_sessions").select("*, songs!inner(user_id)").eq("songs.user_id", USER_ID)
    q = q.eq("id", id) if id else q.is_("endTime", "null")
    res = q.maybe_single().execute()
    if not res or not res.data:
        return None
    return {k: v for k, v in res.data.items() if k != "songs"}


def start_practice(song_id: str, patch: dict) -> dict | None:
    """The open session (new or already open), or None when the song isn't in
    this user's library."""
    return (
        admin()
        .rpc(
            "start_practice",
            {
                "p_user_id": USER_ID,
                "p_song_id": song_id,
                "p_patch": patch,
                "p_id": str(uuid.uuid4()),
                "p_start": now_iso(),
            },
        )
        .execute()
        .data
    )


def end_practice(id: str) -> dict | None:
    """The ended session, or None when the session isn't found."""
    return (
        admin()
        .rpc(
            "end_practice",
            {"p_id": id, "p_user_id": USER_ID, "p_end": now_iso(), "p_accuracy": 85 + random.randrange(16)},
        )
        .execute()
        .data
    )
