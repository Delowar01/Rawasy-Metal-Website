import type { Metadata } from "next";
import type { SearchParams } from "../../../_components/cms";
import { RedirectEditScreen } from "../../../_components/site";

export const metadata: Metadata = { title: "Redirect" };

export default async function RedirectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <RedirectEditScreen id={id} searchParams={await searchParams} />;
}
