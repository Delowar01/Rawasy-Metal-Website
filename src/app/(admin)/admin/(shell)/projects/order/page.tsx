import type { Metadata } from "next";
import { ContentOrder } from "../../../_components/cms";

export const metadata: Metadata = { title: "Order — Projects" };

export default function ProjectsOrderPage() {
  return <ContentOrder type="project" />;
}
