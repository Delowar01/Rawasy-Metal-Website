import type { Metadata } from "next";
import { BuilderScreen } from "../../../../_components/builder";
import type { SearchParams } from "../../../../_components/cms";

export const metadata: Metadata = { title: "Page layout" };

export default async function PageBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <BuilderScreen type="page" id={id} searchParams={await searchParams} />;
}
