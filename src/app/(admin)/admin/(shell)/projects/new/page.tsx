import type { Metadata } from "next";
import { ContentNew, type SearchParams } from "../../../_components/cms";

export const metadata: Metadata = { title: "New — Projects" };

export default async function ProjectsNewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ContentNew type="project" searchParams={await searchParams} />;
}
