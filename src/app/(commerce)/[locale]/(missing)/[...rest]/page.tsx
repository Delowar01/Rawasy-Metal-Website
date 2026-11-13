import { notFound } from "next/navigation";
import { ensureContent, redirectFor } from "@/content/load";

export const dynamicParams = true;

/**
 * Any unknown path under a locale renders the localized 404 of the Modern Commerce design (not-found.tsx beside it, in
 * the (missing) route group). An unknown service or project slug gets the same page from its own route's boundary.
 */
export default async function CatchAll({ params }: PageProps<"/[locale]/[...rest]">) {
  // Database content (A9.5): an address no page answers follows its published redirect, if any (pages always win: this
  // runs only where no route matched). A release built from the content files resolves none. (Never the bare word for
  // that kind of release here: Tailwind turns it into a utility of the public stylesheet.)
  const { locale, rest } = await params;
  await ensureContent();
  await redirectFor(`/${locale}/${rest.join("/")}`);
  notFound();
}
