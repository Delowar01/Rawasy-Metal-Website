import type { Metadata } from "next";
import { ContentOrder } from "../../../_components/cms";

export const metadata: Metadata = { title: "Order — Services" };

export default function ServicesOrderPage() {
  return <ContentOrder type="service" />;
}
