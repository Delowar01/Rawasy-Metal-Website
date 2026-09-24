import Link from "next/link";
import { ChevronIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export interface Crumb {
  href: string;
  label: string;
}

/** Home → page trail. The separator follows the reading direction. */
export function Breadcrumbs({ items, label, className }: { items: Crumb[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("t-label", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-2">
              {i > 0 && <ChevronIcon size={12} className="shrink-0 opacity-60 rtl:-scale-x-100" />}
              {last ? (
                <span aria-current="page" className="text-ink-2">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="link-line transition-colors hover:text-ink">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
