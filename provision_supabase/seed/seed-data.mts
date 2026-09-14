// Demo catalogue for `npm run db:seed`: one song per MIDI file in
// provision_supabase/seed/midi/. Tempo comes from the file itself; the descriptive
// fields come from KNOWN, falling back to the MIDI's name (or filename).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Midi } from "./render-midi.mts";

const MIDI_DIR = "provision_supabase/seed/midi";

type Details = {
  title: string;
  artist: string;
  genre: string;
  originalRoot: number;
  originalMode: "Major" | "Minor";
  tags: string[];
  favorite: boolean;
};
export type SeedSong = Details & { id: string; file: string; bpm: number };

// Metadata a MIDI file doesn't carry. Keys are filenames in MIDI_DIR.
const KNOWN: Record<string, Partial<Details>> = {
  "beethoven-fur-elise.mid": {
    title: "Für Elise",
    artist: "Ludwig van Beethoven",
    genre: "Classical",
    originalRoot: 9, // A minor
    originalMode: "Minor",
    tags: ["Recital"],
    favorite: true,
  },
  "c-major-scale.mid": {
    title: "C Major Scale",
    genre: "Exercise",
    originalRoot: 0,
    originalMode: "Major",
    tags: ["Warm-up"],
  },
};

export const songs: SeedSong[] = readdirSync(MIDI_DIR)
  .filter((f) => /\.midi?$/i.test(f))
  .sort()
  .map((file, i) => {
    const midi = new Midi(readFileSync(join(MIDI_DIR, file)));
    const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120);
    return {
      id: String(i + 1),
      file: join(MIDI_DIR, file),
      title: midi.header.name || file.replace(/\.midi?$/i, ""),
      artist: "Unknown artist",
      genre: "Piano",
      originalRoot: 0,
      originalMode: "Major",
      tags: [],
      favorite: false,
      ...KNOWN[file],
      bpm: Math.max(20, Math.min(240, bpm)), // songs.bpm check constraint
    };
  });
