// One-off seed: loads the demo catalogue (the MIDI files in provision_supabase/seed/midi/)
// into Supabase via the admin client. Each MIDI is rendered to MP3 and uploaded
// to the Storage bucket, like a browser upload.
// Run after `npm run db:migrate` and `npm run db:bucket`:  npm run db:seed
// Idempotent-ish: clears the local-demo user's rows, then re-inserts.
import { readFileSync } from "node:fs";
import { createAdminClient } from "@supabase/server/core";
import { renderMidiToMp3 } from "../seed/render-midi.mts";
import { songs as seeds } from "../seed/seed-data.mts";

process.loadEnvFile(".env.local");
const USER_ID = "local-demo";
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "song-audio";
const sb = createAdminClient();

function die(label: string, error: unknown) {
  if (error) {
    console.error(`${label}:`, error);
    process.exit(1);
  }
}

if (!seeds.length) die("seed", "No MIDI files found in provision_supabase/seed/midi/");

// Fresh start for this user. Deleting the songs cascades to song_settings,
// song_tags and the practice tables; the rest are independent of songs.
die("clear songs", (await sb.from("songs").delete().eq("user_id", USER_ID)).error);
for (const t of ["library_filters", "searches"])
  die(`clear ${t}`, (await sb.from(t).delete().eq("user_id", USER_ID)).error);
die("clear settings", (await sb.from("library_settings").delete().eq("user_id", USER_ID)).error);

die("user", (await sb.from("users").upsert({ id: USER_ID, name: "Your library" }).select()).error);
die("settings", (await sb.from("library_settings").insert({ user_id: USER_ID }).select()).error);

for (const [i, s] of seeds.entries()) {
  // Render the MIDI and store it under the same path an upload would use.
  const { mp3, durationSec } = renderMidiToMp3(readFileSync(s.file));
  const path = `${s.id}.mp3`;
  die(`audio ${s.file}`, (await sb.storage.from(BUCKET).upload(path, mp3, {
    contentType: "audio/mpeg", upsert: true,
  })).error);
  const audioUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const addedAt = new Date(Date.now() - (28 + i) * 86400000).toISOString();
  die(`song ${s.id}`, (await sb.from("songs").insert({
    id: s.id, user_id: USER_ID, title: s.title, artist: s.artist, genre: s.genre,
    coverUrl: null,
    durationSec: Math.max(1, Math.round(durationSec)), bpm: s.bpm, originalRoot: s.originalRoot,
    originalMode: s.originalMode, addedAt, audioUrl,
  }).select()).error);
  die(`song_settings ${s.id}`, (await sb.from("song_settings").insert({
    song_id: s.id, bpm: s.bpm, hand: "both", transpose: 0, favorite: s.favorite,
  }).select()).error);
  if (s.tags.length)
    die(`song_tags ${s.id}`, (await sb.from("song_tags").insert(
      s.tags.map((tag) => ({ song_id: s.id, tag })),
    )).error);
  console.log(`  ${s.id}. ${s.title} (${Math.round(durationSec)}s audio)`);
}

// Four practice evenings per week, one session per song per evening
// (at most two), 12–25 minutes each.
const logs: Record<string, unknown>[] = [];
for (let days = 20; days >= 1; days--) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(22, 0, 0, 0);
  if ([0, 2, 4].includes(start.getUTCDay())) continue;
  for (let slot = 0; slot < Math.min(2, seeds.length); slot++) {
    const s = seeds[(days * 2 + slot) % seeds.length];
    const minutes = 12 + ((days + slot * 5) % 14);
    const date = new Date(start.getTime() + slot * 30 * 60000).toISOString();
    const end = new Date(Date.parse(date) + minutes * 60000).toISOString();
    // A finished session (endTime + accuracy) is what the app shows as a log.
    logs.push({
      id: `seed-${days}-${slot}`, song_id: s.id, startTime: date, endTime: end,
      accuracy: 85 + ((21 - days + slot) % 16),
    });
  }
}
die("practice_sessions", (await sb.from("practice_sessions").insert(logs).select()).error);

console.log(`Seeded ${seeds.length} songs and ${logs.length} practice logs for ${USER_ID}.`);
