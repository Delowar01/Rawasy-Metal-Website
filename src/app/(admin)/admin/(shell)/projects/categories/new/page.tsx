import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../../_components/cms";

export const metadata: Metadata = { title: "New — Project categories" };

export default async function ProjectsCategoriesNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="project_category" searchParams={await searchParams} />;
}
