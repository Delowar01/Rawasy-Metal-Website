import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Certificates" };

export default async function CertificatesNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="certificate" searchParams={await searchParams} />;
}
