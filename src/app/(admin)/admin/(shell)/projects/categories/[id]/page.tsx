import type { Metadata } from "next";
import { ContentEdit, type SearchParams } from "../../../../_components/cms";

export const metadata: Metadata = { title: "Project categories" };

export default async function ProjectsCategoriesItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <ContentEdit type="project_category" id={id} searchParams={await searchParams} />;
}
