import type { Metadata } from "next";
import { AuditScreen, type SearchParams } from "../../_components/publishing";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <AuditScreen searchParams={await searchParams} />;
}
