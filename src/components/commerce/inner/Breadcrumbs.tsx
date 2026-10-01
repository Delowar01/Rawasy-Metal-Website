import { Icon } from "../Icon";

export interface Crumb {
  href: string;
  label: string;
}

/**
 * Home → page trail of an inner page: a labelled navigation list whose last entry is the page itself
 * (`aria-current="page"`). The separators follow the reading direction. Plain links: a page in the other design is a
 * full page load, so nothing is prefetched across designs.
 */
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="ip-crumbs">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href}>
              {i > 0 && <Icon name="chevron" size={14} className="-rotate-90 rtl:rotate-90" />}
              {last ? <span aria-current="page">{item.label}</span> : <a href={item.href}>{item.label}</a>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
