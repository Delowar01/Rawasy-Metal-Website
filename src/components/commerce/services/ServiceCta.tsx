import { Icon } from "../Icon";
import type { Tone } from "../types";

/**
 * The closing call to action of a service page (Stage TM-2.4), on the kit's dark panel: the service's own prompt, the
 * quote action (the contact page's request form), a direct call, and the ways onward (all services, the projects).
 */
export function ServiceCta({
  tone,
  label,
  title,
  body,
  quote,
  call,
  explore,
}: {
  tone: Tone;
  label: string;
  title: string;
  body: string;
  quote: { href: string; label: string };
  call: { href: string; label: string; number: string };
  explore: { label: string; links: { href: string; label: string }[] };
}) {
  return (
    <section aria-labelledby="page-cta-title" className="sec">
      <div className="shell">
        <div className="ip-cta sv-cta grid gap-x-12 gap-y-10 p-6 sm:p-10 lg:grid-cols-12 lg:items-end lg:p-12" data-tone={tone} data-reveal>
          <div className="lg:col-span-6">
            <p className="eyebrow eyebrow-dark">{label}</p>
            <h2 id="page-cta-title" className="t-h2 mt-5 max-w-[16em] text-white">
              {title}
            </h2>
            <p className="ip-cta-text t-lead mt-4 max-w-[34rem]">{body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-5">
              <a href={quote.href} className="btn btn-primary">
                {quote.label}
                <Icon name="arrow" size={17} />
              </a>
              <a href={call.href} className="sv-call">
                <span className="sv-call-icon">
                  <Icon name="phone" size={18} />
                </span>
                <span className="flex flex-col">
                  <span className="sv-call-label">{call.label}</span>
                  <span className="sv-call-number" dir="ltr">
                    {call.number}
                  </span>
                </span>
              </a>
            </div>
          </div>
          <div className="lg:col-span-6">
            <p className="sv-cta-label">{explore.label}</p>
            <ul className="mt-3 grid gap-2.5">
              {explore.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="ip-cta-link">
                    <span className="ip-cta-link-title min-w-0 flex-1">{link.label}</span>
                    <Icon name="arrow" size={20} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
