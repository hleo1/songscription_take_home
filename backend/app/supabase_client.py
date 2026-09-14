import os
from functools import cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")

BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET") or "song-audio"


@cache
def admin() -> Client:
    """Single shared admin (secret-key) client. It bypasses RLS, which is what
    this server-only, single-user prototype wants."""
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
