/**
 * Site controls (A6.6) — the working copy laid over today's values for the admin preview (`src/server/site/working.ts`):
 * nothing set up leaves today's values exactly; a working copy copied from today's website (what the set-up actions
 * store) gives today's values exactly; an edited one changes only what it holds — the header and footer menus (hidden
 * items left out, order kept), the "every service" label, the interface strings, the contact details, the company
 * statement and legal name — and never the live services' list or anything outside the shell. The shell base here is
 * built the way `getShellView` builds it (that module needs Next.js's aliases); e2e-admin/site.spec.ts compares the real
 * one in the browser, word for word.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ShellView } from "../../src/components/commerce/data.ts";
import { company, whatsappUrl } from "../../src/content/company.ts";
import { home } from "../../src/content/home.ts";
import { footerNav, headerNav, legalNav } from "../../src/content/navigation.ts";
import { getDictionary } from "../../src/i18n/dictionaries.ts";
import { LOCALES, MENU_SLOTS, routePath, type Locale, type SiteRouteKey } from "../../src/server/site/registry.ts";
import { staticMenus, staticSettings, staticUiTexts } from "../../src/server/site/static-source.ts";
import { overlayShell, uiValue, workingCompany, workingDictionary, workingWhatsappHref, workingWhatsappPhone, type WorkingSite } from "../../src/server/site/working.ts";

/** Today's shell, the fields `overlayShell` reads, as `getShellView` fills them (route and path null: nothing marked). */
function todayShell(locale: Locale): ShellView {
  const dict = getDictionary(locale);
  const link = (item: { route: string; label: Record<Locale, string> }) => ({ key: item.route, label: item.label[locale], href: routePath(locale, item.route as SiteRouteKey) });
  return {
    locale,
    current: null,
    self: null,
    alternate: { locale: locale === "en" ? "ar" : "en", href: null, htmlLang: locale === "en" ? "ar-SA" : "en" },
    nav: headerNav.map(link),
    services: { all: home.services.all[locale], items: [{ slug: "laser-cutting", name: "Laser cutting", tagline: "", href: `/${locale}/services/laser-cutting` }] },
    links: { home: `/${locale}`, quote: `/${locale}/contact#quote`, services: `/${locale}/services` },
    ui: {
      skip: dict.a11y.skipToContent,
      getQuote: dict.controls.getQuote,
      requestQuote: dict.controls.requestQuote,
      theme: dict.controls.theme,
      light: dict.controls.light,
      dark: dict.controls.dark,
      language: dict.controls.language,
      mainNav: dict.a11y.mainNav,
      mobileNav: dict.a11y.mobileNav,
      footerNav: dict.a11y.footerNav,
      openMenu: dict.a11y.openMenu,
      homeLink: dict.a11y.homeLink,
      languageSwitch: dict.a11y.languageSwitch,
      call: dict.common.call,
      email: dict.common.email,
      whatsapp: dict.common.whatsapp,
      address: dict.common.address,
      phone: dict.common.phone,
      backToTop: dict.common.backToTop,
    },
    contact: {
      phones: company.phones.map((p) => ({ display: p.display, href: `tel:${p.e164}` })),
      email: company.email,
      emailHref: `mailto:${company.email}`,
      whatsappHref: whatsappUrl(),
      address: company.address[locale],
    },
    footer: {
      companyStatement: company.statement[locale],
      legalName: company.legalName[locale],
      servicesTitle: dict.footer.services,
      contactTitle: dict.footer.contact,
      legalTitle: dict.footer.legal,
      rights: dict.footer.rights,
      company: { title: footerNav[0].title[locale], links: footerNav[0].items.map(link) },
      legal: legalNav.map(link),
    },
  } as unknown as ShellView;
}

const emptySite = (): WorkingSite => {
  const values = staticSettings();
  return {
    settings: { setUp: false, lockVersion: 0, values: { ...values, phones: [], defaultOgImageMediaId: "" }, status: { en: null, ar: null }, primaryWhatsappPhoneId: null, updatedAt: null },
    menus: MENU_SLOTS.map((slot) => ({ key: slot.key, slot, lockVersion: 0, setUp: false, items: [] })),
    ui: new Map(),
    theme: { lockVersion: 0, overrides: [] },
  };
};

/** What the three set-up actions store: today's website, copied. */
const copiedSite = (): WorkingSite => {
  const values = staticSettings();
  const menus = staticMenus();
  return {
    settings: {
      setUp: true,
      lockVersion: 1,
      values: { ...values, phones: values.phones.map((p, i) => ({ id: `phone-${i}`, ...p })), defaultOgImageMediaId: "" },
      status: { en: "complete", ar: "complete" },
      primaryWhatsappPhoneId: "phone-0",
      updatedAt: null,
    },
    menus: MENU_SLOTS.map((slot) => ({ key: slot.key, slot, lockVersion: 1, setUp: true, items: menus[slot.key].map((item, i) => ({ id: `${slot.key}-${i}`, ...item, isVisible: true })) })),
    ui: new Map(Object.entries(staticUiTexts())),
    theme: { lockVersion: 0, overrides: [] },
  };
};

describe("nothing set up", () => {
  test("today's values stay, exactly", () => {
    const site = emptySite();
    assert.equal(workingCompany(company, site), company);
    assert.equal(workingWhatsappHref(site, whatsappUrl()), whatsappUrl());
    for (const locale of LOCALES) {
      assert.deepEqual(workingDictionary(getDictionary(locale), site, locale), getDictionary(locale));
      assert.deepEqual(overlayShell(todayShell(locale), site, locale), todayShell(locale));
    }
  });
});

describe("copied from today's website", () => {
  test("the company facts, the interface strings, the WhatsApp link and the shell are today's, exactly", () => {
    const site = copiedSite();
    assert.deepEqual(workingCompany(company, site), company);
    assert.equal(workingWhatsappHref(site, "unused"), whatsappUrl());
    for (const locale of LOCALES) {
      assert.deepEqual(workingDictionary(getDictionary(locale), site, locale), getDictionary(locale));
      assert.deepEqual(overlayShell(todayShell(locale), site, locale), todayShell(locale), locale);
    }
  });
});

describe("an edited working copy", () => {
  test("changes the menus, labels, strings, contact details, statement and legal name; never the services' list", () => {
    const site = copiedSite();
    const header = site.menus.find((m) => m.key === "header_main")!;
    header.items[1].label = { en: "Test About", ar: "تجربة" };
    header.items[5].isVisible = false;
    [header.items[3], header.items[4]] = [header.items[4], header.items[3]];
    site.menus.find((m) => m.key === "header_services")!.items[1].label = { en: "Test all services", ar: "كل الخدمات تجربة" };
    site.menus.find((m) => m.key === "footer_legal")!.items[0].isVisible = false;
    site.ui.set("common.backToTop", { en: "Test back to top", ar: "تجربة" });
    site.ui.set("navigation.footerCompanyTitle", { en: "Test company" });
    site.settings.values.email = "test.office@example.test";
    site.settings.values.phones[0].isVisible = false;
    site.settings.values.texts.en.statement = "Test statement";
    site.settings.values.texts.en.legalName = "Test legal name";
    const base = todayShell("en");
    const shell = overlayShell(base, site, "en");
    assert.deepEqual(
      shell.nav.map((n) => n.label),
      ["Home", "Test About", "Services", "Projects", "Capabilities", "Clients", "Contact"],
    );
    assert.equal(shell.services.all, "Test all services");
    assert.deepEqual(shell.services.items, base.services.items);
    assert.equal(shell.ui.backToTop, "Test back to top");
    assert.equal(shell.footer.company.title, "Test company");
    assert.deepEqual(
      shell.footer.legal.map((l) => l.key),
      ["terms"],
    );
    assert.equal(shell.contact.email, "test.office@example.test");
    assert.equal(shell.contact.emailHref, "mailto:test.office@example.test");
    assert.deepEqual(shell.contact.phones, [{ display: company.phones[1].display, href: `tel:${company.phones[1].e164}` }]);
    // The WhatsApp link: the stored primary number is hidden now, so the first shown number with WhatsApp.
    assert.equal(shell.contact.whatsappHref, `https://wa.me/${company.phones[1].e164.slice(1)}`);
    assert.equal(workingWhatsappPhone(site)?.display, company.phones[1].display);
    assert.equal(workingWhatsappPhone(emptySite()), null);
    assert.equal(shell.footer.companyStatement, "Test statement");
    assert.equal(shell.footer.legalName, "Test legal name");
    // Arabic keeps today's where the working copy holds no Arabic value.
    const arabic = overlayShell(todayShell("ar"), site, "ar");
    assert.equal(arabic.footer.company.title, todayShell("ar").footer.company.title);
    assert.equal(uiValue(site, "navigation.footerCompanyTitle", "ar", "today"), "today");
    // Everything outside the shell's working parts is today's.
    for (const key of ["locale", "current", "self", "alternate", "links"] as const) assert.deepEqual(shell[key], base[key]);
  });
});
