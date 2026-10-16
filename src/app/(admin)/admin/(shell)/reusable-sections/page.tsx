import type { Metadata } from "next";
import { ReusableList } from "../../_components/builder";

export const metadata: Metadata = { title: "Reusable sections" };

export default async function ReusableSectionsPage() {
  return <ReusableList />;
}
