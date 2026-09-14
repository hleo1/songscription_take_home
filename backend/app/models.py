"""Request validation and response shapes. Request models validate; response
models describe what the API returns and feed the OpenAPI document."""

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, model_validator


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Genre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Hand = Literal["left", "right", "both"]
Mode = Literal["Major", "Minor"]
Bpm = Annotated[int, Field(ge=20, le=240)]
Root = Annotated[int, Field(ge=0, le=11, description="C=0 … B=11")]
Transpose = Annotated[int, Field(ge=-12, le=12, description="Semitones from originalRoot")]
Tags = Annotated[list[Tag], Field(max_length=20), AfterValidator(_unique)]
GenreFilter = Annotated[list[Genre], Field(max_length=50), AfterValidator(_unique)]
TagsFilter = Annotated[list[Tag], Field(max_length=50), AfterValidator(_unique)]
View = Literal["list", "grid"]
Sort = Literal["recent", "added", "alpha"]
Dir = Literal["asc", "desc"]
Instrument = Literal["grand", "bright", "electric", "felt"]
Volume = Annotated[int, Field(ge=0, le=100)]


class Strict(BaseModel):
    """Unknown keys and loosely typed values (e.g. "120" for 120) are rejected."""

    model_config = ConfigDict(extra="forbid", strict=True)


class Patch(Strict):
    """Every field is optional: absent means unchanged, and null is rejected."""

    @model_validator(mode="after")
    def _no_nulls(self):
        nulls = sorted(k for k in self.model_fields_set if getattr(self, k) is None)
        if nulls:
            raise ValueError(f"null is not allowed for: {', '.join(nulls)}")
        return self

    def changes(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


# ---- Requests ----


class LibrarySettings(Strict):
    """Also the response for GET /api/settings. Playback settings (instrument,
    volume) are stored and editable, not yet applied to audio."""

    view: View
    genreFilter: GenreFilter
    tagsFilter: TagsFilter
    favoriteOnly: bool
    sort: Sort
    dir: Dir
    instrument: Instrument
    volume: Volume


class SettingsPatch(Patch):
    view: View | None = None
    genreFilter: GenreFilter | None = None
    tagsFilter: TagsFilter | None = None
    favoriteOnly: bool | None = None
    sort: Sort | None = None
    dir: Dir | None = None
    instrument: Instrument | None = None
    volume: Volume | None = None


class PracticeSettings(Patch):
    """The playback settings Start Practice saves before opening a session."""

    bpm: Bpm | None = None
    hand: Hand | None = None
    transpose: Transpose | None = None


class SongPatch(PracticeSettings):
    """Per-user settings plus the song-level title, which lives on the songs table."""

    tags: Tags | None = None
    favorite: bool | None = None
    title: Title | None = None


class SearchIn(Strict):
    term: Annotated[str, Field(max_length=200)]


class StartPracticeIn(Strict):
    songId: Annotated[str, Field(min_length=1)]
    settings: PracticeSettings | None = None


class EndPracticeIn(Strict):
    id: Annotated[UUID, Field(strict=False)]


HttpUrl = Annotated[str, Field(pattern=r"^https?://\S+$", description="HTTP or HTTPS URL")]


class InferredSong(BaseModel):
    """What upload analysis determines about a song: the metadata agent's
    title/artist/genre plus the measured bpm and key."""

    title: Title
    artist: Title
    genre: Genre
    bpm: Bpm
    originalRoot: Root
    originalMode: Mode


class NewSong(InferredSong):
    durationSec: Annotated[int, Field(ge=1, le=86400)]


# ---- Responses ----


class ErrorBody(BaseModel):
    error: str
    details: Any = None


class SongSettings(BaseModel):
    bpm: int = Field(description="Desired practice tempo")
    hand: Hand
    transpose: int = Field(description="Semitones from originalRoot")
    tags: list[str]
    favorite: bool


class Song(BaseModel):
    id: str
    title: str
    artist: str
    genre: str
    coverUrl: str | None
    durationSec: int
    bpm: int = Field(description="Original tempo")
    originalRoot: int = Field(description="C=0 … B=11")
    originalMode: Mode
    addedAt: str
    audioUrl: str | None
    lastPracticed: str = Field(
        description="Start of the latest finished session; empty if never practiced"
    )
    lastAccuracy: int | None = Field(description="That session's accuracy; null if never practiced")


class PracticeLog(BaseModel):
    id: str
    date: str = Field(description="Session start (ISO)")
    endTime: str
    minutes: float
    accuracy: int


class SongDetail(BaseModel):
    song: Song
    meta: SongSettings
    history: list[PracticeLog]


class CatalogPage(BaseModel):
    songs: list[Song] = Field(description="This page only (up to 20)")
    metadata: dict[str, SongSettings]
    settings: LibrarySettings
    previousSearches: list[str]
    allTags: list[str]
    allGenres: list[str]
    total: int = Field(description="Songs matching filters + search")
    libraryTotal: int
    page: int
    pages: int


class PracticeSession(BaseModel):
    id: str
    song_id: str
    startTime: str
    endTime: str | None = Field(description="Null while open")
    accuracy: int | None


class SongId(BaseModel):
    id: str


class Ok(BaseModel):
    ok: bool
