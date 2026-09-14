"use client";
import { SongDetail } from "@/components/detail/SongDetail";
import { LibraryPage } from "@/components/library/LibraryPage";
import type { CatalogPage } from "@/lib/models";
import { StoreProvider } from "@/lib/store";
export function Library({ initialData }: { initialData?: CatalogPage }) {
  return (
    <StoreProvider initialData={initialData}>
      <LibraryPage />
      <SongDetail />
    </StoreProvider>
  );
}
