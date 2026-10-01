import { notFound } from "next/navigation";

export const dynamicParams = true;

/**
 * Any unknown path under a locale renders the localized 404 of the Modern Commerce design (not-found.tsx beside it, in
 * the (missing) route group). Paths that a page of the previous design matches more precisely (an unknown service or
 * project slug) keep that design's 404 until their own route moves to this design.
 */
export default function CatchAll() {
  notFound();
}
