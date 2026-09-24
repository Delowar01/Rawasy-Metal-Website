import Link from "next/link";
import { projects } from "@/content/projects";
import { href } from "@/i18n/routes";
import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("projects", (locale) => (
  <ul className="mt-10 grid max-w-4xl border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
    {projects.map((p) => (
      <li key={p.slug} className="border-b border-line">
        <Link href={href(locale, "project", { slug: p.slug })} className="flex items-baseline gap-4 py-3 text-sm text-ink-2 hover:text-ink">
          <span className="t-num w-9 shrink-0 text-xs text-ink-3">{p.galleryRef}</span>
          <span>{p.title[locale]}</span>
        </Link>
      </li>
    ))}
  </ul>
));

export const generateMetadata = route.generateMetadata;
export default route.Page;
