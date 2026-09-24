import { notFound } from "next/navigation";

export const dynamicParams = true;

/** Any unknown path under a locale renders the localized 404 inside the site shell. */
export default function CatchAll() {
  notFound();
}
