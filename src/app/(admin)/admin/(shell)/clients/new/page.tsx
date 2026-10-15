import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Clients" };

export default async function ClientsNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="client" searchParams={await searchParams} />;
}
