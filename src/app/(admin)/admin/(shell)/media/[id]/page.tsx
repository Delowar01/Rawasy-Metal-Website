import type { Metadata } from "next";
import { MediaItem, type SearchParams } from "../../../_components/media";

export const metadata: Metadata = { title: "Media item" };

export default async function MediaItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <MediaItem id={id} searchParams={await searchParams} />;
}
