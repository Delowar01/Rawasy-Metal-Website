import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { company, whatsappUrl } from "@/content/company";
import { footerNav, footerServices, headerNav, legalNav } from "@/content/navigation";
import { siteName } from "@/content/seo";
import { services } from "@/content/services";
import { isLocale, localeConfig, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { bootScript } from "@/lib/boot-script";
import { SITE_URL } from "@/lib/seo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { BootFallback } from "@/components/motion/BootFallback";
import { CustomCursor } from "@/components/motion/CustomCursor";
import { Loader } from "@/components/motion/Loader";
import { RevealObserver } from "@/components/motion/RevealObserver";
import { archivo, geistMono, plexArabic } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ed" },
    { media: "(prefers-color-scheme: dark)", color: "#17191a" },
  ],
  colorScheme: "light dark",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: siteName[locale], template: `%s | ${siteName[locale]}` },
    applicationName: siteName[locale],
    authors: [{ name: company.legalName[locale] }],
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { dir, htmlLang } = localeConfig[locale];
  const whatsappHref = whatsappUrl();
  const [firstPhone] = company.phones;

  return (
    <html
      lang={htmlLang}
      dir={dir}
      className={`${archivo.variable} ${plexArabic.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <BootFallback />
        <div id="top" />
        <a
          href="#main"
          className="sr-only-focusable fixed start-4 top-4 z-[210] bg-ink px-4 py-3 text-sm font-semibold text-background"
        >
          {dict.a11y.skipToContent}
        </a>

        <Loader words={dict.loader.words} skipLabel={dict.loader.skip} />

        <SiteHeader
          locale={locale}
          homeHref={href(locale, "home")}
          items={headerNav.map((item) => ({ key: item.route, href: href(locale, item.route), label: item.label[locale] }))}
          quote={{ href: href(locale, "contact"), label: dict.controls.getQuote }}
          contact={{
            phone: firstPhone.display,
            phoneHref: `tel:${firstPhone.e164}`,
            email: company.email,
            whatsappHref,
            whatsappLabel: dict.common.whatsapp,
          }}
          labels={{
            mainNav: dict.a11y.mainNav,
            mobileNav: dict.a11y.mobileNav,
            openMenu: dict.a11y.openMenu,
            closeMenu: dict.a11y.closeMenu,
            homeLink: dict.a11y.homeLink,
            toDark: dict.a11y.switchToDark,
            toLight: dict.a11y.switchToLight,
            language: dict.controls.language,
            theme: dict.controls.theme,
            light: dict.controls.light,
            dark: dict.controls.dark,
            menu: dict.controls.menu,
          }}
        />

        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>

        <SiteFooter
          locale={locale}
          homeHref={href(locale, "home")}
          statement={dict.footer.statement}
          companyStatement={company.statement[locale]}
          legalName={company.legalName[locale]}
          cta={{ href: href(locale, "contact"), label: dict.controls.requestQuote }}
          services={{
            title: dict.footer.services,
            links: footerServices.map((slug) => ({
              href: href(locale, "service", { slug }),
              label: services.find((s) => s.slug === slug)?.name[locale] ?? slug,
            })),
          }}
          groups={footerNav.map((group) => ({
            title: group.title[locale],
            links: group.items.map((item) => ({ href: href(locale, item.route), label: item.label[locale] })),
          }))}
          legal={{
            title: dict.footer.legal,
            links: legalNav.map((item) => ({ href: href(locale, item.route), label: item.label[locale] })),
          }}
          contact={{
            title: dict.footer.contact,
            address: company.address[locale].lines,
            phones: company.phones.map((p) => ({ display: p.display, href: `tel:${p.e164}` })),
            email: company.email,
            whatsapp: { href: whatsappHref, label: dict.common.whatsapp },
            facebook: company.social.facebook,
          }}
          labels={{
            preferences: dict.footer.preferences,
            language: dict.controls.language,
            theme: dict.controls.theme,
            light: dict.controls.light,
            dark: dict.controls.dark,
            rights: dict.footer.rights,
            backToTop: dict.common.backToTop,
            footerNav: dict.a11y.footerNav,
            homeLink: dict.a11y.homeLink,
            externalLink: dict.a11y.externalLink,
          }}
        />

        <WhatsAppButton href={whatsappHref} label={dict.a11y.whatsapp} text={dict.common.whatsapp} />
        <CustomCursor labels={dict.cursor} />
        <RevealObserver />
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
