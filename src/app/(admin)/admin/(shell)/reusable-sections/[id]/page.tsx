import type { Metadata } from "next";
import { ReusableEdit } from "../../../_components/builder";
import type { SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Reusable section" };

export default async function ReusableSectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ReusableEdit id={id} searchParams={await searchParams} />;
}
