import type { Metadata } from "next";
import type { SearchParams } from "../../_components/cms";
import { EnquiriesScreen } from "../../_components/enquiries";

export const metadata: Metadata = { title: "Enquiry inbox" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <EnquiriesScreen searchParams={await searchParams} />;
}
