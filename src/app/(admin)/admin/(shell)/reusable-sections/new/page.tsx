import type { Metadata } from "next";
import { ReusableNew } from "../../../_components/builder";

export const metadata: Metadata = { title: "New reusable section" };

export default async function NewReusableSectionPage() {
  return <ReusableNew />;
}
