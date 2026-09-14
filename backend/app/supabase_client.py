import os
import threading
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")

BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET") or "song-audio"

_local = threading.local()


def admin() -> Client:
    """This thread's admin (secret-key) client. It bypasses RLS, which is what
    this server-only, single-user prototype wants. One client per thread: its
    HTTP/2 connection isn't safe to share, and concurrent requests over a
    shared one fail with read/protocol errors."""
    client = getattr(_local, "client", None)
    if client is None:
        client = _local.client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
    return client
