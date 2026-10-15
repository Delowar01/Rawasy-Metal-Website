import type { Metadata } from "next";
import { ContentOrder } from "../../../../_components/cms";

export const metadata: Metadata = { title: "Order — Project categories" };

export default function ProjectsCategoriesOrderPage() {
  return <ContentOrder type="project_category" />;
}
