import type { Metadata } from "next";
import { ContentOrder } from "../../../_components/cms";

export const metadata: Metadata = { title: "Order — Industries" };

export default function IndustriesOrderPage() {
  return <ContentOrder type="industry" />;
}
