"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { LibrarySettings } from "@/lib/models";

/** Piano voices for rendering uploaded MIDI. Saved, but `midiToMp3` doesn't
    read this setting yet, so uploads still use its default synth. */
const INSTRUMENTS: {
  key: LibrarySettings["instrument"];
  label: string;
  hint: string;
}[] = [
  {
    key: "grand",
    label: "Grand piano",
    hint: "Full and rounded — the default",
  },
  { key: "bright", label: "Bright upright", hint: "Harder attack, more edge" },
  { key: "electric", label: "Electric piano", hint: "Warm and bell-like" },
  { key: "felt", label: "Felt piano", hint: "Soft and muted, quick decay" },
];

export default function Settings() {
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [error, setError] = useState("");
  const pending = useRef<Partial<LibrarySettings> | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) =>
        r.ok
          ? r.json()
          : Promise.reject(Error("Could not load your settings.")),
      )
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);

  const save = async (patch: Partial<LibrarySettings>) => {
    setError("");
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        // Lets a save started as the page unmounts finish.
        keepalive: true,
      });
      if (!r.ok)
        throw Error((await r.json()).error || "Could not save your settings.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your settings.",
      );
    }
  };

  // Sliders fire continuously, so coalesce into one write once you settle.
  const change = (patch: Partial<LibrarySettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    pending.current = { ...pending.current, ...patch };
  };
  useEffect(() => {
    if (!settings) return;
    const t = setTimeout(() => {
      const patch = pending.current;
      pending.current = null;
      if (patch) void save(patch);
    }, 300);
    return () => clearTimeout(t);
  }, [settings]);
  // Leaving the page (e.g. Back) before the debounce fires still saves.
  useEffect(
    () => () => {
      if (pending.current) void save(pending.current);
    },
    [],
  );

  if (!settings)
    return (
      <main className="grid min-h-screen place-content-center gap-3 text-center">
        <p role="status">{error || "Loading your settings…"}</p>
        <Link href="/" className="text-sm text-primary underline">
          Back to your library
        </Link>
      </main>
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-3">
          <Link
            href="/"
            aria-label="Back to your library"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-lg tracking-tight">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-6 py-6">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-700/40 bg-red-700/10 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Instrument sound</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The voice for rendering uploaded MIDI. Saved with your library; not
            yet applied to uploads.
          </p>
          <div className="mt-3 space-y-1.5">
            {INSTRUMENTS.map((i) => (
              <label
                key={i.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-secondary/40 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/10"
              >
                <input
                  type="radio"
                  name="instrument"
                  className="accent-primary"
                  checked={settings.instrument === i.key}
                  onChange={() => change({ instrument: i.key })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{i.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {i.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Playback volume</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Global volume for song playback. Saved with your library; not yet
            applied to audio.
          </p>
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label
                htmlFor="volume"
                className="text-xs font-medium text-muted-foreground"
              >
                Volume
              </label>
              <span className="text-sm font-semibold tabular-nums">
                {settings.volume}%
              </span>
            </div>
            <input
              id="volume"
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(e) => change({ volume: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
