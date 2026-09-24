import Link from "next/link";
import { services } from "@/content/services";
import { href } from "@/i18n/routes";
import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("services", (locale) => (
  <ul className="mt-10 grid max-w-3xl border-t border-line sm:grid-cols-2 sm:gap-x-8">
    {services.map((s) => (
      <li key={s.slug} className="border-b border-line">
        <Link href={href(locale, "service", { slug: s.slug })} className="flex items-baseline gap-4 py-4 text-ink hover:text-accent-ink">
          <span className="t-num text-xs text-ink-3">{s.index}</span>
          <span className="font-medium">{s.name[locale]}</span>
        </Link>
      </li>
    ))}
  </ul>
));

export const generateMetadata = route.generateMetadata;
export default route.Page;
