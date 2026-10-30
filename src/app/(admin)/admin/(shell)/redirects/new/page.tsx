import type { Metadata } from "next";
import { RedirectNewScreen } from "../../../_components/site";

export const metadata: Metadata = { title: "New redirect" };

export default async function NewRedirectPage() {
  return <RedirectNewScreen />;
}
