import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { Logo, logoPaths } from "@/components/brand/Logo";
import { ArrowIcon, ArrowUpIcon, FacebookIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/ui/Icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSelect } from "./ThemeControls";

interface FooterLink {
  href: string;
  label: string;
}

export interface FooterProps {
  locale: Locale;
  statement: string;
  companyStatement: string;
  legalName: string;
  cta: { href: string; label: string };
  groups: { title: string; links: FooterLink[] }[];
  services: { title: string; links: FooterLink[] };
  legal: { title: string; links: FooterLink[] };
  contact: {
    title: string;
    address: string[];
    phones: { display: string; href: string }[];
    email: string;
    whatsapp: { href: string; label: string };
    facebook: string;
  };
  labels: {
    preferences: string;
    language: string;
    theme: string;
    light: string;
    dark: string;
    rights: string;
    backToTop: string;
    footerNav: string;
    homeLink: string;
    externalLink: string;
  };
  homeHref: string;
}

export function SiteFooter({
  locale,
  statement,
  companyStatement,
  legalName,
  cta,
  groups,
  services,
  legal,
  contact,
  labels,
  homeHref,
}: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-line bg-background-deep">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />

      <div className="container-x relative">
        {/* Statement + CTA */}
        <div className="flex flex-col gap-6 border-b border-line py-14 md:flex-row md:items-end md:justify-between md:py-16">
          <p className="footer-statement max-w-[16ch] text-ink" data-reveal>
            {statement}
          </p>
          <Link href={cta.href} className="link-arrow shrink-0 text-ink">
            <span className="link-line">{cta.label}</span>
            <ArrowIcon className="arrow rtl:-scale-x-100" />
          </Link>
        </div>

        {/* Columns */}
        <nav aria-label={labels.footerNav} className="grid grid-cols-2 gap-x-6 gap-y-12 py-14 lg:grid-cols-12 lg:gap-8">
          <div className="col-span-2 lg:col-span-4">
            <Link href={homeHref} aria-label={labels.homeLink} className="inline-block text-ink">
              <Logo className="h-11 w-auto" title={labels.homeLink} />
            </Link>
            <p className="t-body mt-6 max-w-sm">{companyStatement}</p>
            <a
              href={contact.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex size-10 items-center justify-center border border-line text-ink-2 transition-colors hover:border-accent hover:text-ink"
              aria-label={`Facebook (${labels.externalLink})`}
            >
              <FacebookIcon />
            </a>
          </div>

          <div className="lg:col-span-2">
            <h2 className="t-label text-ink-3">{services.title}</h2>
            <ul className="mt-5 grid gap-2.5">
              {services.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-line text-[0.94rem] text-ink-2 transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {groups.map((group) => (
            <div key={group.title} className="lg:col-span-2">
              <h2 className="t-label text-ink-3">{group.title}</h2>
              <ul className="mt-5 grid gap-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="link-line text-[0.94rem] text-ink-2 transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 lg:col-span-4">
            <h2 className="t-label text-ink-3">{contact.title}</h2>
            <address className="mt-5 grid gap-4 text-[0.94rem] not-italic text-ink-2">
              <p className="flex gap-3">
                <PinIcon size={17} className="mt-1 shrink-0 text-accent-ink" />
                <span>
                  {contact.address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </p>
              <p className="flex gap-3">
                <PhoneIcon size={17} className="mt-1 shrink-0 text-accent-ink" />
                <span className="grid gap-1">
                  {contact.phones.map((phone) => (
                    <a key={phone.href} href={phone.href} className="link-line t-num w-fit transition-colors hover:text-ink" dir="ltr">
                      {phone.display}
                    </a>
                  ))}
                </span>
              </p>
              <p className="flex gap-3">
                <MailIcon size={17} className="mt-1 shrink-0 text-accent-ink" />
                <a href={`mailto:${contact.email}`} className="link-line w-fit transition-colors hover:text-ink">
                  {contact.email}
                </a>
              </p>
              <p className="flex gap-3">
                <WhatsAppIcon size={17} className="mt-1 shrink-0 text-accent-ink" />
                <a
                  href={contact.whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-line w-fit transition-colors hover:text-ink"
                >
                  {contact.whatsapp.label}
                </a>
              </p>
            </address>
          </div>
        </nav>

        {/* Preferences + legal */}
        <div className="flex flex-col gap-8 border-t border-line py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <span className="t-label text-ink-3">{labels.preferences}</span>
            <LanguageSwitcher locale={locale} label={labels.language} />
            <ThemeSelect labels={{ legend: labels.theme, light: labels.light, dark: labels.dark }} />
          </div>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2" aria-label={legal.title}>
            {legal.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-line transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {legalName} {labels.rights}
          </p>
          <a href="#top" className="link-arrow w-fit text-ink-2 hover:text-ink">
            {labels.backToTop}
            <ArrowUpIcon size={15} className="arrow" />
          </a>
        </div>
      </div>

      {/* Oversized outlined wordmark, cropped by the page edge */}
      <div aria-hidden className="pointer-events-none relative -mb-[3vw] select-none overflow-hidden" dir="ltr">
        <svg viewBox="362 321 383 70" className="mx-auto block w-[112%] max-w-none -translate-x-[6%] text-line-strong" preserveAspectRatio="xMidYMax meet">
          <path d={logoPaths.wordmarkEn} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </footer>
  );
}
