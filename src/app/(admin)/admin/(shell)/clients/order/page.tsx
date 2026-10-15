import type { Metadata } from "next";
import { ContentOrder } from "../../../_components/cms";

export const metadata: Metadata = { title: "Order — Clients" };

export default function ClientsOrderPage() {
  return <ContentOrder type="client" />;
}
