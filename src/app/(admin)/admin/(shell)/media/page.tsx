import type { Metadata } from "next";
import { MediaLibrary, type SearchParams } from "../../_components/media";

export const metadata: Metadata = { title: "Media library" };

export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <MediaLibrary searchParams={await searchParams} />;
}
