import { expect, test, type Page } from "@playwright/test";
import { about } from "../src/content/about";
import { home } from "../src/content/home";
import { mediaRegistry } from "../src/content/media.generated";
import { projectsPage } from "../src/content/pages";
import { isShowcased, projectCategories, projects, withheldMedia } from "../src/content/projects";
import { seo } from "../src/content/seo";
import { AMBIENT, ambientAnimations } from "./a2-helpers";
import { coldLanding, FONT_DELAYS, placed, placement, VIEWPORTS } from "./anchor-helpers";
import { HTML_LANG, hiddenReveals, horizontalOverflow, jsonLd, LOCALES, trackErrors, type TestLocale } from "./helpers";

/**
 * Stage TM-2.5: the Projects overview in the Modern Commerce design (src/app/(commerce)/[locale]/projects/, components in
 * src/components/commerce/projects/). Migrated here, assertion by assertion, from the V2 spec (redesign-v2.spec.ts:
 * the parts and their order, withheld photos, filtering and its announcement, the hero's quick toggles, keyboard use,
 * the columns, the phone bar, reduced motion, no JavaScript), with the previous design's stand-ins that ran on this page
 * (site, stage-1c and visual-system specs: the ambient resting while scrolling, focus showing the hover state). Added:
 * one anchor per showcased project (#<slug>) and every way onto it — the index, the featured project and the highlights
 * on this page, About's and the service pages' cards (decision D4), the address itself — with the choice cleared first
 * when it hides the target; the bar as one row of fixed height that scrolls sideways; landings clear of the header and
 * the bar, cold and with late fonts; photos never above their source size. Since Stage 1F each gallery card carries one
 * link, "View project", to the project's own page (the pages themselves: commerce-project-detail.spec.ts); nothing else on
 * the website links a project page. The generic inner-page checks of stage-1c.spec.ts still run on this page
 * (INNER_PAGES).
 */

const SHOWCASED = projects.filter(isShowcased);
const SLUGS = SHOWCASED.map((p) => p.slug);
const ITEMS = "#gallery li[data-project]";
const SHOWN = `${ITEMS}:not([hidden])`;
const BAR = ".pj-bar [role=group]";
const QUICK = ".pj-quick [role=group]";
const IN_GALLERY = home.projects.inGallery;
const HIGHLIGHTS = projectsPage.editorial.slugs;
/** Gallery reference order (as the index lists the projects): numbered references first, then the profile pages. */
const refOrder = (ref: string) => (Number.isNaN(parseInt(ref, 10)) ? 1000 : parseInt(ref, 10));
const INDEXED = [...SHOWCASED].sort((a, b) => refOrder(a.galleryRef) - refOrder(b.galleryRef)).map((p) => p.slug);
const category = (slug: string, locale: TestLocale) => projectCategories.find((c) => c.slug === slug)!.label[locale];

/** Source size of every image in the media registry, by its file path. */
const SOURCE = new Map<string, readonly [number, number]>(Object.values(mediaRegistry).map((m) => [m.src, [m.width, m.height] as const]));
const mediaPath = (src: string) => decodeURIComponent(src.replace(/.*url=([^&]+).*/, "$1"));

/** Where a target sits: its top, the header's bottom and the bar's bottom (the header's when there is no bar). */
function landing(page: Page, id: string) {
  return page.evaluate((id) => {
    const top = document.getElementById(id)!.getBoundingClientRect().top;
    const header = document.querySelector(".a2-header")!.getBoundingClientRect().bottom;
    const bar = document.querySelector(".pj-bar");
    const barBottom = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().bottom : header;
    return { top: Math.round(top), header: Math.round(header), bar: Math.round(barBottom) };
  }, id);
}

/** Clear of the header and of the bar, by a small gap. */
const clear = ({ top, bar }: { top: number; bar: number }) => top - bar >= 8 && top - bar <= 24;

const pressed = (page: Page, group: string) => page.locator(`${group} button[aria-pressed="true"]`).allTextContents();

// ---------------------------------------------------------------------------------------------------------------------
// The page: parts, projects, content
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the page", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/projects: the parts in their order, the 27 projects in theirs, the index after them`, async ({ page }) => {
      const errors = trackErrors(page);
      const response = await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1#page-title")).toHaveText(projectsPage.hero.title[locale]);
      // Hero, featured project, highlights, gallery, index, closing call to action — as before.
      const order = await page.evaluate(() =>
        ["#page-title", "#featured-title", "#highlights-title", "#gallery-title", "#index-title", "#page-cta-title"].map(
          (id) => document.querySelector(id)!.getBoundingClientRect().top + scrollY,
        ),
      );
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      // The hero carries photographs: the three prints.
      expect(await page.locator(".pj-collage img").count()).toBe(3);
      // Every showcased project, in content order, each card leading with its photo(s) and naming its project.
      expect(await page.locator(ITEMS).evaluateAll((lis) => lis.map((li) => li.id))).toEqual(SLUGS);
      for (const p of SHOWCASED) {
        const item = page.locator(`${ITEMS}#${p.slug}`);
        expect(await item.locator("img").count(), p.slug).toBeGreaterThanOrEqual(1);
        await expect(item.locator("h3"), p.slug).toHaveText(p.title[locale]);
        await expect(item.locator(".pj-ref"), p.slug).toHaveText(`${projectsPage.refLabel[locale]} ${p.galleryRef}`);
        await expect(item.locator(".pj-cats"), p.slug).toHaveText(p.categories.slice(0, 2).map((c) => category(c, locale)).join(" · "));
      }
      // The text index comes last and lists the same projects by gallery reference.
      await expect(page.locator('section[aria-labelledby="index-title"] ol > li')).toHaveCount(SLUGS.length);
      expect(errors).toEqual([]);
    });
  }

  test("withheld photos and flagged projects stay out; the page stays out of search until launch", async ({ page, request }) => {
    for (const locale of LOCALES) {
      const html = await (await request.get(`/${locale}/projects`)).text();
      for (const id of withheldMedia) expect(html, id).not.toContain(id.split("/")[1]);
      for (const p of projects.filter((p) => !isShowcased(p))) {
        expect(html, p.slug).not.toContain(`id="${p.slug}"`);
        expect(html, p.slug).not.toContain(`#${p.slug}"`);
        expect(html, p.slug).not.toContain(p.title[locale]);
      }
    }
    await page.goto("/en/projects");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the featured project and the highlights keep their content; their action goes to the project's place in the gallery", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      const featured = SHOWCASED.find((p) => p.slug === projectsPage.featured.slug)!;
      const panel = page.locator(".pj-feature");
      await expect(panel.locator(".eyebrow")).toHaveText(projectsPage.featured.label[locale]);
      await expect(panel.locator(".pj-feature-ref")).toHaveText(`${projectsPage.refLabel[locale]} ${featured.galleryRef}`);
      await expect(panel.locator("h2#featured-title")).toHaveText(featured.title[locale]);
      await expect(panel.locator(".pj-feature-text")).toHaveText(featured.summary[locale]);
      await expect(panel.locator(".pj-feature-tags li")).toHaveText(featured.categories.map((c) => category(c, locale)));
      await expect(panel.locator("a")).toHaveCount(1);
      await expect(panel.locator("a")).toHaveAttribute("href", `#${featured.slug}`);
      await expect(panel.locator("a")).toHaveText(IN_GALLERY[locale]);
      // The main photo carries the project's name; the second is decoration of the same piece.
      expect(await panel.locator("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt")))).toEqual([featured.title[locale], ""]);

      const cards = page.locator(".pj-highlights > li > a");
      expect(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(HIGHLIGHTS.map((s) => `#${s}`));
      for (const [i, slug] of HIGHLIGHTS.entries()) {
        const p = SHOWCASED.find((x) => x.slug === slug)!;
        const card = cards.nth(i);
        await expect(card.locator(".pj-ref")).toHaveText(`${projectsPage.refLabel[locale]} ${p.galleryRef}`);
        await expect(card.locator("h3")).toHaveText(p.title[locale]);
        await expect(card.locator(".pj-tags .tag")).toHaveText(p.categories.slice(0, 3).map((c) => category(c, locale)));
        await expect(card.locator(".pj-hl-text")).toHaveText(p.summary[locale]);
        await expect(card.locator(".pj-go")).toHaveText(IN_GALLERY[locale]);
      }
    }
  });

  test("SEO as before: title, description, canonical, languages, social tags, CollectionPage and breadcrumbs; noindex; not in the sitemap", async ({ page, request }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      await expect(page).toHaveTitle(`${seo.projects.title[locale]} | ${locale === "en" ? "RAWASY" : "رواسي"}`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", seo.projects.description[locale]);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/projects$`));
      for (const lang of ["en", "ar", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      const data = await jsonLd(page);
      expect(data.map((d) => d["@type"]).sort()).toEqual(expect.arrayContaining(["BreadcrumbList", "CollectionPage"]));
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/projects</loc>");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Sitemap:/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Anchors: one per project, and every way onto it
// ---------------------------------------------------------------------------------------------------------------------

test.describe("anchors", () => {
  test("one anchor per showcased project: 27 ids, each the project's slug (no language in it), unique on the page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      const ids = await page.locator(ITEMS).evaluateAll((lis) => lis.map((li) => li.id));
      expect(ids).toHaveLength(27);
      expect(new Set(ids).size).toBe(27);
      expect(ids.sort()).toEqual([...SLUGS].sort());
      for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const all = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((el) => el.id));
      expect(all.length).toBe(new Set(all).size);
    }
  });

  test("the index links every project to its place in the gallery, by gallery reference", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      const links = page.locator(".pj-index a");
      expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(INDEXED.map((s) => `#${s}`));
      for (const slug of [INDEXED[0], INDEXED[13], INDEXED[26]]) {
        await page.locator(`.pj-index a[href="#${slug}"]`).click();
        await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${slug}`);
        await expect.poll(async () => clear(await landing(page, slug)), { message: `${locale} ${slug}` }).toBe(true);
      }
    }
  });

  test("a link to a project the choice hides shows every project first: the browser's own jump lands on it, never on a hidden item", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    // Whether the target is hidden when the browser starts its jump: a click listener on the window runs after the page's
    // own (capturing) one and before the link's default action.
    const watch = (slug: string) =>
      page.evaluate((slug) => {
        const target = document.getElementById(slug)!;
        (window as unknown as { seen: boolean | null }).seen = null;
        addEventListener("click", () => ((window as unknown as { seen: boolean | null }).seen = target.hidden), { once: true });
      }, slug);
    const seen = () => page.evaluate(() => (window as unknown as { seen: boolean | null }).seen);
    const cases = [
      // [choice, the link, the target] — the choice hides the target each time.
      ["Shade & Canopies", '.pj-index a[href="#tiered-chandelier"]', "tiered-chandelier"],
      ["Structures", '.pj-highlights a[href="#suspended-lantern"]', "suspended-lantern"],
      ["Structures", '.pj-feature a[href="#tulip-roundabout-sculpture"]', "tulip-roundabout-sculpture"],
    ] as const;
    for (const [choice, link, target] of cases) {
      await page.locator("#gallery").scrollIntoViewIfNeeded();
      await page.locator(BAR).getByRole("button", { name: choice, exact: true }).click();
      await expect(page.locator(`#${target}`)).toBeHidden();
      await page.locator(link).scrollIntoViewIfNeeded();
      await watch(target);
      await page.locator(link).click();
      await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${target}`);
      expect(await pressed(page, BAR)).toEqual(["All"]);
      await expect(page.locator(SHOWN)).toHaveCount(27);
      await expect.poll(async () => clear(await landing(page, target)), { message: target }).toBe(true);
      expect(await seen(), target).toBe(false);
    }
  });

  test("an address with a project's #slug arrives unfiltered, on the project, clear of the header and the bar", async ({ page }) => {
    for (const [locale, slug] of [
      ["en", "calligraphic-sculptures"],
      ["ar", "car-park-shade-structures"],
    ] as const) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      await page.goto("about:blank");
      await page.goto(`/${locale}/projects#${slug}`, { waitUntil: "networkidle" });
      expect(await pressed(page, BAR)).toEqual([projectsPage.gallery.all[locale]]);
      await expect(page.locator(SHOWN)).toHaveCount(27);
      await expect.poll(async () => clear(await landing(page, slug))).toBe(true);
      expect(placed(await placement(page, slug))).toBe(true);
    }
  });

  test("#gallery arrives with every project, its heading below the header and the bar under the intro", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      await page.goto("about:blank");
      await page.goto(`/${locale}/projects#gallery`, { waitUntil: "networkidle" });
      await expect(page.locator(SHOWN)).toHaveCount(27);
      expect(await pressed(page, BAR)).toEqual([projectsPage.gallery.all[locale]]);
      await expect.poll(async () => placed(await placement(page, "gallery"))).toBe(true);
      const box = await page.evaluate(() => ({
        title: document.getElementById("gallery-title")!.getBoundingClientRect().top,
        header: document.querySelector(".a2-header")!.getBoundingClientRect().bottom,
        intro: document.querySelector("#gallery .t-lead")!.getBoundingClientRect().bottom,
        bar: document.querySelector(".pj-bar")!.getBoundingClientRect().top,
      }));
      expect(box.title).toBeGreaterThanOrEqual(box.header);
      expect(box.bar).toBeGreaterThanOrEqual(box.intro);
      await expect(page.locator("#gallery-title")).toBeInViewport();
    }
  });

  for (const view of VIEWPORTS) {
    test(`a project lands clear of the header and the bar on a ${view.name}, from the index and from the address`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: view.viewport, isMobile: view.isMobile, hasTouch: view.isMobile });
      const page = await context.newPage();
      for (const slug of ["wave-form-sculpture", "laser-cut-tree-grate", "lattice-tower-replica"]) {
        await page.goto(`/en/projects#${slug}`, { waitUntil: "networkidle" });
        await expect.poll(async () => clear(await landing(page, slug)), { message: `address ${slug}` }).toBe(true);
        const box = await landing(page, slug);
        expect(box.bar).toBeGreaterThan(box.header);
      }
      await page.goto("/ar/projects", { waitUntil: "networkidle" });
      await page.locator('.pj-index a[href="#perforated-beams-and-pergola"]').click();
      await expect.poll(async () => clear(await landing(page, "perforated-beams-and-pergola"))).toBe(true);
      await context.close();
    });
  }

  test.describe("cold load with delayed fonts", () => {
    const CASES = ["/en/projects#gallery", "/ar/projects#gallery", "/en/projects#heritage-cannon-replicas", "/ar/projects#stainless-steel-handrails"];
    for (const path of CASES) {
      for (const view of VIEWPORTS) {
        test(`${path} on a ${view.name}: lands in place and stays there`, async ({ browser }) => {
          for (const delay of FONT_DELAYS) {
            const { samples, glide, fonts } = await coldLanding(browser, path, view, delay);
            expect(fonts).toBeGreaterThan(0);
            for (const [moment, sample] of Object.entries(samples)) {
              expect(placed(sample), `${path} ${view.name} +${delay} ms, ${moment}: ${JSON.stringify(sample)}`).toBe(true);
            }
            expect(glide).toEqual({ atStart: "auto", settled: "smooth" });
          }
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Decision D4 elsewhere: About and the service pages name the project; the homepage keeps the gallery
// ---------------------------------------------------------------------------------------------------------------------

test.describe("decision D4 across the site", () => {
  test("About's four project cards open their own project in the gallery", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      const cards = page.locator("#work ul a");
      expect(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(about.projects.slugs.map((s) => `/${locale}/projects#${s}`));
      await expect(cards.locator(".ab-go")).toHaveText(Array(4).fill(IN_GALLERY[locale]));
    }
    await page.locator("#work ul a").nth(1).click();
    await page.waitForURL(`**/ar/projects#${about.projects.slugs[1]}`);
    await expect(page.locator(SHOWN)).toHaveCount(27);
    await expect.poll(async () => clear(await landing(page, about.projects.slugs[1]))).toBe(true);
  });

  test("the service pages' project cards open their own project in the gallery", async ({ page }) => {
    for (const [locale, service, slugs] of [
      ["en", "laser-cutting", ["geometric-lanterns", "perforated-canopy-screen", "clock-tower-landmark", "suspended-lantern"]],
      ["ar", "fabrication", ["heritage-cannon-replicas", "dome-finial-and-crescent", "sculpture-fabrication", "lattice-tower-replica"]],
      ["en", "cnc-bending", ["perforated-metal-seating"]],
    ] as const) {
      await page.goto(`/${locale}/services/${service}`, { waitUntil: "networkidle" });
      const cards = page.locator("#projects a.ab-proj");
      expect(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(slugs.map((s) => `/${locale}/projects#${s}`));
    }
    await page.goto("/en/services/steel-structures", { waitUntil: "networkidle" });
    await page.locator('#projects a[href="/en/projects#curved-steel-frames"]').click();
    await page.waitForURL("**/en/projects#curved-steel-frames");
    await expect.poll(async () => clear(await landing(page, "curved-steel-frames"))).toBe(true);
  });

  test("the homepage's six cards still open the gallery as a whole (unchanged), which arrives with every project", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });
      const hrefs = await page.locator("#projects a.a2-proj").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(hrefs).toEqual(Array(6).fill(`/${locale}/projects#gallery`));
    }
    await page.locator("#projects a.a2-proj").nth(2).click();
    await page.waitForURL("**/ar/projects#gallery");
    await expect(page.locator(SHOWN)).toHaveCount(27);
    await expect.poll(async () => placed(await placement(page, "gallery"))).toBe(true);
  });

  test("only the overview's gallery cards link the project pages (Stage 1F): one link per showcased project, none anywhere else", async ({ page }) => {
    test.setTimeout(120_000);
    const pages = ["", "/about", "/services", "/services/laser-cutting", "/services/cnc-bending", "/services/steel-structures", "/services/fabrication", "/services/laser-engraving", "/services/scaffolding", "/capabilities", "/projects", "/industries", "/clients", "/certificates", "/contact", "/privacy", "/terms", "/no-such-page"];
    for (const locale of LOCALES) {
      for (const path of pages) {
        await page.goto(`/${locale}${path}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body.mc"), path).toHaveCount(1);
        const links = await page
          .locator("a[href]")
          .evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href") ?? "", card: !!a.closest("#gallery li[data-project]") && a.matches(".pj-card-go") })));
        const projectLinks = links.filter((l) => /\/projects\/[^/#?]/.test(l.href));
        if (path === "/projects") {
          expect(projectLinks.map((l) => l.href), `${locale}${path}`).toEqual(SLUGS.map((s) => `/${locale}/projects/${s}`));
          expect(projectLinks.every((l) => l.card), `${locale}${path}`).toBe(true);
        } else expect(projectLinks, `${locale}${path}`).toEqual([]);
      }
    }
  });

  test("project pages are built (Stage 1F): a known slug its own page in this design, an unknown one this design's 404", async ({ page }) => {
    for (const [path, title] of [
      ["/en/projects/geometric-lanterns", "Geometric Lanterns"],
      ["/ar/projects/clock-tower-landmark", "برج الساعة"],
    ] as const) {
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("body.mc"), path).toHaveCount(1);
      await expect(page.locator("h1"), path).toHaveText(title);
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", "noindex, follow");
      await expect(page.locator("main"), path).not.toContainText(/In development|قيد التطوير/);
      // Back to this page from the trail.
      await expect(page.locator(`.ip-crumbs a[href="/${path.split("/")[1]}/projects"]`), path).toHaveCount(1);
    }
    const response = await page.goto("/en/projects/not-a-project", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
    await expect(page.locator("body.mc")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Outside the blueprint");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Category toggles and the bar
// ---------------------------------------------------------------------------------------------------------------------

test.describe("category toggles", () => {
  test("one choice for the hero and the bar: only matching projects shown, the rest hidden, the choice announced", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const bar = page.getByRole("group", { name: projectsPage.gallery.filterLabel.en });
    await expect(page.locator(SHOWN)).toHaveCount(27);
    await expect(page.locator("#gallery p[aria-live=polite]")).toHaveText("Showing: All");
    await page.locator("#gallery").scrollIntoViewIfNeeded();
    const chip = bar.getByRole("button", { name: "Shade & Canopies" });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(bar.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    // The hero's quick toggles show the same choice.
    expect(await pressed(page, QUICK)).toEqual(["Shade & Canopies"]);
    const shown = await page.locator(SHOWN).evaluateAll((lis) => lis.map((li) => li.getAttribute("data-categories") ?? ""));
    expect(shown.length).toBe(SHOWCASED.filter((p) => p.categories.includes("shade")).length);
    expect(shown.every((c) => c.split(" ").includes("shade"))).toBe(true);
    // Left out = hidden, so out of the accessibility tree too.
    expect(await page.locator(`${ITEMS}[hidden]`).count()).toBe(27 - shown.length);
    await expect(page.locator("#gallery p[aria-live=polite]")).toHaveText("Showing: Shade & Canopies");
    // Shown cards are visible at once (no reveal on them).
    await page.locator(SHOWN).first().scrollIntoViewIfNeeded();
    expect(await page.locator(SHOWN).first().evaluate((li) => getComputedStyle(li).opacity)).toBe("1");
    await bar.getByRole("button", { name: "All" }).click();
    await expect(page.locator(SHOWN)).toHaveCount(27);
  });

  test("the hero's quick toggles set the gallery's choice and move to the gallery (Arabic)", async ({ page }) => {
    await page.goto("/ar/projects", { waitUntil: "networkidle" });
    const hero = page.getByRole("group", { name: projectsPage.hero.quickFilter.ar });
    await hero.getByRole("button", { name: category("laser-cutting", "ar") }).click();
    const galleryChip = page.getByRole("group", { name: projectsPage.gallery.filterLabel.ar }).getByRole("button", { name: category("laser-cutting", "ar") });
    await expect(galleryChip).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => placed(await placement(page, "gallery"))).toBe(true);
  });

  test("from the keyboard: Enter and Space toggle, focus stays on the toggle", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const bar = page.getByRole("group", { name: projectsPage.gallery.filterLabel.en });
    const chip = bar.getByRole("button", { name: "Decorative Metal" });
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(chip).toBeFocused();
    // The toggle before it (Public Realm), from the keyboard.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(bar.getByRole("button", { name: "Public Realm" })).toBeFocused();
    await expect(bar.getByRole("button", { name: "Public Realm" })).toHaveAttribute("aria-pressed", "true");
  });

  test("a choice made with the bar pinned starts the wall again just under the bar; focus stays on the toggle", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    await page.locator("#heritage-cannon-replicas").scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy({ top: 600, behavior: "instant" }));
    const chip = page.locator(BAR).getByRole("button", { name: "Custom Work" });
    await chip.click();
    await expect(chip).toBeFocused();
    const box = await page.evaluate(() => ({
      list: document.querySelector(".pj-list")!.getBoundingClientRect().top,
      bar: document.querySelector(".pj-bar")!.getBoundingClientRect().bottom,
    }));
    expect(box.list - box.bar).toBeGreaterThanOrEqual(8);
    expect(box.list - box.bar).toBeLessThanOrEqual(24);
  });

  for (const [width, scrolls] of [
    [1920, false],
    [1440, false],
    [1280, true],
    [1024, true],
    [834, true],
    [390, true],
    [360, true],
    [320, true],
  ] as const) {
    test(`the bar at ${width} px: one row of fixed height under the header${scrolls ? ", scrolled sideways, never wrapped" : ""}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en/projects", { waitUntil: "networkidle" });
      const row = page.locator(BAR);
      const info = await row.evaluate((el) => {
        const tops = new Set([...el.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().top)));
        const bar = el.closest(".pj-bar")!;
        return {
          rows: tops.size,
          wrap: getComputedStyle(el).flexWrap,
          overflow: getComputedStyle(el).overflowX,
          scrolls: el.scrollWidth > el.clientWidth + 1,
          height: bar.getBoundingClientRect().height,
          blur: getComputedStyle(bar).backdropFilter,
          background: getComputedStyle(bar).backgroundColor,
        };
      });
      expect(info).toMatchObject({ rows: 1, wrap: "nowrap", overflow: "auto", scrolls, height: 56, blur: "none" });
      // Opaque: nothing scrolls visibly under it.
      expect(info.background).toMatch(/^rgb\(/);
      expect(await horizontalOverflow(page)).toBe(0);
      // Pinned under the header while the wall scrolls.
      await page.locator("#tiered-chandelier").scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollBy({ top: 300, behavior: "instant" }));
      const pinned = await page.evaluate(() => ({
        bar: document.querySelector(".pj-bar")!.getBoundingClientRect().top,
        header: document.querySelector(".a2-header")!.getBoundingClientRect().bottom,
      }));
      expect(Math.abs(pinned.bar - pinned.header)).toBeLessThanOrEqual(1.5);
      if (scrolls) {
        await row.evaluate((el) => el.scrollBy({ left: 400, behavior: "instant" }));
        expect(await row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
        expect(await horizontalOverflow(page)).toBe(0);
      }
    });
  }

  test("Arabic: the bar starts from the right and scrolls towards the left; slugs stay Latin in the address", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/projects", { waitUntil: "networkidle" });
    const row = page.locator(BAR);
    const geometry = await row.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const first = el.querySelector("button")!.getBoundingClientRect();
      return { rowRight: r.right, firstRight: first.right, start: el.scrollLeft };
    });
    expect(geometry.start).toBe(0);
    expect(geometry.rowRight - geometry.firstRight).toBeLessThan(12);
    await row.evaluate((el) => el.scrollBy({ left: -400, behavior: "instant" }));
    expect(await row.evaluate((el) => el.scrollLeft)).toBeLessThan(0);
    expect(await horizontalOverflow(page)).toBe(0);
    await page.locator('.pj-index a[href="#geometric-lanterns"]').click();
    await expect.poll(() => page.evaluate(() => location.href)).toMatch(/\/ar\/projects#geometric-lanterns$/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The wall: columns, cards, photos
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the wall", () => {
  for (const [width, columns] of [
    [1440, 4],
    [1024, 3],
    [834, 2],
    [390, 1],
  ] as const) {
    test(`${columns} column${columns > 1 ? "s" : ""} at ${width} px, in content order, nothing spilling over`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en/projects", { waitUntil: "networkidle" });
      expect(Number(await page.locator(".pj-list").evaluate((ul) => getComputedStyle(ul).columnCount))).toBe(columns);
      expect(await horizontalOverflow(page)).toBe(0);
      // No card is cut across two columns, and every card stays inside the wall.
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll("li[data-project]")]
          .filter((li) => li.getClientRects().length > 1 || li.getBoundingClientRect().right > document.querySelector(".pj-list")!.getBoundingClientRect().right + 1)
          .map((li) => li.id),
      );
      expect(cut).toEqual([]);
    });
  }

  test("Arabic: the wall fills from the right", async ({ page }) => {
    await page.goto("/ar/projects", { waitUntil: "networkidle" });
    const box = await page.evaluate(() => ({
      list: document.querySelector(".pj-list")!.getBoundingClientRect().right,
      first: document.querySelector("li[data-project]")!.getBoundingClientRect().right,
    }));
    expect(Math.abs(box.list - box.first)).toBeLessThanOrEqual(1);
  });

  test("a gallery card is not a link: since Stage 1F it holds one, its \"View project\" link, the only tab stop in it", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    expect(await page.locator(`${ITEMS} [tabindex], ${ITEMS} button`).count()).toBe(0);
    expect(await page.locator(`${ITEMS} a`).count()).toBe(SLUGS.length);
    const stops: string[] = [];
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press("Tab");
      stops.push(await page.evaluate(() => document.activeElement?.getAttribute("href") ?? document.activeElement?.tagName ?? ""));
    }
    // The featured project, the four highlights, the bar's nine toggles, each card's one link in the wall's order, then
    // the index.
    const featured = stops.indexOf(`#${projectsPage.featured.slug}`);
    expect(featured).toBeGreaterThan(0);
    expect(stops.slice(featured, featured + 5)).toEqual([projectsPage.featured.slug, ...HIGHLIGHTS].map((s) => `#${s}`));
    expect(stops.slice(featured + 5, featured + 14)).toEqual(Array(9).fill("BUTTON"));
    expect(stops.slice(featured + 14, featured + 14 + SLUGS.length)).toEqual(SLUGS.map((s) => `/en/projects/${s}`));
    expect(stops.slice(featured + 14 + SLUGS.length, featured + 17 + SLUGS.length)).toEqual(INDEXED.slice(0, 3).map((s) => `#${s}`));
  });

  test("each card's link: \"View project\" in its language, naming the project for assistive technology, to the project's own page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects`, { waitUntil: "networkidle" });
      const links = await page.locator(`${ITEMS} a`).evaluateAll((as) =>
        as.map((a) => ({
          card: a.closest("li[data-project]")!.id,
          href: a.getAttribute("href"),
          visible: [...a.childNodes].filter((n) => n.nodeType === 3 || !(n as Element).matches(".sr-only, svg")).map((n) => n.textContent).join("").trim(),
          name: a.textContent!.replace(/\s+/g, " ").trim(),
        })),
      );
      expect(links.map((l) => l.card)).toEqual(SLUGS);
      for (const [i, link] of links.entries()) {
        const project = SHOWCASED[i];
        expect(link.href).toBe(`/${locale}/projects/${project.slug}`);
        expect(link.visible).toBe(projectsPage.view[locale]);
        expect(link.name).toBe(`${projectsPage.view[locale]}: ${project.title[locale]}`);
      }
    }
    // Followed: the project's page, in the same language.
    await page.locator(`${ITEMS}#clock-tower-landmark a`).click();
    await page.waitForURL("**/ar/projects/clock-tower-landmark");
    await expect(page.locator("h1")).toHaveText("برج الساعة");
  });

  for (const width of [1440, 1024, 390]) {
    test(`every photo at most at its source size at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en/projects", { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        for (const img of document.images) img.loading = "eager";
        await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      });
      const shown = await page.locator("main img").evaluateAll((imgs) =>
        imgs.map((img) => ({ src: img.getAttribute("src") ?? "", w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height })),
      );
      expect(shown.length).toBeGreaterThan(30);
      let worst = 0;
      for (const { src, w, h } of shown) {
        const source = SOURCE.get(mediaPath(src));
        expect(source, src).toBeDefined();
        worst = Math.max(worst, w / source![0], h / source![1]);
        expect(w, src).toBeLessThanOrEqual(source![0] + 0.5);
        expect(h, src).toBeLessThanOrEqual(source![1] + 0.5);
      }
      test.info().annotations.push({ type: "worst scale", description: `${width}px: ${worst.toFixed(3)}` });
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Motion, focus, reduced motion and no JavaScript
// ---------------------------------------------------------------------------------------------------------------------

test.describe("motion and focus", () => {
  test("keyboard focus gives a highlight card the same raised state as hover", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const card = page.locator(".pj-highlights a").first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const state = () => card.evaluate((el) => ({ translate: getComputedStyle(el).translate, shadow: getComputedStyle(el).boxShadow }));
    const rest = await state();
    // The raised state is read once the card's own transitions have finished (a 320 ms ease).
    const settled = () => card.evaluate((el) => el.getAnimations().length === 0);
    await card.hover();
    await expect.poll(state).not.toEqual(rest);
    await expect.poll(settled).toBe(true);
    const hovered = await state();
    await page.mouse.move(0, 0);
    await expect.poll(state).toEqual(rest);
    await card.focus();
    await expect.poll(state).toEqual(hovered);
    expect(await card.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  });

  test("the site-wide ambient rests while the page scrolls and runs again after", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    await expect.poll(async () => (await ambientAnimations(page)).map((a) => a.state)).toEqual(Array(4).fill("running"));
    const states = await page.evaluate(
      (sel) =>
        new Promise<string[][]>((resolve) => {
          const out: string[][] = [];
          addEventListener(
            "scroll",
            async () => {
              for (let i = 0; i < 6; i++) {
                scrollBy(0, 60);
                await new Promise((r) => setTimeout(r, 40));
                if (document.documentElement.hasAttribute("data-scrolling")) out.push(document.querySelector(sel)!.getAnimations({ subtree: true }).map((a) => a.playState));
              }
              resolve(out);
            },
            { once: true },
          );
          scrollBy(0, 300);
        }),
      AMBIENT,
    );
    expect(states.length).toBeGreaterThan(2);
    for (const s of states) expect(s).toEqual(Array(4).fill("paused"));
    await expect.poll(async () => (await ambientAnimations(page)).map((a) => a.state)).toEqual(Array(4).fill("running"));
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("choosing works at once: no animated re-flow, no reveal, no lift; the ambient holds still", async ({ page }) => {
      await page.goto("/en/projects", { waitUntil: "networkidle" });
      await page.evaluate(() => {
        (window as unknown as { vt: boolean }).vt = false;
        new MutationObserver(() => {
          if (document.documentElement.hasAttribute("data-vt")) (window as unknown as { vt: boolean }).vt = true;
        }).observe(document.documentElement, { attributes: true });
      });
      await page.locator("#gallery").scrollIntoViewIfNeeded();
      const bar = page.locator(BAR);
      await bar.getByRole("button", { name: "Structures", exact: true }).click();
      await expect(bar.getByRole("button", { name: "Structures", exact: true })).toHaveAttribute("aria-pressed", "true");
      expect(await page.evaluate(() => (window as unknown as { vt: boolean }).vt)).toBe(false);
      expect(await page.locator(SHOWN).count()).toBe(SHOWCASED.filter((p) => p.categories.includes("structures")).length);
      expect(await page.locator(SHOWN).first().evaluate((li) => getComputedStyle(li).opacity)).toBe("1");
      expect(await bar.locator("button").first().evaluate((b) => getComputedStyle(b).transitionDuration)).toMatch(/^0s/);
      await expect.poll(() => hiddenReveals(page)).toBe(0);
      const card = page.locator(".pj-highlights a").first();
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.waitForTimeout(400);
      expect(await card.evaluate((el) => getComputedStyle(el).translate)).toBe("none");
      expect((await ambientAnimations(page)).filter((a) => a.state === "running")).toEqual([]);
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("every project shows, the toggles are not drawn, and every anchor still lands", async ({ page }) => {
      await page.goto("/en/projects", { waitUntil: "load" });
      await expect(page.locator(ITEMS)).toHaveCount(27);
      expect(await page.locator(`${ITEMS}[hidden]`).count()).toBe(0);
      await expect(page.locator(".pj-bar")).toBeHidden();
      await expect(page.locator(".pj-quick")).toBeHidden();
      const transparent = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => getComputedStyle(el).opacity === "0").length);
      expect(transparent).toBe(0);
      // The index jumps (the browser's own), below the header: no bar without script.
      await page.locator('.pj-index a[href="#laser-cut-components"]').click();
      await expect.poll(async () => {
        const { top, header } = await landing(page, "laser-cut-components");
        return top >= header && top - header <= 24;
      }).toBe(true);
      // An address with a project's #slug, and #gallery (the fonts are in the cache by now).
      for (const id of ["globe-and-ring-sculptures", "gallery"]) {
        await page.goto("about:blank");
        await page.goto(`/en/projects#${id}`, { waitUntil: "load" });
        await expect.poll(async () => placed(await placement(page, id)), { message: id }).toBe(true);
      }
    });
  });
});
