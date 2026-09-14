import { connection } from "next/server";
import type { CatalogPage } from "@/lib/models";
import { Library } from "./library";

const API_URL = process.env.API_URL || "http://localhost:8000";

export default async function Page() {
  // Render per request, so the first page of songs arrives with the HTML
  // instead of being fetched by the client after hydration.
  await connection();
  let initialData: CatalogPage | undefined;
  try {
    const r = await fetch(`${API_URL}/api/songs?page=1`, { cache: "no-store" });
    if (!r.ok) throw new Error(`GET /api/songs failed: ${r.status}`);
    initialData = await r.json();
  } catch (error) {
    // The client store loads it instead and shows its own error and retry.
    console.error(error);
  }
  return <Library initialData={initialData} />;
}
