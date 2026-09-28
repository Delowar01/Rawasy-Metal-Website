import { Logo as Brand } from "@/components/brand/Logo";
import { localeConfig, locales } from "@/i18n/config";
import { PAGE_COLORS, type ShellView } from "../data";
import { Icon } from "../Icon";
import { ThemeSwitch } from "../ThemeSwitch";
import { serviceTone } from "../tones";
import { serviceIcon } from "../ui";
import { LocaleLink } from "./LocaleLink";

type Props = { shell: ShellView };

/** EN | عربي: the current page in each language; the current language is marked. */
function LanguageSwitch({ shell, className = "" }: Props & { className?: string }) {
  const { locale, self, alternate, ui } = shell;
  return (
    <nav aria-label={ui.language} className={`a2-lang ${className}`}>
      {locales.map((code) => {
        const { htmlLang } = localeConfig[code];
        const label = code === "en" ? "EN" : "عربي";
        const name = code === "en" ? "English" : "العربية";
        return code === locale ? (
          <a key={code} href={self} lang={htmlLang} hrefLang={htmlLang} aria-label={name} aria-current="true">
            {label}
          </a>
        ) : (
          <LocaleLink key={code} locale={code} href={alternate.href} lang={htmlLang} hrefLang={htmlLang} aria-label={name}>
            {label}
          </LocaleLink>
        );
      })}
    </nav>
  );
}

/**
 * The Modern Commerce header: the brand, the website's main pages (Services opens a dropdown of the six services),
 * language, theme and the quote button; below 1280px the pages move into a full-height menu sheet. Every link is a
 * real localized route; the current page is marked (`aria-current`).
 */
export function Header({ shell }: Props) {
  const { ui, nav, services, links, contact, current, alternate } = shell;
  const [home, about, servicesNav, ...rest] = nav;
  const flat = [home, about];
  const here = (key: string) => (key === current ? ("page" as const) : undefined);

  return (
    <header className="a2-header">
      <div className="shell relative flex h-[var(--hh)] items-center gap-3 xl:gap-6">
        <a href={links.home} aria-label={ui.homeLink} aria-current={here("home")} className="shrink-0">
          <Brand className="h-8 w-auto text-ink min-[400px]:h-9 sm:h-10" title="RAWASY" />
        </a>

        <nav aria-label={ui.mainNav} className="a2-nav hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {flat.map((item) => (
              <li key={item.key}>
                <a href={item.href} className="nav-link" aria-current={here(item.key)}>
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <details data-dropdown className="a2-dd">
                <summary className="nav-link" aria-current={here(servicesNav.key)}>
                  {servicesNav.label}
                  <Icon name="chevron" size={16} className="chev" />
                </summary>
                <div className="a2-dd-panel">
                  <ul className="grid grid-cols-2 gap-1">
                    {services.items.map((s) => (
                      <li key={s.slug}>
                        <a href={s.href} className="a2-dd-item" data-tone={serviceTone[s.slug]}>
                          <span className="icon-chip size-10 shrink-0">
                            <Icon name={serviceIcon[s.slug]} size={20} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold leading-snug">{s.name}</span>
                            <span className="mt-0.5 line-clamp-2 block text-[0.82rem] leading-snug text-ink-2">{s.tagline}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-bg px-4 py-3">
                    <a href={links.services} className="link-arrow text-[0.92rem]">
                      {services.all}
                      <Icon name="arrow" size={16} />
                    </a>
                    <a href={links.quote} className="btn btn-primary btn-sm">
                      {ui.requestQuote}
                      <Icon name="arrow" size={15} />
                    </a>
                  </div>
                </div>
              </details>
            </li>
            {rest.map((item) => (
              <li key={item.key}>
                <a href={item.href} className="nav-link" aria-current={here(item.key)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitch shell={shell} className="max-md:hidden" />
          <LocaleLink
            locale={alternate.locale}
            href={alternate.href}
            lang={alternate.htmlLang}
            hrefLang={alternate.htmlLang}
            className="ctl max-[399px]:hidden md:hidden"
            aria-label={ui.languageSwitch}
          >
            {alternate.locale === "ar" ? "ع" : "EN"}
          </LocaleLink>
          <ThemeSwitch label={ui.theme} light={ui.light} dark={ui.dark} pageColors={PAGE_COLORS} className="max-lg:hidden" />
          <a href={links.quote} className="a2-head-quote btn btn-primary max-sm:min-h-10 max-sm:px-3 max-sm:text-[0.875rem]">
            {ui.getQuote}
            <Icon name="arrow" size={17} className="max-sm:hidden" />
          </a>

          <details data-menu data-sheet className="xl:hidden">
            <summary className="ctl a2-burger" aria-label={ui.openMenu}>
              <span />
              <span />
              <span />
            </summary>
            <div className="a2-sheet">
              <nav aria-label={ui.mobileNav} className="shell flex-1 pb-6 pt-2">
                <ul>
                  {flat.map((item) => (
                    <li key={item.key}>
                      <a href={item.href} className="a2-sheet-row" aria-current={here(item.key)}>
                        {item.label}
                        <Icon name="arrow" size={18} />
                      </a>
                    </li>
                  ))}
                  <li>
                    <details className="a2-sheet-sub">
                      <summary className="a2-sheet-row" aria-current={here(servicesNav.key)}>
                        {servicesNav.label}
                        <Icon name="chevron" size={20} className="chev" />
                      </summary>
                      <ul className="grid grid-cols-1 gap-2 py-3 min-[480px]:grid-cols-2">
                        {services.items.map((s) => (
                          <li key={s.slug}>
                            <a href={s.href} className="a2-dd-item border border-line-subtle" data-tone={serviceTone[s.slug]}>
                              <span className="icon-chip size-9 shrink-0">
                                <Icon name={serviceIcon[s.slug]} size={18} />
                              </span>
                              <span className="self-center font-semibold leading-snug">{s.name}</span>
                            </a>
                          </li>
                        ))}
                        <li className="min-[480px]:col-span-2">
                          <a href={links.services} className="link-arrow px-1 py-2 text-[0.95rem]">
                            {services.all}
                            <Icon name="arrow" size={16} />
                          </a>
                        </li>
                      </ul>
                    </details>
                  </li>
                  {rest.map((item) => (
                    <li key={item.key}>
                      <a href={item.href} className="a2-sheet-row" aria-current={here(item.key)}>
                        {item.label}
                        <Icon name="arrow" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[0.8rem] font-semibold text-ink-2">{ui.language}</p>
                    <LanguageSwitch shell={shell} className="mt-2 w-full [&>a]:h-11 [&>a]:flex-1 [&>a]:text-[0.95rem]" />
                  </div>
                  <div data-js-only>
                    <p className="text-[0.8rem] font-semibold text-ink-2">{ui.theme}</p>
                    <ThemeSwitch label={ui.theme} light={ui.light} dark={ui.dark} pageColors={PAGE_COLORS} className="mt-2 w-full [&>button]:h-11 [&>button]:flex-1" />
                  </div>
                  <div>
                    <p className="text-[0.8rem] font-semibold text-ink-2">{ui.phone}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <a href={contact.phones[0].href} className="btn btn-secondary">
                        <Icon name="phone" size={17} />
                        {ui.call}
                      </a>
                      <a href={contact.whatsappHref} className="btn btn-secondary">
                        <Icon name="chat" size={17} />
                        {ui.whatsapp}
                      </a>
                    </div>
                  </div>
                </div>
              </nav>
              <div className="a2-sheet-foot">
                <div className="shell py-3">
                  <a href={links.quote} className="btn btn-primary btn-lg w-full">
                    {ui.getQuote}
                    <Icon name="arrow" size={18} />
                  </a>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
