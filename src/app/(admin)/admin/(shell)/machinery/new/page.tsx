import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Machinery" };

export default async function MachineryNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="machine" searchParams={await searchParams} />;
}
