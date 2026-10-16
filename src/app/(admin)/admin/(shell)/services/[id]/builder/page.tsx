import type { Metadata } from "next";
import { BuilderScreen } from "../../../../_components/builder";
import type { SearchParams } from "../../../../_components/cms";

export const metadata: Metadata = { title: "Service page layout" };

export default async function ServiceBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <BuilderScreen type="service" id={id} searchParams={await searchParams} />;
}
