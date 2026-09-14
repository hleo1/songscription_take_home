-- Songscription catalogue — Postgres schema + RPC functions.
-- Apply to an empty database with `npm run db:reset` (delete, migrate, seed).
--
-- Third normal form:
--   * every song belongs to one user (songs.user_id); tables about a song key
--     on song_id alone instead of repeating user_id
--   * no repeating groups — tags and active filters are rows, not JSON arrays
--   * no derived or duplicated facts — a practice session becomes a log by
--     gaining endTime + accuracy, and its duration is computed on read
-- Timestamps are text ISO strings, matching the app's string-based date
-- handling (sorting, "added today" checks, UTC day boundaries).

create table users (
  id   text primary key,
  name text not null
);

create table songs (
  id             text primary key,
  user_id        text not null references users(id) on delete cascade,
  title          text not null,
  artist         text not null,
  genre          text not null,
  "durationSec"  integer not null check ("durationSec" > 0),
  bpm            integer not null check (bpm between 20 and 240),
  "originalRoot" integer not null check ("originalRoot" between 0 and 11),
  "originalMode" text not null check ("originalMode" in ('Major','Minor')),
  "addedAt"      text not null,
  "audioUrl"     text,
  "coverUrl"     text    -- album art found by the upload agent; null → score SVG
);
create index songs_user on songs(user_id);

-- The owner's desired playback settings for a song (one row per song).
-- Transpose is relative to the song's originalRoot; the key isn't copied here.
create table song_settings (
  song_id   text primary key references songs(id) on delete cascade,
  bpm       integer not null check (bpm between 20 and 240),
  hand      text not null default 'both' check (hand in ('left','right','both')),
  transpose integer not null default 0 check (transpose between -12 and 12),
  favorite  boolean not null default false
);

-- One row per (song, tag). A user's tags are the distinct tags on their songs.
create table song_tags (
  song_id text not null references songs(id) on delete cascade,
  tag     text not null,
  primary key (song_id, tag)
);

-- A practice session. It is open while endTime is null; ending it sets
-- endTime and accuracy together, which makes it a practice log.
-- Duration is startTime → endTime; it is not stored.
create table practice_sessions (
  id          text primary key,
  song_id     text not null references songs(id) on delete cascade,
  "startTime" text not null,
  "endTime"   text,
  accuracy    integer check (accuracy between 0 and 100),
  check (("endTime" is null) = (accuracy is null))
);
create index practice_by_song_start on practice_sessions(song_id, "startTime");

create table library_settings (
  user_id        text primary key references users(id) on delete cascade,
  view           text    not null default 'list'  check (view in ('list','grid')),
  "favoriteOnly" boolean not null default false,
  sort           text    not null default 'recent' check (sort in ('recent','added','alpha')),
  dir            text    not null default 'desc'  check (dir in ('asc','desc')),
  -- Playback settings. Stored and editable; not yet applied to audio.
  instrument     text    not null default 'grand' check (instrument in ('grand','bright','electric','felt')),
  volume         integer not null default 80      check (volume between 0 and 100)
);

-- One row per active filter value.
create table library_filters (
  user_id text not null references users(id) on delete cascade,
  kind    text not null check (kind in ('genre','tag')),
  value   text not null,
  primary key (user_id, kind, value)
);

create table searches (
  user_id      text not null references users(id) on delete cascade,
  term         text not null,
  "searchedAt" text not null,
  primary key (user_id, term)
);

-- ---------------------------------------------------------------------------
-- RPC functions. plpgsql bodies execute atomically, so multi-step writes
-- cannot half-apply.
-- ---------------------------------------------------------------------------

create function create_song(
  p_user_id text, p_id text, p_title text, p_artist text, p_genre text,
  p_cover_url text, p_duration int, p_bpm int, p_root int,
  p_mode text, p_added text, p_audio_url text
) returns text language plpgsql as $$
begin
  insert into songs(id,user_id,title,artist,genre,"durationSec",bpm,"originalRoot","originalMode","addedAt","audioUrl","coverUrl")
    values (p_id,p_user_id,p_title,p_artist,p_genre,p_duration,p_bpm,p_root,p_mode,p_added,p_audio_url,p_cover_url);
  insert into song_settings(song_id,bpm,hand,transpose)
    values (p_id,p_bpm,'both',0);
  return p_id;
end$$;

create function start_practice(
  p_user_id text, p_song_id text, p_patch jsonb, p_id text, p_start text
) returns jsonb language plpgsql as $$
declare existing jsonb;
begin
  -- At most one open session per user: lock the user row so concurrent
  -- starts run one at a time, then reuse any session that is already open.
  perform 1 from users where id = p_user_id for update;
  select row_to_json(s)::jsonb into existing
    from practice_sessions s join songs g on g.id = s.song_id
   where g.user_id = p_user_id and s."endTime" is null
   limit 1;
  if existing is not null then return existing; end if;

  if not exists (select 1 from songs where id = p_song_id and user_id = p_user_id) then
    return null;
  end if;

  -- Save the settings the user is about to practice with.
  update song_settings set
      bpm       = coalesce((p_patch->>'bpm')::int, bpm),
      hand      = coalesce(p_patch->>'hand', hand),
      transpose = coalesce((p_patch->>'transpose')::int, transpose)
    where song_id = p_song_id;
  if not found then return null; end if;

  insert into practice_sessions(id,song_id,"startTime")
    values (p_id,p_song_id,p_start);

  return (select row_to_json(x)::jsonb from (select * from practice_sessions where id = p_id) x);
end$$;

/* Idempotent: ending an already-ended session returns it unchanged. */
create function end_practice(
  p_id text, p_user_id text, p_end text, p_accuracy int
) returns jsonb language plpgsql as $$
declare s practice_sessions;
begin
  select ps.* into s
    from practice_sessions ps join songs g on g.id = ps.song_id
   where ps.id = p_id and g.user_id = p_user_id
   for update of ps;
  if not found then return null; end if;
  if s."endTime" is null then
    update practice_sessions set "endTime" = p_end, accuracy = p_accuracy
     where id = p_id
     returning * into s;
  end if;
  return row_to_json(s)::jsonb;
end$$;

/* One page of the user's catalog, filtered and sorted in the database using
   their saved filters/sort plus a per-request search. Returns the page's song
   ids in order, the page (clamped to the last one), match and library counts,
   and the genres/tags on any of the user's songs. Pages hold 20 songs.
   Order: songs added today (UTC) first; then the saved sort, where "recent"
   puts never-practiced songs last; ties break by id. */
create function catalog_page(
  p_user_id text, p_search text, p_page int
) returns jsonb language plpgsql stable as $$
declare
  st library_settings;
  q text := lower(trim(coalesce(p_search, '')));
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  f_genres text[];
  f_tags text[];
  ids text[];
  n int;
  n_pages int;
  pg int;
begin
  select * into st from library_settings where user_id = p_user_id;
  select coalesce(array_agg(value), '{}') into f_genres
    from library_filters where user_id = p_user_id and kind = 'genre';
  select coalesce(array_agg(value), '{}') into f_tags
    from library_filters where user_id = p_user_id and kind = 'tag';

  select array_agg(s.id order by
      (left(s."addedAt", 10) = today) desc,
      case when st.sort = 'recent' then lp.last is null end,
      case when st.dir = 'asc' then
        case st.sort when 'alpha' then lower(s.title) when 'added' then s."addedAt" else lp.last end
      end asc,
      case when st.dir = 'desc' then
        case st.sort when 'alpha' then lower(s.title) when 'added' then s."addedAt" else lp.last end
      end desc,
      length(s.id), s.id)
    into ids
    from songs s
    join song_settings ss on ss.song_id = s.id
    left join lateral (
      select max(ps."startTime") as last from practice_sessions ps
       where ps.song_id = s.id and ps."endTime" is not null
    ) lp on true
   where s.user_id = p_user_id
     and (not st."favoriteOnly" or ss.favorite)
     and (cardinality(f_genres) = 0 or s.genre = any(f_genres))
     and (cardinality(f_tags) = 0 or exists (
           select 1 from song_tags t where t.song_id = s.id and t.tag = any(f_tags)))
     and (strpos(lower(s.title), q) > 0 or strpos(lower(s.artist), q) > 0
          or strpos(lower(s.genre), q) > 0
          or exists (select 1 from song_tags t
                      where t.song_id = s.id and strpos(lower(t.tag), q) > 0));

  n := coalesce(cardinality(ids), 0);
  n_pages := greatest(1, ceil(n / 20.0)::int);
  pg := least(n_pages, greatest(1, p_page));
  return jsonb_build_object(
    'ids', coalesce(to_jsonb(ids[(pg - 1) * 20 + 1 : pg * 20]), '[]'::jsonb),
    'total', n,
    'page', pg,
    'pages', n_pages,
    'libraryTotal', (select count(*) from songs where user_id = p_user_id),
    'genres', (select coalesce(jsonb_agg(distinct genre order by genre), '[]'::jsonb)
                 from songs where user_id = p_user_id),
    'tags', (select coalesce(jsonb_agg(distinct t.tag order by t.tag), '[]'::jsonb)
               from song_tags t join songs s on s.id = t.song_id
              where s.user_id = p_user_id)
  );
end$$;

/* Applies a song patch in one transaction: title on songs, playback settings
   on song_settings, and (when "tags" is present) replaces the song's tags.
   Absent keys are left unchanged. Returns false if the user doesn't own it. */
create function update_song(
  p_user_id text, p_song_id text, p_patch jsonb
) returns boolean language plpgsql as $$
begin
  update songs set title = coalesce(p_patch->>'title', title)
   where id = p_song_id and user_id = p_user_id;
  if not found then return false; end if;

  update song_settings set
      bpm       = coalesce((p_patch->>'bpm')::int, bpm),
      hand      = coalesce(p_patch->>'hand', hand),
      transpose = coalesce((p_patch->>'transpose')::int, transpose),
      favorite  = coalesce((p_patch->>'favorite')::boolean, favorite)
    where song_id = p_song_id;

  if p_patch ? 'tags' then
    delete from song_tags
     where song_id = p_song_id
       and tag not in (select jsonb_array_elements_text(p_patch->'tags'));
    insert into song_tags(song_id, tag)
      select p_song_id, jsonb_array_elements_text(p_patch->'tags')
      on conflict do nothing;
  end if;
  return true;
end$$;

/* Applies a library settings patch in one transaction; "genreFilter" and
   "tagsFilter", when present, replace that kind of filter rows. */
create function set_library_settings(
  p_user_id text, p_patch jsonb
) returns void language plpgsql as $$
begin
  update library_settings set
      view           = coalesce(p_patch->>'view', view),
      "favoriteOnly" = coalesce((p_patch->>'favoriteOnly')::boolean, "favoriteOnly"),
      sort           = coalesce(p_patch->>'sort', sort),
      dir            = coalesce(p_patch->>'dir', dir),
      instrument     = coalesce(p_patch->>'instrument', instrument),
      volume         = coalesce((p_patch->>'volume')::int, volume)
    where user_id = p_user_id;

  if p_patch ? 'genreFilter' then
    delete from library_filters where user_id = p_user_id and kind = 'genre';
    insert into library_filters(user_id, kind, value)
      select p_user_id, 'genre', jsonb_array_elements_text(p_patch->'genreFilter')
      on conflict do nothing;
  end if;
  if p_patch ? 'tagsFilter' then
    delete from library_filters where user_id = p_user_id and kind = 'tag';
    insert into library_filters(user_id, kind, value)
      select p_user_id, 'tag', jsonb_array_elements_text(p_patch->'tagsFilter')
      on conflict do nothing;
  end if;
end$$;
