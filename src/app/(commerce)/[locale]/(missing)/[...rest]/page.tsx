import { notFound } from "next/navigation";
import { ensureContent } from "@/content/load";

export const dynamicParams = true;

/**
 * Any unknown path under a locale renders the localized 404 of the Modern Commerce design (not-found.tsx beside it, in
 * the (missing) route group). An unknown service or project slug gets the same page from its own route's boundary.
 */
export default async function CatchAll() {
  await ensureContent();
  notFound();
}
