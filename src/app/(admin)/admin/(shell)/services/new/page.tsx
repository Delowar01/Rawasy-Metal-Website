import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Services" };

export default async function ServicesNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="service" searchParams={await searchParams} />;
}
