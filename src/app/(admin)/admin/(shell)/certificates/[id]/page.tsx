import type { Metadata } from "next";
import { ContentEdit, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ContentEdit type="certificate" id={id} searchParams={await searchParams} />;
}
