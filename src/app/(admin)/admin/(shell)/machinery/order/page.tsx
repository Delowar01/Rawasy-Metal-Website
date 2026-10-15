import type { Metadata } from "next";
import { ContentOrder } from "../../../_components/cms";

export const metadata: Metadata = { title: "Order — Machinery" };

export default function MachineryOrderPage() {
  return <ContentOrder type="machine" />;
}
