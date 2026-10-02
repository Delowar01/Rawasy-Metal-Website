import type { ReactNode } from "react";
import { Logo as Brand } from "@/components/brand/Logo";
import type { ShellView } from "../data";
import { Icon } from "../Icon";

/**
 * The Modern Commerce footer: a dark sheet with the company statement and the quote button, the six services, the
 * company pages, the contact details (both phones, email, WhatsApp, the address) and the legal pages. Real routes
 * and the company's own details only; the page being viewed is marked (`aria-current`).
 */
export function Footer({ shell }: { shell: ShellView }) {
  const { footer, services, contact, ui, links, current } = shell;
  // The attribute only where it applies, so the other pages' data carries no empty prop.
  const here = (key: string) => (key === current ? { "aria-current": "page" as const } : {});
  const herePage = (href: string) => (href === shell.self ? { "aria-current": "page" as const } : {});
  return (
    <footer className="a2-footer">
      <div className="shell grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Brand className="h-11 w-auto text-white" title="RAWASY" />
          <p className="mt-5 max-w-[26em] text-[0.95rem] leading-relaxed">{footer.companyStatement}</p>
          <a href={links.quote} className="btn btn-primary mt-6">
            {ui.getQuote}
            <Icon name="arrow" size={17} />
          </a>
        </div>
        <FooterCol title={footer.servicesTitle} className="lg:col-span-3">
          {services.items.map((s) => (
            <li key={s.slug}>
              <a href={s.href} {...herePage(s.href)}>
                {s.name}
              </a>
            </li>
          ))}
        </FooterCol>
        <FooterCol title={footer.company.title} className="lg:col-span-2">
          {footer.company.links.map((l) => (
            <li key={l.href}>
              <a href={l.href} {...here(l.key)}>
                {l.label}
              </a>
            </li>
          ))}
        </FooterCol>
        <FooterCol title={footer.contactTitle} className="lg:col-span-3">
          {contact.phones.map((p) => (
            <li key={p.href}>
              <a href={p.href} dir="ltr">
                {p.display}
              </a>
            </li>
          ))}
          <li>
            <a href={contact.emailHref}>{contact.email}</a>
          </li>
          <li>
            <a href={contact.whatsappHref} className="inline-flex items-center gap-2">
              <Icon name="chat" size={16} />
              {ui.whatsapp}
            </a>
          </li>
          <li className="leading-relaxed">{contact.address.full}</li>
        </FooterCol>
      </div>
      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-3 py-6 text-[0.85rem] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {footer.legalName} {footer.rights}
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {footer.legal.map((l) => (
              <li key={l.href}>
                <a href={l.href} {...here(l.key)}>
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#top" className="inline-flex items-center gap-1.5 font-semibold text-white">
                {ui.backToTop}
                <Icon name="chevron" size={15} className="rotate-180" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h2 className="text-[0.8rem] font-semibold tracking-[0.04em] text-white uppercase">{title}</h2>
      <ul className="mt-4 grid gap-2.5 text-[0.95rem]">{children}</ul>
    </div>
  );
}
