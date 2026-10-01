import { Icon } from "../Icon";

export interface CtaLink {
  href: string;
  label: string;
  description?: string;
}

/**
 * The closing call to action of an inner page: a short prompt and a few ways forward on a dark panel, numbered unless
 * `numbered={false}` (the clients page shows no numbering). The pages migrated so far (the legal pages) have none; the
 * first pages to use it arrive in later TM-2 batches.
 */
export function ClosingCta({
  label,
  title,
  body,
  links,
  numbered = true,
}: {
  label: string;
  title: string;
  body?: string;
  links: CtaLink[];
  numbered?: boolean;
}) {
  return (
    <section aria-labelledby="page-cta-title" className="sec">
      <div className="shell">
        <div className="ip-cta grid gap-x-12 gap-y-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-end lg:p-12" data-reveal>
          <div className="lg:col-span-6">
            <p className="eyebrow eyebrow-dark">{label}</p>
            <h2 id="page-cta-title" className="t-h2 mt-5 max-w-[16em] text-white">
              {title}
            </h2>
            {body && <p className="ip-cta-text t-lead mt-4 max-w-[34rem]">{body}</p>}
          </div>
          <ul className="grid gap-2.5 lg:col-span-6">
            {links.map((link, i) => (
              <li key={link.href}>
                <a href={link.href} className="ip-cta-link">
                  {numbered && (
                    <span className="ip-cta-n" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="ip-cta-link-title">{link.label}</span>
                    {link.description && <span className="ip-cta-text mt-0.5 block text-[0.875rem]">{link.description}</span>}
                  </span>
                  <Icon name="arrow" size={20} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
