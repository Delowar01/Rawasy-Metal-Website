import type { Metadata } from "next";
import type { SearchParams } from "../../_components/cms";
import { InterfaceTextScreen } from "../../_components/site";

export const metadata: Metadata = { title: "Interface text" };

export default async function InterfaceTextPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <InterfaceTextScreen searchParams={await searchParams} />;
}
