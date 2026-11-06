import type { Metadata } from "next";
import type { SearchParams } from "../../../_components/cms";
import { FormEditScreen } from "../../../_components/enquiries";

export const metadata: Metadata = { title: "Form" };

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  return <FormEditScreen id={id} searchParams={await searchParams} />;
}
