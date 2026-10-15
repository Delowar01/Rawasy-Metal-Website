import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="certificate"
      searchParams={await searchParams}
      intro="Certificate document metadata only. Document upload and public/private file management arrives in A4."
    />
  );
}
