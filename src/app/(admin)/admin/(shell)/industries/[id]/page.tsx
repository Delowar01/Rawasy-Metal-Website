import type { Metadata } from "next";
import { ContentEdit, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Industries" };

export default async function IndustriesItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ContentEdit type="industry" id={id} searchParams={await searchParams} />;
}
