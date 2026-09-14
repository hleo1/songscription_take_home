// Creates the public Storage bucket that holds song audio (seeded and uploaded).
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local; the bucket name is
// SUPABASE_STORAGE_BUCKET, default "song-audio". Does nothing if it already exists.
// Run:  npm run db:bucket
import { createAdminClient } from "@supabase/server/core";

process.loadEnvFile(".env.local");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "song-audio";
const sb = createAdminClient();

const { data: existing } = await sb.storage.getBucket(BUCKET);
if (existing) {
  console.log(`Bucket "${BUCKET}" already exists (public: ${existing.public}).`);
} else {
  const { error } = await sb.storage.createBucket(BUCKET, { public: true });
  if (error) {
    console.error(`Creating bucket "${BUCKET}" failed:`, error);
    process.exit(1);
  }
  console.log(`Created public bucket "${BUCKET}".`);
}
