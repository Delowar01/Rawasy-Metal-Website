import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { capabilitiesPage } from "../src/content/capabilities";
import { machines } from "../src/content/machines";
import { mediaRegistry } from "../src/content/media.generated";
import { routeLabels } from "../src/content/navigation";
import { seo } from "../src/content/seo";
import { services } from "../src/content/services";
import { getDictionary } from "../src/i18n/dictionaries";
import { pageStatus } from "../src/lib/page-meta";
import { coldLanding, FONT_DELAYS, placed, placement, VIEWPORTS } from "./anchor-helpers";
import { HTML_LANG, horizontalOverflow, jsonLd, LOCALES, trackErrors, type TestLocale } from "./helpers";

/**
 * Stage 1E: Capabilities & Machinery in the Modern Commerce design. The six machines of the company profile (p.7) with
 * their records' fields only: names, types, capabilities, the services they support and the rated power of the four
 * lasers (none for the press brake or laser welding), the one specification the profile gives. Each machine's panel is
 * the target of /capabilities#<slug> (every machine link on the homepage and the service pages is followed and lands on
 * it); the selector writes the address; the header's language links keep the machine; without script the console is a
 * list of all six. Also: the publication state (review), search metadata and structured data, the photos (never above
 * their source size, loaded once, never mirrored), a guard against specifications the profile does not give, reduced
 * motion, forced colours and the frozen homepage machinery.
 */

const SITE = { en: "RAWASY", ar: "رواسي" } as const;
const BREADCRUMB = { en: "Breadcrumb", ar: "مسار التنقل" } as const;
/** The page's order: the homepage machinery showcase's (machines.ts keeps the profile's). */
const ORDER = ["fiber-laser-combo-12kw", "tube-cutting-12kw", "fiber-laser-6kw", "fiber-laser-3kw", "cnc-press-brake", "laser-welding"] as const;
const RATED: Record<string, string> = { "tube-cutting-12kw": "12,000", "fiber-laser-combo-12kw": "12,000", "fiber-laser-6kw": "6,000", "fiber-laser-3kw": "3,000" };
const UNRATED = ["cnc-press-brake", "laser-welding"];
const UNIT = capabilitiesPage.power.unit;
const NOT_STATED = capabilitiesPage.fields.notStated;
const machine = (slug: string) => machines.find((m) => m.slug === slug)!;
const serviceName = (slug: string, locale: TestLocale) => services.find((s) => s.slug === slug)!.name[locale];
const other = (locale: TestLocale) => (locale === "en" ? "ar" : "en");

/** The parts that state machine facts: the hero plate, the power chart, the console, the register. */
const SPEC_UI = ".cm-fleet, .cm-power, .cm-console, .cm-reg-wide, .cm-reg-cards";

/** The machine being shown (with script): its panel, visible and marked. */
function shown(page: Page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll<HTMLElement>(".cm-panel")].filter((p) => getComputedStyle(p).visibility === "visible");
    return {
      visible: visible.map((p) => p.id),
      active: [...document.querySelectorAll(".cm-panel[data-active]")].map((p) => p.id),
      inert: [...document.querySelectorAll(".cm-panel[inert]")].map((p) => p.id).length,
      current: [...document.querySelectorAll(".cm-pick[aria-current='true']")].map((a) => a.getAttribute("href")),
      hash: location.hash,
    };
  });
}

/** Every machine photo on screen: its rendered size against its source (from the media registry, not naturalWidth). */
function photoScale(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>("main img.cm-photo")]
      .filter((img) => img.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && img.getBoundingClientRect().width > 0)
      .map((img) => {
        const r = img.getBoundingClientRect();
        const box = img.parentElement!.getBoundingClientRect();
        const w = Number(img.style.getPropertyValue("--w"));
        const h = Number(img.style.getPropertyValue("--h"));
        return {
          src: decodeURIComponent(new URL(img.currentSrc || img.src).searchParams.get("url") ?? img.src),
          ratio: Math.max(r.width / w, r.height / h),
          inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5,
          // (the selector's cards may sit beyond its own sideways scroller on phones)
          onScreen: !!img.closest(".cm-rail") || (r.left >= -0.5 && r.right <= innerWidth + 0.5),
        };
      }),
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The page, its publication state and its structured data
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the page", () => {
  test("the content layer: six machines in the profile's order, four with a rated power; the page in review", async () => {
    expect(machines.map((m) => m.slug)).toEqual(["tube-cutting-12kw", "fiber-laser-combo-12kw", "fiber-laser-6kw", "fiber-laser-3kw", "cnc-press-brake", "laser-welding"]);
    expect(Object.fromEntries(machines.map((m) => [m.slug, m.powerWatts ?? null]))).toEqual({
      "tube-cutting-12kw": 12000,
      "fiber-laser-combo-12kw": 12000,
      "fiber-laser-6kw": 6000,
      "fiber-laser-3kw": 3000,
      "cnc-press-brake": null,
      "laser-welding": null,
    });
    for (const m of machines) expect(m.source.pages, m.slug).toEqual([7]);
    expect(pageStatus.capabilities).toBe("review");
    expect(pageStatus.project).toBe("planned");
  });

  for (const locale of LOCALES) {
    test(`/${locale}/capabilities: built (not the planned page), its title and description, review and noindex, marked in the header and footer`, async ({ page, request }) => {
      const errors = trackErrors(page);
      const dict = getDictionary(locale);
      const response = await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page).toHaveTitle(`${seo.capabilities.title[locale]} | ${SITE[locale]}`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(seo.capabilities.title[locale]);
      await expect(page.locator(".ip-hero .t-lead")).toHaveText(seo.capabilities.description[locale]);
      // No longer the planned page: no in-development label, stage or placeholder note.
      const main = await page.locator("main").innerText();
      expect(main).not.toContain(dict.placeholder.badge);
      expect(main).not.toContain(dict.placeholder.body);
      expect(main).not.toMatch(/·\s*1E\b/);
      await expect(page.locator(".ip-note")).toHaveCount(0);
      // The sections, in order.
      expect(await page.locator("main > :not(script)").evaluateAll((els) => els.map((el) => el.id || el.className.split(" ")[0]))).toEqual([
        "ip-hero",
        "power",
        "console",
        "register",
        "service-lines",
        "source",
        expect.stringMatching(/ip-cta|sec/),
      ]);
      // Breadcrumb: Home → Capabilities.
      const crumbs = page.getByRole("navigation", { name: BREADCRUMB[locale] }).locator("li");
      await expect(crumbs).toHaveCount(2);
      await expect(crumbs.first().locator("a")).toHaveAttribute("href", `/${locale}`);
      await expect(crumbs.last().locator('[aria-current="page"]')).toHaveText(routeLabels.capabilities[locale]);
      // Search: in review, never indexed; canonical, languages and social cards as before; not in the sitemap.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/capabilities$`));
      for (const lang of ["en", "ar", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", seo.capabilities.title[locale]);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", seo.capabilities.description[locale]);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/capabilities");
      // The header and the footer mark the page.
      await expect(page.locator('.a2-nav a[aria-current="page"]')).toHaveAttribute("href", `/${locale}/capabilities`);
      await expect(page.locator('footer a[aria-current="page"]')).toHaveAttribute("href", `/${locale}/capabilities`);
      expect(await horizontalOverflow(page)).toBe(0);
      expect(errors).toEqual([]);
    });

    test(`/${locale}/capabilities: structured data — a collection page, its trail and the six machines, with no specifications`, async ({ page }) => {
      const dict = getDictionary(locale);
      await page.goto(`/${locale}/capabilities`, { waitUntil: "domcontentloaded" });
      const data = await jsonLd(page);
      expect(data.map((d) => d["@type"]).sort()).toEqual(["BreadcrumbList", "CollectionPage", "ItemList"]);
      const trail = data.find((d) => d["@type"] === "BreadcrumbList");
      expect(trail.itemListElement.map((i: { name: string }) => i.name)).toEqual([dict.common.home, routeLabels.capabilities[locale]]);
      expect(trail.itemListElement[1].item).toMatch(new RegExp(`/${locale}/capabilities$`));
      const list = data.find((d) => d["@type"] === "ItemList");
      expect(list.numberOfItems).toBe(6);
      expect(list.itemListElement).toHaveLength(6);
      list.itemListElement.forEach((item: Record<string, unknown>, i: number) => {
        // Only a position, the name and the machine's address: no power, size, model or maker.
        expect(Object.keys(item).sort()).toEqual(["@type", "name", "position", "url"]);
        expect(item).toMatchObject({ "@type": "ListItem", position: i + 1, name: machine(ORDER[i]).name[locale] });
        expect(item.url).toMatch(new RegExp(`/${locale}/capabilities#${ORDER[i]}$`));
      });
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The six machines and what the profile states about them
// ---------------------------------------------------------------------------------------------------------------------

test.describe("source parity", () => {
  for (const locale of LOCALES) {
    test(`${locale}: six machines everywhere, in one order, each with its record's name, type, capability, service and source`, async ({ page }) => {
      await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
      const ids = (selector: string, attr = "href") =>
        page.locator(selector).evaluateAll((els, attr) => els.map((el) => (el.getAttribute(attr) ?? "").replace(/^.*#/, "")), attr);
      expect(await ids(".cm-panel[data-machine]", "id")).toEqual([...ORDER]);
      expect(await ids(".cm-pick")).toEqual([...ORDER]);
      expect(await ids(".cm-fleet-bay")).toEqual([...ORDER]);
      expect(await ids(".cm-reg-table tbody th a")).toEqual([...ORDER]);
      expect(await ids(".cm-reg-cards .cm-reg-machine")).toEqual([...ORDER]);
      expect(await ids(".cm-bars a")).toEqual(ORDER.filter((s) => RATED[s]));
      expect(await ids(".cm-unrated a")).toEqual(UNRATED);
      expect(await ids(".cm-line-machines a")).toEqual([...ORDER]);
      for (const [i, slug] of ORDER.entries()) {
        const m = machine(slug);
        const panel = page.locator(`#${slug}`);
        await expect(panel).toHaveAttribute("aria-labelledby", `${slug}-name`);
        await expect(panel.locator("h3")).toHaveText(m.name[locale]);
        await expect(panel.locator(".cm-category")).toHaveText(m.category[locale]);
        await expect(panel.locator(".cm-capability")).toHaveText(m.capability[locale]);
        await expect(panel.locator(".cm-spec > div").nth(1).locator("dd")).toHaveText(serviceName(m.service, locale));
        await expect(panel.locator(".cm-spec > div").nth(2).locator("dd")).toHaveText(locale === "en" ? "Company profile · p.7" : "الملف التعريفي · ص 7");
        await expect(panel.locator(".cm-chip-index")).toHaveText(`0${i + 1} / 06`);
        await expect(panel.locator(".cm-actions a").nth(1)).toHaveAttribute("href", `/${locale}/services/${m.service}`);
        await expect(panel.locator(".cm-actions a").first()).toHaveAttribute("href", `/${locale}/contact#quote`);
        const row = page.locator(".cm-reg-table tbody tr").nth(i);
        await expect(row.locator("th")).toHaveText(m.name[locale]);
        await expect(row.locator("td").nth(1)).toHaveText(m.category[locale]);
        await expect(row.locator("td").nth(3)).toHaveText(serviceName(m.service, locale));
        await expect(row.locator(".cm-reg-service")).toHaveAttribute("href", `/${locale}/services/${m.service}`);
      }
      // The register's columns: number, machine, type, rated power, related service, source — nothing else.
      expect(await page.locator(".cm-reg-table thead th").allInnerTexts()).toEqual(
        locale === "en" ? ["No.", "Machine", "Type", "Rated power", "Related service", "Source"] : ["م", "المعدّة", "النوع", "القدرة المقننة", "الخدمة المرتبطة", "المصدر"],
      );
      // The service lines: Laser Cutting (four machines), CNC Bending, Metal Fabrication, each opening its service.
      expect(await page.locator(".cm-line h3").allInnerTexts()).toEqual(["laser-cutting", "cnc-bending", "fabrication"].map((s) => serviceName(s, locale)));
      expect(await page.locator(".cm-line-open").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(
        ["laser-cutting", "cnc-bending", "fabrication"].map((s) => `/${locale}/services/${s}`),
      );
    });

    test(`${locale}: rated power for the four lasers only; the press brake and laser welding state none, everywhere`, async ({ page }) => {
      await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
      const watts = (value: string) => `${value} ${UNIT[locale]}`;
      for (const slug of ORDER) {
        const panel = page.locator(`#${slug}`);
        const row = page.locator(".cm-reg-table tbody tr").filter({ has: page.locator(`a[href="#${slug}"]`) });
        const bay = page.locator(`.cm-fleet-bay[href="#${slug}"]`);
        const pick = page.locator(`.cm-pick[href="#${slug}"]`);
        if (RATED[slug]) {
          await expect(panel.locator(".cm-spec > div").first().locator("dd")).toHaveText(watts(RATED[slug]));
          await expect(panel.locator(".cm-readout-value")).toHaveText(watts(RATED[slug]));
          await expect(row.locator("td").nth(2)).toHaveText(watts(RATED[slug]));
          await expect(bay.locator(".cm-fleet-power")).toHaveText(watts(RATED[slug]));
          await expect(pick.locator(".cm-pick-power")).toHaveText(watts(RATED[slug]));
          await expect(page.locator(`.cm-bars a[href="#${slug}"] .cm-bar-value`)).toHaveText(watts(RATED[slug]));
        } else {
          await expect(panel.locator(".cm-spec > div").first().locator("dd")).toHaveText(NOT_STATED[locale]);
          await expect(panel.locator(".cm-readout-none")).toHaveText(NOT_STATED[locale]);
          await expect(panel.locator(".cm-readout-value")).toHaveCount(0);
          await expect(row.locator("td").nth(2)).toHaveText(NOT_STATED[locale]);
          await expect(bay.locator(".cm-fleet-power")).toHaveCount(0);
          await expect(pick.locator(".cm-pick-power")).toHaveCount(0);
          // Never an empty or zero bar: named under the chart, in words.
          await expect(page.locator(`.cm-bars a[href="#${slug}"]`)).toHaveCount(0);
          await expect(page.locator(".cm-unrated li").filter({ has: page.locator(`a[href="#${slug}"]`) })).toContainText(NOT_STATED[locale]);
          const text = await panel.innerText();
          expect(text, slug).not.toMatch(/\d[\d,]*\s*(W|kW|واط|كيلوواط)\b/);
        }
      }
      // The bars: one baseline, lengths in proportion to the stated ratings (12,000 = full length).
      expect(await page.locator(".cm-bars a").evaluateAll((as) => as.map((a) => Number((a as HTMLElement).style.getPropertyValue("--v"))))).toEqual([1, 1, 0.5, 0.25]);
      // The hero's facts: six machines, four laser cutting systems, the highest stated rating — never a sum.
      expect(await page.locator(".ip-meta dd").allInnerTexts()).toEqual(["06", "04", watts("12,000")]);
      expect(await page.locator("main").innerText()).not.toMatch(/(33,000|33000|45,000|45000)/);
    });

    test(`${locale}: no specification the profile does not give — no sizes, tonnage, speeds, tolerances, models or makers`, async ({ page }) => {
      await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
      const text = (await page.locator(SPEC_UI).allTextContents()).join("\n");
      expect(text.length).toBeGreaterThan(1000);
      const english = /\b(mm|cm|ton|tons|tonne|tonnes|m\/min|mm\/min|mm\/s|tolerance|accuracy|bed size|working area|work area|table size|thickness|capacity\/hour|per hour|rpm|model|manufacturer|brand|kN)\b/i;
      // Arabic has no \b: short units must stand as words; the longer terms anywhere.
      const arabic = /((^|[\s(،:·])(مم|ملم|سم|طن|ميكرون)(?=[\s).,،:·]|$)|م\/دقيقة|متر\/دقيقة|في الساعة|التفاوت|تفاوت|دقة التشغيل|دقة القطع|مقاس السرير|مساحة العمل|مساحة التشغيل|سماكة|السماكة|سُمك|الطراز|موديل|الشركة المصنعة|الصانع|العلامة التجارية|دورة في الدقيقة)/;
      expect(text).not.toMatch(english);
      expect(text).not.toMatch(arabic);
      // Every figure is a place in the order (01–06), a stated rating, the page of the profile (7) or a name's own figure
      // (read text node by text node: neighbouring elements' text would run together).
      const nodes = await page.evaluate((selector) => {
        const out: string[] = [];
        for (const root of document.querySelectorAll(selector)) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) out.push(walker.currentNode.textContent ?? "");
        }
        return out;
      }, SPEC_UI);
      const figures = [...new Set(nodes.flatMap((t) => t.match(/\d[\d,.]*/g) ?? []))].sort();
      const allowed = new Set(["01", "02", "03", "04", "05", "06", "7", "12,000", "6,000", "3,000", "12000", "6000", "3000"]);
      expect(figures.filter((f) => !allowed.has(f)), figures.join(" ")).toEqual([]);
      // The makers' names visible on some of the photos are never written on the page.
      const page_ = (await page.locator("main").innerText()).toLowerCase();
      for (const maker of ["hgstar", "han's", "hans laser", "bodor", "mps 6000"]) expect(page_, maker).not.toContain(maker);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------------------------------

test.describe("photos", () => {
  test("only the six profile cut-outs, each loaded once, named by the stage and decorative elsewhere", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => void (r.resourceType() === "image" && requests.push(r.url())));
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    const files = new Set<string>(ORDER.map((slug) => mediaRegistry[machine(slug).media as keyof typeof mediaRegistry].src));
    const srcs = await page.locator("main img").evaluateAll((imgs) =>
      imgs.map((img) => decodeURIComponent(new URL((img as HTMLImageElement).src).searchParams.get("url") ?? (img as HTMLImageElement).src)),
    );
    expect(srcs.length).toBe(18);
    for (const src of srcs) expect(files.has(src), src).toBe(true);
    // Hero bays and selector thumbnails are decorative (the link names the machine); each stage photo is named.
    for (const img of await page.locator(".cm-fleet img, .cm-pick img").all()) await expect(img).toHaveAttribute("alt", "");
    for (const slug of ORDER) await expect(page.locator(`#${slug} .cm-figure img`)).toHaveAttribute("alt", machine(slug).name.en);
    // Walk the page so every lazy photo loads, then count requests per file: one each.
    for (const slug of ORDER) await page.locator(`.cm-pick[href="#${slug}"]`).click();
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
        scrollTo({ top: y, behavior: "instant" });
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    await page.waitForLoadState("networkidle");
    const machinesRequested = requests.filter((u) => /machines%2F|\/media\/machines\//.test(u));
    const perFile = new Map<string, number>();
    for (const u of machinesRequested) {
      const file = decodeURIComponent(new URL(u).searchParams.get("url") ?? u);
      perFile.set(file, (perFile.get(file) ?? 0) + 1);
    }
    expect([...perFile.keys()].sort()).toEqual([...files].sort());
    for (const [file, count] of perFile) expect(count, file).toBe(1);
    // No other photo or optimized image is requested on this page.
    expect(requests.filter((u) => /\/_next\/image|\/media\//.test(u) && !/machines%2F|\/media\/machines\//.test(u))).toEqual([]);
  });

  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1024, 768],
    [834, 1112],
    [390, 844],
    [320, 700],
  ] as const) {
    test(`at ${width} px every photo, for each machine on the stage, stays within its box and at or below its source size`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/en/capabilities", { waitUntil: "networkidle" });
      const report: string[] = [];
      for (const slug of ORDER) {
        await page.locator(`.cm-pick[href="#${slug}"]`).click();
        await expect(page.locator(`#${slug}`)).toHaveAttribute("data-active", "");
        await expect.poll(() => page.locator(`#${slug} .cm-figure img`).evaluate((img) => img.getAnimations().length)).toBe(0);
        for (const p of await photoScale(page)) {
          if (p.ratio > 1.0001 || !p.inside || !p.onScreen) report.push(`${slug}: ${JSON.stringify(p)}`);
        }
      }
      expect(report).toEqual([]);
    });
  }

  test("Arabic: the photos are never mirrored", async ({ page }) => {
    await page.goto("/ar/capabilities", { waitUntil: "networkidle" });
    const mirrored = await page.evaluate(() =>
      [...document.querySelectorAll("main img")].filter((img) => {
        for (let el: Element | null = img; el && el !== document.body; el = el.parentElement) {
          const style = getComputedStyle(el);
          const m = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
          const scale = style.scale === "none" ? 1 : Number(style.scale.split(" ")[0]);
          if (m.a < 0 || scale < 0) return true;
        }
        return false;
      }).length,
    );
    expect(mirrored).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The selector, the address and the language links
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the console", () => {
  test("choosing a machine shows it alone, marks it, writes its address (no new history entry) and announces it", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    // The first machine until one is chosen; the others are out of reach.
    expect(await shown(page)).toEqual({ visible: [ORDER[0]], active: [ORDER[0]], inert: 5, current: [`#${ORDER[0]}`], hash: "" });
    const entries = await page.evaluate(() => history.length);
    for (const slug of [...ORDER.slice(1), ORDER[0]]) {
      await page.locator(`.cm-pick[href="#${slug}"]`).click();
      await expect.poll(() => shown(page)).toEqual({ visible: [slug], active: [slug], inert: 5, current: [`#${slug}`], hash: `#${slug}` });
      await expect(page.locator(".cm-console [aria-live='polite']")).toHaveText(`Showing: ${machine(slug).name.en}`);
      // The header's language links follow the machine; the page in this language is marked.
      for (const link of await page.locator('.a2-header .a2-lang a[hreflang="ar-SA"]').all()) await expect(link).toHaveAttribute("href", `/ar/capabilities#${slug}`);
      await expect(page.locator('.a2-header .a2-lang a[aria-current="true"]').first()).toHaveAttribute("href", `/en/capabilities#${slug}`);
    }
    expect(await page.evaluate(() => history.length)).toBe(entries);
    // The rail is a labelled navigation of plain links.
    await expect(page.getByRole("navigation", { name: "Choose a machine" })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("from the keyboard: Tab reaches the machines in order, Enter shows one and keeps focus there", async ({ page }) => {
    await page.goto("/en/capabilities#console", { waitUntil: "networkidle" });
    await page.locator(".cm-pick").first().focus();
    for (const slug of ORDER.slice(1, 4)) {
      await page.keyboard.press("Tab");
      await expect(page.locator(`.cm-pick[href="#${slug}"]`)).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expect.poll(() => shown(page)).toMatchObject({ visible: [ORDER[3]], current: [`#${ORDER[3]}`] });
    await expect(page.locator(`.cm-pick[href="#${ORDER[3]}"]`)).toBeFocused();
    // The hidden machines' links are out of the tab order; the shown machine's quote and service links are in it.
    await page.locator(".cm-pick").last().focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(`#${ORDER[3]} .cm-actions a`).first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator(`#${ORDER[3]} .cm-actions a`).nth(1)).toBeFocused();
  });

  test("twenty quick cycles through the six machines end consistent: one machine, its marks, nothing left moved, no listener added", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    const warnings: string[] = [];
    page.on("console", (m) => void (m.type() === "warning" && warnings.push(m.text())));
    await page.goto("/en/capabilities#console", { waitUntil: "networkidle" });
    // The page's event listeners on the window and on every node of the document (DevTools protocol), each by type and
    // the script place that added it, listed after one warm-up cycle (the pointer and the page's controllers set up what
    // they need on first use) and again after twenty cycles. Only the page's own scripts count: Playwright's injected
    // script (it has no URL) puts hit-target listeners on the window around each click, and under load a set of them
    // can still be there when the list is read (13 of them in one run: click, mousedown, pointerdown …).
    const cdp = await page.context().newCDPSession(page);
    const sources = new Map<string, string>();
    cdp.on("Debugger.scriptParsed", (e) => void sources.set(e.scriptId, e.url.replace(/^.*\/_next\/static\//, "")));
    await cdp.send("Debugger.enable");
    const listeners = async () => {
      const out: string[] = [];
      for (const expression of ["window", "document"]) {
        const { result } = await cdp.send("Runtime.evaluate", { expression });
        const { listeners: found } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId!, depth: -1 });
        for (const l of found) {
          const source = sources.get(l.scriptId);
          if (source) out.push(`${expression}: ${l.type} @ ${source}:${l.lineNumber}:${l.columnNumber}`);
        }
      }
      return out.sort();
    };
    for (const slug of ORDER) await page.locator(`.cm-pick[href="#${slug}"]`).click({ delay: 0 });
    await expect.poll(() => shown(page)).toMatchObject({ visible: [ORDER[ORDER.length - 1]] });
    const before = await listeners();
    for (let cycle = 0; cycle < 20; cycle++) {
      for (const slug of ORDER) await page.locator(`.cm-pick[href="#${slug}"]`).click({ delay: 0 });
    }
    const last = ORDER[ORDER.length - 1];
    await expect.poll(() => shown(page)).toEqual({ visible: [last], active: [last], inert: 5, current: [`#${last}`], hash: `#${last}` });
    // Once settled: no animation left running, every photo back in place (no transform piled up), one panel opaque.
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect)?.target?.closest?.(".cm-console")).length), { timeout: 8_000 }).toBe(0);
    const photos = await page.locator(".cm-panel .cm-figure img").evaluateAll((imgs) =>
      imgs.map((img) => ({ id: img.closest(".cm-panel")!.id, translate: getComputedStyle(img).translate, opacity: getComputedStyle(img).opacity })),
    );
    for (const p of photos) expect(p.translate, p.id).toBe(p.id === last ? "none" : "0px 14px");
    expect(await page.locator(".cm-panel").evaluateAll((ps) => ps.filter((p) => getComputedStyle(p).opacity === "1").map((p) => p.id))).toEqual([last]);
    // No listener left behind by the 120 changes.
    expect(await listeners()).toEqual(before);
    // The selector still works from the keyboard: Tab moves to the next machine, Enter shows it.
    await page.locator(`.cm-pick[href="#${ORDER[1]}"]`).focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(`.cm-pick[href="#${ORDER[2]}"]`)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => shown(page)).toEqual({ visible: [ORDER[2]], active: [ORDER[2]], inert: 5, current: [`#${ORDER[2]}`], hash: `#${ORDER[2]}` });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  test("a link on the page to a machine is a real address: Back and Forward return to each machine", async ({ page }) => {
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    await page.locator('.cm-pick[href="#laser-welding"]').click();
    await page.locator('.cm-fleet-bay[href="#fiber-laser-6kw"]').click();
    await expect.poll(() => shown(page)).toMatchObject({ visible: ["fiber-laser-6kw"], hash: "#fiber-laser-6kw" });
    await expect.poll(async () => placed(await placement(page, "fiber-laser-6kw"))).toBe(true);
    await page.goBack();
    await expect.poll(() => shown(page)).toMatchObject({ visible: ["laser-welding"], current: ["#laser-welding"], hash: "#laser-welding" });
    await page.goForward();
    await expect.poll(() => shown(page)).toMatchObject({ visible: ["fiber-laser-6kw"], current: ["#fiber-laser-6kw"], hash: "#fiber-laser-6kw" });
    // A fragment that names no machine (a section) leaves the machine as it was.
    await page.locator('.ip-hero a[href="#console"]').click();
    await expect.poll(() => shown(page)).toMatchObject({ visible: ["fiber-laser-6kw"], current: ["#fiber-laser-6kw"], hash: "#console" });
  });

  test("before the script takes over, the address's machine (or the first) is the one shown", async ({ page }) => {
    // The page's scripts are held back; the boot script in the head still marks the page as scripted.
    let held = 0;
    await page.route(/\/_next\/static\/chunks\/.+\.js$/, (route) => {
      held++;
      return route.abort();
    });
    await page.goto("/en/capabilities#cnc-press-brake", { waitUntil: "load" });
    expect(held).toBeGreaterThan(0);
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    await expect(page.locator(".cm-console")).not.toHaveAttribute("data-ready", "");
    expect((await shown(page)).visible).toEqual(["cnc-press-brake"]);
    expect(placed(await placement(page, "cnc-press-brake"))).toBe(true);
    await page.goto("/en/capabilities", { waitUntil: "load" });
    expect((await shown(page)).visible).toEqual([ORDER[0]]);
  });

  for (const locale of LOCALES) {
    test(`${locale}: the language switch keeps the machine (desktop bar, phone control and menu sheet) and remembers the language`, async ({ page, context }) => {
      const target = other(locale);
      await page.goto(`/${locale}/capabilities#cnc-press-brake`, { waitUntil: "networkidle" });
      const links = page.locator(`.a2-header a[hreflang="${HTML_LANG[target]}"]`);
      await expect(links).toHaveCount(3);
      for (const link of await links.all()) await expect(link).toHaveAttribute("href", `/${target}/capabilities#cnc-press-brake`);
      await links.first().click();
      await page.waitForURL(`**/${target}/capabilities#cnc-press-brake`);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[target]);
      await expect.poll(() => shown(page)).toMatchObject({ visible: ["cnc-press-brake"], current: ["#cnc-press-brake"] });
      await expect.poll(async () => placed(await placement(page, "cnc-press-brake"))).toBe(true);
      expect((await context.cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe(target);
    });
  }

  test("the theme: dark from the first paint when stored, kept across the language switch, toggled back and stored", async ({ page, context }) => {
    const errors = trackErrors(page);
    await context.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("rawasy-theme", "dark");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(19, 24, 32)");
    await page.locator(".a2-header .a2-lang").first().locator('a[hreflang="ar-SA"]').click();
    await page.waitForURL("**/ar/capabilities");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.locator(".a2-header [role=group] button").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => localStorage.getItem("rawasy-theme"))).toBe("light");
    expect(errors).toEqual([]);
  });

  test("Arabic: Tajawal for the title and the semibold labels, IBM Plex Sans Arabic for text, never letter-spaced; self-hosted faces", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => void (/fonts\.(googleapis|gstatic)\.com/.test(r.url()) && external.push(r.url())));
    await page.goto("/ar/capabilities", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const faces = await page.evaluate(() => {
      const face = (sel: string) => [...document.querySelectorAll(sel)].map((el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, ""));
      const spaced = [...document.querySelectorAll("main *")].filter((el) => !["normal", "0px"].includes(getComputedStyle(el).letterSpacing)).length;
      // Semibold text (600 and up) never in the Plex face, which has 400 and 500 only.
      const heavyPlex = [...document.querySelectorAll("main *:not(.sr-only)")].filter((el) => {
        const st = getComputedStyle(el);
        return el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && Number(st.fontWeight) >= 600 && /Plex/.test(st.fontFamily.split(",")[0]);
      }).map((el) => el.className);
      return {
        h1: face("h1"),
        h3: [...new Set(face(".cm-data-name"))],
        labels: [...new Set(face(".cm-pick-name, .cm-fleet-name, .cm-category, .cm-bar-name, .cm-reg-table th"))],
        text: [...new Set(face(".cm-capability, .cm-source-body, .ip-hero .t-lead"))],
        spaced,
        heavyPlex,
      };
    });
    expect(faces.h1[0]).toMatch(/Tajawal/);
    expect(faces.h3).toEqual([expect.stringMatching(/Tajawal/)]);
    for (const f of faces.labels) expect(f).toMatch(/Tajawal/);
    for (const f of faces.text) expect(f).toMatch(/IBM Plex Sans Arabic/);
    expect(faces.spaced).toBe(0);
    expect(faces.heavyPlex).toEqual([]);
    expect(external).toEqual([]);
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the selector scrolls sideways inside itself; the menu sheet's language switch keeps the chosen machine", async ({ page }) => {
      await page.goto("/ar/capabilities#console", { waitUntil: "networkidle" });
      const rail = page.locator(".cm-rail ol");
      expect(await rail.evaluate((ol) => getComputedStyle(ol).overflowX)).toBe("auto");
      expect(await rail.evaluate((ol) => ol.scrollWidth > ol.clientWidth)).toBe(true);
      await page.locator('.cm-pick[href="#laser-welding"]').tap();
      await expect.poll(() => shown(page)).toMatchObject({ visible: ["laser-welding"], hash: "#laser-welding" });
      expect(await horizontalOverflow(page)).toBe(0);
      await page.locator("details[data-sheet] > summary").tap();
      await expect(page.locator('.a2-sheet a.a2-sheet-row[aria-current="page"]')).toHaveAttribute("href", "/ar/capabilities");
      await expect(page.locator('.a2-sheet .a2-lang a[hreflang="en"]')).toHaveAttribute("href", "/en/capabilities#laser-welding");
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Every address of a machine, cold, with the fonts arriving late (the TM-2.5 anchor architecture)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("cold deep links with delayed fonts", () => {
  for (const locale of LOCALES) {
    for (const slug of ORDER) {
      const path = `/${locale}/capabilities#${slug}`;
      test(`${path}: shows that machine and lands below the header on a desktop and a phone, before and after the fonts`, async ({ browser }) => {
        test.setTimeout(90_000);
        for (const view of VIEWPORTS) {
          for (const delay of FONT_DELAYS) {
            const { samples, glide, fonts } = await coldLanding(browser, path, view, delay);
            expect(fonts, `${path} fonts requested`).toBeGreaterThan(0);
            for (const [moment, sample] of Object.entries(samples)) {
              expect(placed(sample), `${path} ${view.name} +${delay} ms, ${moment}: ${JSON.stringify(sample)}`).toBe(true);
            }
            expect(glide).toEqual({ atStart: "auto", settled: "smooth" });
          }
          // And the machine shown is the one the address names.
          const context = await browser.newContext({ viewport: view.viewport, isMobile: view.isMobile, hasTouch: view.isMobile });
          const page = await context.newPage();
          await page.goto(path, { waitUntil: "networkidle" });
          await expect.poll(() => shown(page)).toEqual({ visible: [slug], active: [slug], inert: 5, current: [`#${slug}`], hash: `#${slug}` });
          // The selector is in view above the stage (phone) or beside it (desktop), and the machine's name too.
          await expect(page.locator(`.cm-pick[href="#${slug}"]`)).toBeInViewport();
          await expect(page.locator(`#${slug}-name`)).toBeInViewport();
          await context.close();
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The links that lead here
// ---------------------------------------------------------------------------------------------------------------------

test.describe("links to the machines", () => {
  test("every machine link on the homepage, About and the six service pages, in both languages, has its machine here", async ({ page, request }) => {
    test.setTimeout(90_000);
    const sources = ["", "/about", ...services.map((s) => `/services/${s.slug}`)];
    const hrefs = new Set<string>();
    for (const locale of LOCALES) {
      for (const path of sources) {
        await page.goto(`/${locale}${path}`, { waitUntil: "domcontentloaded" });
        for (const href of await page.locator(`a[href^="/${locale}/capabilities"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")!))) hrefs.add(href);
      }
    }
    const withMachine = [...hrefs].filter((h) => h.includes("#"));
    // The homepage showcase names all six; the service pages name theirs.
    expect(new Set(withMachine.map((h) => h.split("#")[1]))).toEqual(new Set(ORDER));
    for (const locale of LOCALES) {
      const html = await (await request.get(`/${locale}/capabilities`)).text();
      for (const href of withMachine.filter((h) => h.startsWith(`/${locale}/`))) {
        const id = href.split("#")[1];
        expect(html, href).toMatch(new RegExp(`<article[^>]*\\bid="${id}"[^>]*data-machine`));
      }
    }
    for (const href of [...hrefs].filter((h) => !h.includes("#"))) expect(href).toMatch(/^\/(en|ar)\/capabilities$/);
  });

  /** After following a link to /<locale>/capabilities#<slug>: that page and address, the machine's panel there, shown
   *  alone and marked in the selector, landed below the header with its name in view. */
  async function lands(page: Page, locale: TestLocale, slug: string) {
    await page.waitForURL(`**/${locale}/capabilities#${slug}`);
    expect(new URL(page.url()).pathname).toBe(`/${locale}/capabilities`);
    await expect(page.locator(`#${slug}[data-machine]`)).toHaveCount(1);
    await expect.poll(() => shown(page)).toEqual({ visible: [slug], active: [slug], inert: 5, current: [`#${slug}`], hash: `#${slug}` });
    await expect.poll(async () => placed(await placement(page, slug))).toBe(true);
    await expect(page.locator(`#${slug}-name`)).toBeInViewport();
  }

  // Every machine link of the service pages: Laser Cutting names four machines, CNC Bending and Fabrication one each.
  for (const locale of LOCALES) {
    for (const service of services) {
      for (const slug of service.machines) {
        test(`/${locale}/services/${service.slug} → #${slug}: the link opens Capabilities on that machine, below the header`, async ({ page }) => {
          const errors = trackErrors(page);
          await page.goto(`/${locale}/services/${service.slug}`, { waitUntil: "networkidle" });
          await page.locator(`#machinery a[href="/${locale}/capabilities#${slug}"]`).click();
          await lands(page, locale, slug);
          expect(errors).toEqual([]);
        });
      }
    }
  }

  // The homepage showcase's six machine title links (it shows one machine at a time: choose it in its list first).
  for (const locale of LOCALES) {
    for (const slug of ORDER) {
      test(`/${locale} → #${slug}: the homepage showcase's link opens Capabilities on that machine, below the header`, async ({ page }) => {
        const errors = trackErrors(page);
        await page.goto(`/${locale}#machinery`, { waitUntil: "networkidle" });
        await page.locator(`#machinery .a2-mx-pick[href="#m-${slug}"]`).click();
        const link = page.locator(`#m-${slug} h3 a`);
        await expect(link).toHaveAttribute("href", `/${locale}/capabilities#${slug}`);
        await link.click();
        await lands(page, locale, slug);
        expect(errors).toEqual([]);
      });
    }
  }

  test("the homepage machinery stays frozen: its two components are byte-identical to TM-3", async () => {
    const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
    expect(hash("src/components/commerce/home/Machinery.tsx")).toBe("434d1bc581a9a824ea32952f254a0a6e6bf54c84bbf1a86aca22612f32a0eb32");
    expect(hash("src/components/commerce/home/MachineShowcase.tsx")).toBe("d39c9a5d77acda64114292d7581765bea7b76b47de3a4dbbcc2e1967cf7d6a94");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Accessibility, modes, layout
// ---------------------------------------------------------------------------------------------------------------------

test.describe("accessibility", () => {
  test("one h1, labelled regions and table, decoration hidden from assistive technology", async ({ page }) => {
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toHaveCount(1);
    for (const id of ["power", "console", "register", "service-lines", "source"]) {
      await expect(page.locator(`section#${id}`)).toHaveAttribute("aria-labelledby", `${id}-title`);
      await expect(page.locator(`#${id}-title`)).toHaveCount(1);
    }
    // The register: a real table with its caption, column headers and a row header per machine.
    const table = page.locator(".cm-reg-table");
    await expect(table.locator("caption")).toHaveText(capabilitiesPage.register.caption.en);
    await expect(table.locator("thead th[scope='col']")).toHaveCount(6);
    await expect(table.locator("tbody th[scope='row']")).toHaveCount(6);
    // The hero plate is a labelled list of links; the console's live region is polite.
    await expect(page.locator(".cm-fleet-grid")).toHaveAttribute("aria-label", capabilitiesPage.hero.fleet.en);
    await expect(page.locator(".cm-console [aria-live='polite']")).toHaveCount(1);
    // Decoration: the stage's marks, readout, sketch, scan and floor lines, the shared stage and sheet.
    const exposed = await page.evaluate(() =>
      [...document.querySelectorAll(".cm-chip, .cm-schem, .cm-readout, .cm-scan, .cm-floor-active, .cm-bay, .cm-sheet, .sk, .cm-fleet-n, .cm-pick-n, .a2-ambient, .a2-cursor, svg.mc-icon")]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .map((el) => el.getAttribute("class")),
    );
    expect(exposed).toEqual([]);
    // The hidden machines are inert once the console runs; the shown one is not.
    await expect(page.locator(".cm-panel[inert]")).toHaveCount(5);
    await expect(page.locator(`#${ORDER[0]}`)).not.toHaveAttribute("inert", "");
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing moves: no scan, no sketch run, no transition; a machine changes at once, each sketch shows the finished work", async ({ page }) => {
      await page.goto("/en/capabilities", { waitUntil: "networkidle" });
      const moving = () =>
        page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect)?.target?.closest?.(".cm-fleet, .cm-console, .cm-power")).length);
      expect(await moving()).toBe(0);
      await page.locator('.cm-pick[href="#cnc-press-brake"]').click();
      expect(await moving()).toBe(0);
      expect((await shown(page)).visible).toEqual(["cnc-press-brake"]);
      expect(await page.locator("#cnc-press-brake").evaluate((p) => getComputedStyle(p).opacity)).toBe("1");
      // The finished work: the cut drawn in full; the bend at its angle; the weld head at the foot of the seam.
      for (const cut of await page.locator(".sk-cut").all()) expect(await cut.evaluate((el) => getComputedStyle(el).strokeDashoffset)).toBe("0px");
      expect(await page.locator("#cnc-press-brake .sk-blank-a").evaluate((el) => getComputedStyle(el).rotate)).toBe("20deg");
      expect(await page.locator("#laser-welding .sk-head").evaluate((el) => getComputedStyle(el).translate)).toBe("0px 76px");
      // The scan line is not drawn at rest.
      for (const scan of await page.locator(".cm-scan").all()) {
        expect(await scan.evaluate((el) => [getComputedStyle(el, "::before").opacity, getComputedStyle(el, "::after").opacity])).toEqual(["0", "0"]);
      }
    });
  });

  test.describe("forced colours", () => {
    test.use({ contextOptions: { forcedColors: "active" } });

    test("the chosen machine is outlined and underlined in system colours; bars in CanvasText; light effects hidden", async ({ page }) => {
      await page.goto("/en/capabilities", { waitUntil: "networkidle" });
      const system = await page.evaluate(() =>
        Object.fromEntries(
          ["Highlight", "CanvasText"].map((name) => {
            const probe = document.body.appendChild(document.createElement("div"));
            probe.style.cssText = `color: ${name}; forced-color-adjust: none`;
            const value = getComputedStyle(probe).color;
            probe.remove();
            return [name, value];
          }),
        ),
      );
      await page.locator('.cm-pick[href="#fiber-laser-3kw"]').click();
      const chosen = page.locator('.cm-pick[href="#fiber-laser-3kw"]');
      await expect(chosen).toHaveAttribute("aria-current", "true");
      const ring = (a: Element) => {
        const after = getComputedStyle(a, "::after");
        return [after.content, after.borderTopStyle, after.borderTopColor];
      };
      expect(await chosen.evaluate(ring)).toEqual(['""', "solid", system.Highlight]);
      expect(await chosen.locator(".cm-pick-name").evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("underline");
      const other = page.locator('.cm-pick[href="#laser-welding"]');
      expect((await other.evaluate(ring))[0]).toBe("none");
      expect(await other.locator(".cm-pick-name").evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
      for (const bar of await page.locator(".cm-bar").all()) expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(system.CanvasText);
      for (const el of await page.locator(".cm-scan, .cm-floor-active").all()) expect(await el.evaluate((e) => getComputedStyle(e).display)).toBe("none");
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("every machine is on the page with its photo, facts and links; the selector jumps; an address lands on its machine", async ({ page }) => {
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/capabilities`, { waitUntil: "load" });
        await expect(page.locator("h1")).toHaveCount(1);
        for (const slug of ORDER) {
          const panel = page.locator(`#${slug}`);
          await panel.scrollIntoViewIfNeeded();
          await expect(panel).toBeVisible();
          await expect(panel.locator(".cm-figure img")).toBeVisible();
          await expect(panel.locator("h3")).toHaveText(machine(slug).name[locale]);
          await expect(panel.locator(`a[href="/${locale}/contact#quote"]`)).toBeVisible();
          await expect(panel.locator(`a[href="/${locale}/services/${machine(slug).service}"]`)).toBeVisible();
          await expect(page.locator(`.cm-pick[href="#${slug}"]`)).toBeVisible();
        }
        // No reveal left hidden, the light theme.
        const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length);
        expect(hidden).toBe(0);
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(244, 244, 241)");
        // The shared stage and sheet are not drawn; each machine has its own stage.
        expect(await page.locator(".cm-bay, .cm-sheet").evaluateAll((els) => els.map((el) => getComputedStyle(el).display))).toEqual(["none", "none"]);
      }
      await page.locator('.cm-pick[href="#laser-welding"]').click();
      await expect.poll(() => page.evaluate(() => location.hash)).toBe("#laser-welding");
      await expect.poll(async () => placed(await placement(page, "laser-welding"))).toBe(true);
      await page.goto("/en/capabilities#cnc-press-brake", { waitUntil: "load" });
      await expect.poll(async () => placed(await placement(page, "cnc-press-brake"))).toBe(true);
    });
  });

  test("no sideways scroll and nothing outside the screen at the twelve sizes, in both languages", async ({ page }) => {
    test.setTimeout(120_000);
    const sizes = [
      [1920, 1080],
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [834, 1112],
      [430, 932],
      [412, 915],
      [393, 852],
      [390, 844],
      [375, 812],
      [360, 780],
      [320, 700],
    ] as const;
    const problems: string[] = [];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/capabilities`, { waitUntil: "networkidle" });
        const overflow = await horizontalOverflow(page);
        // Everything in main stays on screen, except inside the selector's own sideways scroller.
        const outside = await page.evaluate(() =>
          [...document.querySelectorAll("main *")]
            .filter((el) => !el.closest(".cm-rail ol"))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1);
            })
            .map((el) => el.className || el.tagName)
            .slice(0, 3),
        );
        if (overflow > 0 || outside.length) problems.push(`${locale} ${width}: overflow ${overflow} ${outside.join(", ")}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
