import type { Metadata } from "next";
import Link from "next/link";
import { ContentList, type SearchParams } from "../../_components/cms";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <ContentList
      type="project"
      searchParams={await searchParams}
      intro="Source-strict project records: confirmed details only, categories, services and safety flags."
      actions={
        <Link className="adm-btn" href="/admin/projects/categories">Categories</Link>
      }
    />
  );
}
