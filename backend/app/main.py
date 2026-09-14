"""The whole /api surface as one FastAPI app. Request models validate; response
models document. FastAPI turns both into the OpenAPI document at
/api/openapi.json, shown by Swagger UI at /api/docs."""

import logging
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import db
from .models import (
    CatalogPage,
    EndPracticeIn,
    ErrorBody,
    LibrarySettings,
    Ok,
    PracticeSession,
    SearchIn,
    SettingsPatch,
    SongDetail,
    SongId,
    SongPatch,
    StartPracticeIn,
)
from .upload import upload_song

log = logging.getLogger(__name__)

app = FastAPI(
    title="Songscription API",
    version="1.0.0",
    description="All routes act as the fixed `local-demo` user (no auth).",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)


@app.middleware("http")
async def same_origin_writes(request: Request, call_next):
    # Browsers send Origin on writes; compare its host with the host the request
    # was sent to. Not the full request URL: behind a proxy it can carry http or
    # an internal host.
    origin = request.headers.get("origin")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if request.method not in ("GET", "HEAD") and origin and urlsplit(origin).netloc != host:
        return JSONResponse({"error": "Cross-origin writes are not allowed."}, 403)
    response = await call_next(request)
    # API responses are never cached.
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": exc.detail}, exc.status_code)


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    """Validation failures get the same 400 body as every other invalid request."""
    details = [{k: v for k, v in e.items() if k not in ("ctx", "url")} for e in exc.errors()]
    return JSONResponse({"error": "Invalid request", "details": jsonable_encoder(details)}, 400)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    log.exception("unhandled error")
    return JSONResponse({"error": "Unable to save. Please try again."}, 500)


def errors(**descriptions: str) -> dict:
    """Error responses for the docs, e.g. errors(e404="Song not found")."""
    return {int(code[1:]): {"model": ErrorBody, "description": d} for code, d in descriptions.items()}


Page = Annotated[int, Query(ge=1)]
Search = Annotated[str, Query(max_length=200, description="Per-request search term; never saved")]

api = APIRouter(prefix="/api")

# ---- Songs ----


@api.get(
    "/songs",
    tags=["Songs"],
    summary="One filtered, sorted catalog page",
    description="Filters and sort come from the saved library settings; `search` applies to this request only. Pages hold 20 songs; an out-of-range page is clamped to the last one.",
    response_model=CatalogPage,
    responses=errors(e400="Invalid query"),
)
def list_songs(page: Page = 1, search: Search = ""):
    return db.get_catalog_page(page, search)


# Reads the multipart body itself, so the size check runs before the body is read.
@api.post(
    "/songs",
    tags=["Songs"],
    summary="Upload an MP3",
    description="Validates the MP3, measures BPM/key from the audio and infers title/artist/genre with an agent, stores the audio and creates the song. Album art is looked up in the background. Needs OPENAI_API_KEY.",
    response_model=SongId,
    responses=errors(
        e400="Not a readable MP3",
        e413="File too large",
        e502="Metadata analysis failed",
        e503="OPENAI_API_KEY missing",
    ),
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {"file": {"type": "string", "format": "binary"}},
                        "required": ["file"],
                    }
                }
            },
        }
    },
)
async def upload(request: Request, background: BackgroundTasks):
    return await upload_song(request, background)


@api.get(
    "/songs/{id}",
    tags=["Songs"],
    summary="One song with its editable settings and practice history",
    description="Loaded when the detail panel opens; `history` is oldest first.",
    response_model=SongDetail,
    responses=errors(e404="Song not found"),
)
def get_song(id: str):
    detail = db.get_song(id)
    if not detail:
        raise HTTPException(404, "Song not found")
    return detail


@api.patch(
    "/songs/{id}",
    tags=["Songs"],
    summary="Update a song",
    description="Applies title, playback settings and/or the full tag list in one transaction. Absent fields are unchanged. Returns the refreshed catalog page for `page`/`search`.",
    response_model=CatalogPage,
    responses=errors(e400="Invalid request", e404="Song not found"),
)
def update_song(id: str, patch: SongPatch, page: Page = 1, search: Search = ""):
    if not db.update_song(id, patch.changes()):
        raise HTTPException(404, "Song not found")
    return db.get_catalog_page(page, search)


@api.delete(
    "/songs/{id}",
    tags=["Songs"],
    summary="Delete a song",
    description="Removes the song with its settings, tags, practice sessions and stored audio.",
    response_model=SongId,
    responses=errors(e404="Song not found"),
)
def delete_song(id: str):
    if not db.delete_song(id):
        raise HTTPException(404, "Song not found")
    return {"id": id}


# ---- Settings and searches ----


@api.get("/settings", tags=["Settings"], summary="Library settings", response_model=LibrarySettings)
def get_settings():
    return db.get_settings()


@api.patch(
    "/settings",
    tags=["Settings"],
    summary="Update library settings",
    description="Applies the patch in one transaction; `genreFilter`/`tagsFilter` replace the saved filters. With `page`, returns that catalog page (used by the library); without it, returns the saved settings.",
    response_model=CatalogPage | LibrarySettings,
    responses=errors(e400="Invalid request"),
)
def update_settings(patch: SettingsPatch, page: Page | None = None, search: Search = ""):
    db.update_settings(patch.changes())
    return db.get_settings() if page is None else db.get_catalog_page(page, search)


@api.post(
    "/searches",
    tags=["Settings"],
    summary="Record a submitted search",
    description="Recent terms come back on every catalog page as `previousSearches`.",
    response_model=Ok,
    responses=errors(e400="Invalid request"),
)
def record_search(body: SearchIn):
    db.record_search(body.term)
    return {"ok": True}


# ---- Practice ----


@api.get(
    "/practice",
    tags=["Practice"],
    summary="A practice session",
    description="By id, or the user's open session when `id` is omitted. Null if none.",
    response_model=PracticeSession | None,
)
def get_practice(id: str | None = None):
    return db.get_practice_session(id)


@api.post(
    "/practice/start",
    tags=["Practice"],
    summary="Start practicing a song",
    description="Saves any given bpm/hand/transpose to the song's settings and opens a session. Returns the already-open session if there is one.",
    response_model=PracticeSession,
    responses=errors(e400="Invalid request", e404="Song not found"),
)
def start_practice(body: StartPracticeIn):
    session = db.start_practice(body.songId, body.settings.changes() if body.settings else {})
    if not session:
        raise HTTPException(404, "Song not found")
    return session


@api.post(
    "/practice/end",
    tags=["Practice"],
    summary="End a practice session",
    description="Records end time and accuracy, turning the session into a practice log. Ending an ended session returns it unchanged.",
    response_model=PracticeSession,
    responses=errors(e400="Invalid request", e404="Session not found"),
)
def end_practice(body: EndPracticeIn):
    session = db.end_practice(str(body.id))
    if not session:
        raise HTTPException(404, "Session not found")
    return session


app.include_router(api)


def openapi_without_422():
    """Invalid requests return 400 with the Error body, not FastAPI's default
    422, so drop the 422 entries FastAPI adds to the generated document."""
    schema = FastAPI.openapi(app)  # generated once, then cached on the app
    for path in schema["paths"].values():
        for operation in path.values():
            operation["responses"].pop("422", None)
    for name in ("HTTPValidationError", "ValidationError"):
        schema.get("components", {}).get("schemas", {}).pop(name, None)
    return schema


app.openapi = openapi_without_422
