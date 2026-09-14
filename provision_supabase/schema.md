# Database schema

Generated from `migrations/0001_init.sql`. Open the Markdown preview in VS Code
(`Cmd+Shift+V`) with the **Markdown Preview Mermaid Support** extension
(`bierner.markdown-mermaid`) to render the diagram. Update this file when the
migration changes.

```mermaid
erDiagram
  users ||--o| library_settings : "has"
  users ||--o{ library_filters : "filters by"
  users ||--o{ songs : "owns"
  users ||--o{ searches : "searched"
  songs ||--o| song_settings : "played with"
  songs ||--o{ song_tags : "tagged"
  songs ||--o{ practice_sessions : "practiced in"

  users {
    text id PK
    text name
  }
  library_settings {
    text user_id PK, FK
    text view "list | grid"
    boolean favoriteOnly
    text sort "recent | added | alpha"
    text dir "asc | desc"
    text instrument "grand | bright | electric | felt"
    integer volume "0-100"
  }
  library_filters {
    text user_id PK, FK
    text kind PK "genre | tag"
    text value PK
  }
  songs {
    text id PK
    text user_id FK
    text title
    text artist
    text genre
    integer durationSec "> 0"
    integer bpm "20-240"
    integer originalRoot "0-11"
    text originalMode "Major | Minor"
    text addedAt "ISO string"
    text audioUrl "nullable"
    text coverUrl "nullable"
  }
  song_settings {
    text song_id PK, FK
    integer bpm "20-240"
    text hand "left | right | both"
    integer transpose "-12 to 12, relative to originalRoot"
    boolean favorite
  }
  song_tags {
    text song_id PK, FK
    text tag PK
  }
  practice_sessions {
    text id PK
    text song_id FK
    text startTime "ISO string"
    text endTime "null while open"
    integer accuracy "0-100, set with endTime"
  }
  searches {
    text user_id PK, FK
    text term PK
    text searchedAt "ISO string"
  }
```

All foreign keys use `on delete cascade`, so deleting a song removes its
settings, tags and practice sessions.

## RPC functions

| Function | What it does |
| --- | --- |
| `create_song` | Inserts a `songs` row and its default `song_settings` row together. |
| `catalog_page` | Filters, sorts and pages the user's catalog in the database; returns the page's song ids, counts, and the user's genres and tags. |
| `update_song` | Applies a song patch (title, playback settings, tags) in one transaction. |
| `set_library_settings` | Applies a library settings patch, replacing filter rows, in one transaction. |
| `start_practice` | Locks the user, reuses any open session, else applies the settings patch and opens a new session. |
| `end_practice` | Sets `endTime` and `accuracy` on an open session; idempotent. |
