import type { Metadata } from "next";
import { ContentEdit, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Machinery" };

export default async function MachineryItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ContentEdit type="machine" id={id} searchParams={await searchParams} />;
}
