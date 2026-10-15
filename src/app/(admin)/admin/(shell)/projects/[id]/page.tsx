import type { Metadata } from "next";
import { ContentEdit, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ContentEdit type="project" id={id} searchParams={await searchParams} />;
}
