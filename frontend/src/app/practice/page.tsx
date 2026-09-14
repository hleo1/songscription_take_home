"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PracticeSession as Session } from "@/lib/models";
/** Back to the library with this song's detail reopened. */
const libraryHref = (session: Session | null) =>
  session ? `/?song=${encodeURIComponent(session.song_id)}` : "/";
export default function Practice() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    try {
      setError("");
      const id = new URLSearchParams(window.location.search).get("id");
      const r = await fetch(
        `/api/practice${id ? `?id=${encodeURIComponent(id)}` : ""}`,
      );
      if (!r.ok) throw Error("Could not load session");
      setSession(await r.json());
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load session");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-end gap-4 bg-black p-10 text-white">
      {error && <p role="alert">{error}</p>}
      {!loaded && !error && <p>Loading practice…</p>}
      {session && !session.endTime && (
        <button
          disabled={busy}
          className="rounded-lg border border-white/40 px-6 py-3 disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/practice/end", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: session.id }),
              });
              if (!r.ok)
                throw Error(
                  "Could not end practice. Retry to save your session.",
                );
              router.push(libraryHref(session));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save failed");
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "End practice"}
        </button>
      )}
      {loaded && (!session || session.endTime) && (
        <>
          <p>{session ? "Practice saved." : "No active practice session."}</p>
          <a href={libraryHref(session)} className="underline">
            Back to library
          </a>
        </>
      )}
      {!loaded && error && <button onClick={() => void load()}>Retry</button>}
    </main>
  );
}
