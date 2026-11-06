import type { Metadata } from "next";
import type { SearchParams } from "../../../_components/cms";
import { EnquiryScreen } from "../../../_components/enquiries";

// The reference is shown in the page, never in its title (a browser's history holds titles).
export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <EnquiryScreen id={id} searchParams={await searchParams} />;
}
