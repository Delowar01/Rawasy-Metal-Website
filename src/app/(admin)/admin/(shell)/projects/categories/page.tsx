import type { Metadata } from "next";
import { ContentList, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "Project categories" };

export default async function ProjectsCategoriesListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="project_category"
      searchParams={await searchParams}
      intro="Website classifications used to group and filter projects."
    />
  );
}
