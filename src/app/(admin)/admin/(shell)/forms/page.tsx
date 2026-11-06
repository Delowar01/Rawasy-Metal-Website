import type { Metadata } from "next";
import { FormsScreen } from "../../_components/enquiries";

export const metadata: Metadata = { title: "Forms" };

export default async function FormsPage() {
  return <FormsScreen />;
}
