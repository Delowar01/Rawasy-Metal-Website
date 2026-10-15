import type { Metadata } from "next";
import { ContentEdit, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ContentEdit type="client" id={id} searchParams={await searchParams} />;
}
