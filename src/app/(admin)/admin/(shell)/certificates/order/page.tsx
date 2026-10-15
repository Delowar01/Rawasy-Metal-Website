import type { Metadata } from "next";
import { ContentOrder } from "../../../_components/cms";

export const metadata: Metadata = { title: "Order — Certificates" };

export default function CertificatesOrderPage() {
  return <ContentOrder type="certificate" />;
}
