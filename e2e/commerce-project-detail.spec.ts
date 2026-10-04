import { expect, test, type Page, type Request } from "@playwright/test";
import { projectDetailView } from "../src/components/commerce/project-detail/data";
import { mediaRegistry } from "../src/content/media.generated";
import { routeLabels } from "../src/content/navigation";
import { projectDetailPage, projectsPage } from "../src/content/pages";
import { isShowcased, projectCategories, projectDetailMedia, projectImages, projects, withheldMedia } from "../src/content/projects";
import { services } from "../src/content/services";
import type { MediaId, Project, ProjectFlag } from "../src/content/types";
import { getDictionary } from "../src/i18n/dictionaries";
import { pageStatus } from "../src/lib/page-meta";
import { HTML_LANG, hiddenReveals, horizontalOverflow, jsonLd, LOCALES, trackErrors, type TestLocale } from "./helpers";

/**
 * Stage 1F: the project pages (src/app/(commerce)/[locale]/projects/[slug]/, components in
 * src/components/commerce/project-detail/): one page per record of src/content/projects.ts, in both languages, built
 * from the record only. Replaces commerce-planned.spec.ts (the in-development pages of Stage TM-2.6), assertion by
 * assertion: the addresses, titles, descriptions, trails and search metadata (now `review`: noindex, follow), the
 * header's Projects mark, the language switch keeping the project, the phone sheet, reduced motion, no-JS, the hidden
 * decoration and the unknown project's 404. Added: the photos each page may show (`projectDetailMedia`: none for a
 * project awaiting authorship or product-ownership confirmation, never a withheld file, the lead photo never repeated),
 * checked file by file in the served page, its page data and the browser's requests; the record's classifications,
 * related services and gallery reference, exactly; no internal note, flag or unconfirmed detail anywhere; photos never
 * above their source size; Arabic, right to left; themes; forced colours; twelve sizes.
 *
 * Expectations are derived here from the content layer (projects, categories, services, media registry, labels), not
 * from the page's own view code, except where that code itself is under test (its optional-detail rules).
 */

const SITE = { en: "RAWASY", ar: "رواسي" } as const;
const NOT_FOUND = { en: "Outside the blueprint", ar: "خارج المخطط" } as const;
const TITLE_404 = { en: "Page not found | RAWASY", ar: "الصفحة غير موجودة | رواسي" } as const;
const BREADCRUMB = { en: "Breadcrumb", ar: "مسار التنقل" } as const;
const other = (locale: TestLocale) => (locale === "en" ? "ar" : "en");

/** The flags that hold every photo of a project back (the helper also holds back any flag it does not know). */
const HOLD_ALL: ProjectFlag[] = ["confirm-authorship", "render"];
const holdsAll = (p: Project) => !!p.flags?.some((f) => HOLD_ALL.includes(f));
const srcOf = (id: MediaId) => mediaRegistry[id].src;

/** What a project's page should show, from the content layer alone. */
function expected(project: Project, locale: TestLocale) {
  const photos = holdsAll(project) ? [] : project.media.filter((id) => !withheldMedia.includes(id));
  const title = project.title[locale];
  const pageRef = /^p\.\s*\d/i.test(project.galleryRef);
  return {
    title,
    summary: project.summary[locale],
    categories: project.categories.map((slug) => projectCategories.find((c) => c.slug === slug)!.label[locale]),
    services: project.services.map((slug) => ({ name: services.find((s) => s.slug === slug)!.name[locale], href: `/${locale}/services/${slug}` })),
    source: `${projectDetailPage.source[locale]} · ${pageRef ? "" : `${projectsPage.refLabel[locale]} `}${project.galleryRef}`,
    photos: photos.map(srcOf),
    alts: photos.map((_, i) =>
      photos.length === 1
        ? title
        : projectDetailPage.photoAlt[locale].replace("{title}", title).replace("{n}", String(i + 1)).replace("{total}", String(photos.length)),
    ),
    /** Files of this project that must never reach its page (withheld, or every file of a project held back). */
    forbidden: [...new Set([...project.media.filter((id) => holdsAll(project) || withheldMedia.includes(id)), ...withheldMedia])].filter(
      (id) => !photos.includes(id),
    ),
  };
}

/** Media files a served page or its page data refers to (plain or URL-encoded, e.g. inside /_next/image?url=…). */
function mediaPaths(text: string) {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:\/|%2F)media(?:\/|%2F)([a-z0-9-]+)(?:\/|%2F)([a-z0-9_.-]+?\.(?:webp|png|jpe?g|avif))/gi)) out.add(`/media/${m[1]}/${m[2]}`);
  return out;
}

/** The source file of an <img> (next/image serves it through /_next/image?url=…). */
const fileOf = (src: string) => decodeURIComponent(src.replace(/.*[?&]url=([^&]+).*/, "$1"));

/** A request for a media file or through the image optimizer (fonts under /_next/static/media are neither). */
const isImageRequest = (r: Request) => /^\/(media\/|_next\/image)/.test(new URL(r.url()).pathname);

/** Every detail label a record may one day fill, in both languages, and words that would stand in for a missing one. */
const DETAIL_LABELS = Object.entries(projectDetailPage.details)
  .filter(([key]) => key !== "title")
  .flatMap(([, label]) => [label.en, label.ar]);
const EXTRA_FACT_WORDS = ["Value", "Duration", "القيمة", "المدة"];
const PLACEHOLDERS = ["—", "-", "N/A", "n/a", "TBC", "TBD", "Not stated", "Confidential", "Unknown", "غير محدد", "سري"];

const TEXT_ONLY = projects.filter((p) => projectDetailMedia(p).length === 0);
const SINGLE = projects.filter((p) => projectDetailMedia(p).length === 1);
const MEDIA_RICH = projects.filter((p) => projectDetailMedia(p).length > 1);

// ---------------------------------------------------------------------------------------------------------------------
// The content layer
// ---------------------------------------------------------------------------------------------------------------------

test.describe("records and the photo rule", () => {
  test("34 records, unique slugs, every one kept: 27 in the gallery, 7 held back; 17 pages with several photos, 10 with one, 7 text pages", () => {
    expect(projects).toHaveLength(34);
    expect(new Set(projects.map((p) => p.slug)).size).toBe(34);
    expect(projects.filter(isShowcased)).toHaveLength(27);
    expect([MEDIA_RICH.length, SINGLE.length, TEXT_ONLY.length]).toEqual([17, 10, 7]);
    // The text pages are exactly the projects the gallery holds back.
    expect(TEXT_ONLY.map((p) => p.slug).sort()).toEqual(projects.filter((p) => !isShowcased(p)).map((p) => p.slug).sort());
    expect(pageStatus.project).toBe("review");
    expect(pageStatus.projects).toBe("review");
    expect(Object.entries(pageStatus).filter(([, s]) => s === "published").map(([k]) => k)).toEqual(["home"]);
  });

  test("the watermarked files are withheld, and a page shows its photos by flag: none when authorship or ownership is open, never a withheld file", () => {
    expect(withheldMedia).toEqual(expect.arrayContaining(["projects/wheat-monument-1", "projects/stainless-landmark-1", "projects/billboard-structure-1"]));
    for (const p of projects) {
      const shown = projectDetailMedia(p);
      if (holdsAll(p)) expect(shown, p.slug).toEqual([]);
      else expect(shown, p.slug).toEqual(projectImages(p));
      for (const id of shown) expect(withheldMedia, `${p.slug} ${id}`).not.toContain(id);
    }
    // The rule reads flags, never titles: the same files under each flag, and a flag added later holds every photo back.
    const record: Project = {
      slug: "future-record",
      galleryRef: "99",
      title: { en: "Future", ar: "مستقبلي" },
      summary: { en: "", ar: "" },
      categories: ["custom"],
      services: ["fabrication"],
      media: ["projects/tulip-roundabout-1", "projects/wheat-monument-1", "projects/clock-tower-2"],
    };
    expect(projectDetailMedia(record)).toEqual(["projects/tulip-roundabout-1", "projects/clock-tower-2"]);
    expect(projectDetailMedia({ ...record, flags: ["ai-watermark"] })).toEqual(["projects/tulip-roundabout-1", "projects/clock-tower-2"]);
    expect(projectDetailMedia({ ...record, flags: ["render"] })).toEqual([]);
    expect(projectDetailMedia({ ...record, flags: ["confirm-authorship"] })).toEqual([]);
    expect(projectDetailMedia({ ...record, flags: ["ai-watermark", "render"] })).toEqual([]);
    expect(projectDetailMedia({ ...record, flags: ["held-for-review" as ProjectFlag] })).toEqual([]);
  });

  test("optional details: a row or passage only for a field the record holds (empty counts as none), nothing invented for the others", () => {
    const record: Project = {
      slug: "future-record",
      galleryRef: "p.3",
      title: { en: "Future", ar: "مستقبلي" },
      summary: { en: "Summary.", ar: "ملخص." },
      categories: ["structures", "custom"],
      services: ["steel-structures", "fabrication"],
      media: [],
    };
    const view = (p: Project, locale: TestLocale = "en") => projectDetailView({ project: p, page: projectDetailPage, refLabel: projectsPage.refLabel }, locale);
    // A record as every record is today: no details, a page reference without "Ref.", no photos.
    const bare = view(record);
    expect([bare.rows, bare.passages, bare.photos, bare.refLabel, bare.ref]).toEqual([[], [], [], null, "p.3"]);
    // Each field shows once it is filled, with its own label; empty values stay hidden.
    const filled = view({
      ...record,
      client: { en: "A client", ar: "عميل" },
      year: 2024,
      materials: { en: ["Steel", " ", "Brass"], ar: ["حديد", "نحاس"] },
      scope: { en: " ", ar: "" },
      challenge: { en: "A challenge.", ar: "تحدٍ." },
    });
    expect(filled.rows).toEqual([
      { key: "client", label: "Client", value: "A client" },
      { key: "year", label: "Year", value: "2024" },
      { key: "materials", label: "Materials", value: "Steel, Brass" },
    ]);
    expect(filled.passages).toEqual([{ key: "challenge", label: "Challenge", value: "A challenge." }]);
    expect(view({ ...record, materials: { en: ["Steel"], ar: ["حديد", "نحاس"] } }, "ar").rows).toEqual([{ key: "materials", label: "الخامات", value: "حديد، نحاس" }]);
    // No record holds a detail yet, so no page has the part.
    for (const p of projects) for (const locale of LOCALES) expect([view(p, locale).rows, view(p, locale).passages], p.slug).toEqual([[], []]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Every page, as served
// ---------------------------------------------------------------------------------------------------------------------

test.describe("every project page, as served", () => {
  test("68 pages (34 records × 2 languages) answer 200: title, description, canonical, languages, noindex, follow; WebPage and BreadcrumbList only", async ({ request }) => {
    test.setTimeout(180_000);
    let count = 0;
    for (const locale of LOCALES) {
      const dict = getDictionary(locale);
      for (const project of projects) {
        const path = `/${locale}/projects/${project.slug}`;
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), path).toBe(200);
        count++;
        const html = await response.text();
        const want = expected(project, locale);
        const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        expect(html, path).toContain(`<title>${escapeHtml(`${want.title} | ${SITE[locale]}`)}</title>`);
        expect(html, path).toContain(`<meta name="description" content="${escapeHtml(want.summary)}"/>`);
        expect(html, path).toContain(`<meta name="robots" content="noindex, follow"/>`);
        expect(html, path).toContain(`<link rel="canonical" href="https://www.rawasymetal.com${path}"/>`);
        for (const [lang, loc] of [["en", "en"], ["ar", "ar"], ["x-default", "en"]] as const)
          expect(html, `${path} ${lang}`).toContain(`<link rel="alternate" hrefLang="${lang}" href="https://www.rawasymetal.com/${loc}/projects/${project.slug}"/>`);
        // Structured data: the page and its trail, nothing about the project beyond its name and summary.
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
        expect(blocks.map((b) => b["@type"]), path).toEqual(["WebPage", "BreadcrumbList"]);
        expect(blocks[0], path).toMatchObject({ name: want.title, description: want.summary, url: `https://www.rawasymetal.com${path}` });
        expect(Object.keys(blocks[0]).sort(), path).toEqual(["@context", "@id", "@type", "about", "description", "inLanguage", "isPartOf", "name", "url"]);
        expect(blocks[1].itemListElement.map((i: { name: string }) => i.name), path).toEqual([dict.common.home, routeLabels.projects[locale], want.title]);
        expect(blocks[1].itemListElement[2].item, path).toBe(`https://www.rawasymetal.com${path}`);
        expect(JSON.stringify(blocks), path).not.toMatch(/client|dateCreated|datePublished|location|material|award|image/i);
      }
    }
    expect(count).toBe(68);
  });

  test("source safety: each page and its page data refer to exactly its allowed photos — no withheld, held-back or other project's file", async ({ request }) => {
    test.setTimeout(180_000);
    for (const locale of LOCALES) {
      for (const project of projects) {
        const path = `/${locale}/projects/${project.slug}`;
        const want = expected(project, locale);
        const html = await (await request.get(path)).text();
        const data = await (await request.get(path, { headers: { RSC: "1" } })).text();
        for (const [what, text] of [["page", html], ["page data", data]] as const) {
          // Every media file referred to is one of the project's own allowed photos, and every allowed photo is there.
          expect([...mediaPaths(text)].sort(), `${path} ${what}`).toEqual([...want.photos].sort());
          for (const id of want.forbidden) {
            expect(text, `${path} ${what} ${id}`).not.toContain(srcOf(id));
            expect(text, `${path} ${what} ${id}`).not.toContain(encodeURIComponent(srcOf(id)));
            expect(text, `${path} ${what} ${id}`).not.toContain(`"${id}"`);
          }
          // The internal note and the review flags never leave the content layer.
          if (project.note) expect(text, `${path} ${what}`).not.toContain(project.note);
          expect(text, `${path} ${what}`).not.toMatch(/ai-watermark|confirm-authorship|"flags"|"note"|watermark|Badr|بدر/i);
        }
        if (want.photos.length === 0) {
          expect(html, path).not.toMatch(/<img\b|<picture\b|imageSrcSet|\/_next\/image|rel="preload" as="image"/);
        }
      }
    }
  });

  test("not in the sitemap: the sitemap lists the homepage only", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/projects");
    expect([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual(["https://www.rawasymetal.com/en", "https://www.rawasymetal.com/ar"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Every page, in the browser
// ---------------------------------------------------------------------------------------------------------------------

/** The parts of a project page, read in the browser. */
function parts(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const facts = [...main.querySelectorAll(".ip-hero .ip-meta > div")].map((d) => ({ label: text(d.querySelector("dt")), dd: d.querySelector("dd")! }));
    const classification = facts[0]?.dd ? [...facts[0].dd.querySelectorAll("li")].map(text) : [];
    const services = facts[1]?.dd ? [...facts[1].dd.querySelectorAll("a")].map((a) => ({ name: text(a), href: a.getAttribute("href") })) : [];
    const img = (el: HTMLImageElement) => ({ src: el.getAttribute("src") ?? "", alt: el.getAttribute("alt") });
    return {
      h1: [...main.querySelectorAll("h1")].map(text),
      lead: text(main.querySelector(".ip-hero .t-lead")),
      eyebrow: text(main.querySelector(".ip-hero .eyebrow")),
      crumbsLabel: main.querySelector("nav.ip-crumbs")?.getAttribute("aria-label") ?? null,
      crumbs: [...main.querySelectorAll(".ip-crumbs li")].map((li) => ({ text: text(li), href: li.querySelector("a")?.getAttribute("href") ?? null })),
      factLabels: facts.map((f) => f.label),
      classification,
      services,
      source: main.querySelector(".pd-plate")
        ? `${text(main.querySelector(".pd-plate-source"))} · ${text(main.querySelector(".pd-plate-ref"))}`
        : text(main.querySelector(".pd-lead figcaption")),
      sourceRef: text(main.querySelector(".pd-source [dir=ltr], .pd-plate [dir=ltr]")),
      plate: !!main.querySelector(".pd-plate"),
      lead_: [...main.querySelectorAll(".pd-lead img")].map((el) => img(el as HTMLImageElement)),
      gallery: [...main.querySelectorAll(".pd-gallery img")].map((el) => img(el as HTMLImageElement)),
      images: main.querySelectorAll("img, picture, video, canvas, iframe").length,
      headings: [...main.querySelectorAll("h2, h3, h4")].map((h) => `${h.tagName.toLowerCase()} ${text(h)}`),
      dts: [...main.querySelectorAll("dt")].map(text),
      dds: [...main.querySelectorAll("dd")].map(text),
      details: main.querySelectorAll("[data-field], #details-title").length,
      notes: main.querySelectorAll("[role=note]").length,
      projectLinks: [...main.querySelectorAll("a[href*='/projects/']")].map((a) => a.getAttribute("href")),
      actions: [...main.querySelectorAll(".ip-hero .btn")].map((a) => a.getAttribute("href")),
      cta: [...main.querySelectorAll(".ip-cta-link")].map((a) => a.getAttribute("href")),
      text: text(main),
    };
  });
}

test.describe("every project page, in the browser", () => {
  test("both languages: the record's title, summary, classifications, related services, reference and photos — and nothing it does not hold", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    for (const locale of LOCALES) {
      const dict = getDictionary(locale);
      for (const project of projects) {
        const path = `/${locale}/projects/${project.slug}`;
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const want = expected(project, locale);
        const got = await parts(page);
        expect(got.h1, path).toEqual([want.title]);
        expect(got.lead, path).toBe(want.summary);
        expect(got.eyebrow, path).toBe(projectDetailPage.eyebrow[locale]);
        expect(got.crumbsLabel, path).toBe(BREADCRUMB[locale]);
        expect(got.crumbs, path).toEqual([
          { text: dict.common.home, href: `/${locale}` },
          { text: routeLabels.projects[locale], href: `/${locale}/projects` },
          { text: want.title, href: null },
        ]);
        // Classifications and related services: the record's own, in its order, with the website's labels.
        expect(got.factLabels, path).toEqual([projectDetailPage.facts.classification[locale], projectDetailPage.facts.services[locale]]);
        expect(got.classification, path).toEqual(want.categories);
        expect(got.services, path).toEqual(want.services);
        // The gallery reference as a source, exactly as the record holds it ("04", "07–08", "p.3"), left to right.
        expect(got.source, path).toBe(want.source);
        expect(got.sourceRef, path).toBe(project.galleryRef);
        expect(got.text, path).not.toMatch(/Project number|Job number|رقم المشروع/);
        // Photos: the first allowed photo leads, the others follow once each; a page without one has the source plate.
        const shown = [...got.lead_, ...got.gallery];
        expect(shown.map((i) => fileOf(i.src)), path).toEqual(want.photos);
        expect(shown.map((i) => i.alt), path).toEqual(want.alts);
        expect(new Set(shown.map((i) => fileOf(i.src))).size, path).toBe(shown.length);
        expect(got.images, path).toBe(want.photos.length);
        expect(got.plate, path).toBe(want.photos.length === 0);
        expect(got.lead_.length, path).toBe(Math.min(1, want.photos.length));
        // Headings: the photographs part only when there is more than one photo, then the closing panel.
        expect(got.headings, path).toEqual([
          ...(want.photos.length > 1 ? [`h2 ${projectDetailPage.photos.title[locale]}`] : []),
          `h2 ${projectDetailPage.cta.title[locale]}`,
        ]);
        // No unconfirmed detail: the facts are the two labels, no detail part, no stand-in value, no extra fact.
        expect(got.dts, path).toEqual(got.factLabels);
        expect(got.details, path).toBe(0);
        for (const dd of got.dds) expect(PLACEHOLDERS, `${path} "${dd}"`).not.toContain(dd);
        for (const word of [...DETAIL_LABELS, ...EXTRA_FACT_WORDS]) {
          expect(got.dts, `${path} ${word}`).not.toContain(word);
          expect(got.headings.map((h) => h.slice(3)), `${path} ${word}`).not.toContain(word);
        }
        expect(got.text, path).not.toMatch(/In development|قيد التطوير|Case stud|دراسة حالة/i);
        expect(got.notes, path).toBe(0);
        // Ways on: the quotation form and the overview, never another project's page (no previous / next).
        expect(got.actions, path).toEqual([`/${locale}/contact#quote`, `/${locale}/projects`]);
        expect(got.cta, path).toEqual([`/${locale}/contact#quote`, `/${locale}/projects`, `/${locale}/services`]);
        expect(got.projectLinks, path).toEqual([]);
        // The language switch keeps the project.
        await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other(locale)]}"]`).first(), path).toHaveAttribute(
          "href",
          `/${other(locale)}/projects/${project.slug}`,
        );
      }
    }
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The projects held back, by flag (never by title)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("flagged projects", () => {
  for (const project of projects.filter((p) => p.flags?.length)) {
    const flags = project.flags!.join(", ");
    test(`${project.slug} (${flags}): only its allowed photos load — no withheld file, request, preload or background image`, async ({ page }) => {
      const requests: string[] = [];
      page.on("request", (r) => void (isImageRequest(r) && requests.push(decodeURIComponent(r.url()))));
      for (const locale of LOCALES) {
        const want = expected(project, locale);
        await page.goto(`/${locale}/projects/${project.slug}`, { waitUntil: "networkidle" });
        await expect(page.locator("h1")).toHaveText(want.title);
        expect(await page.locator("main img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") ?? "")).then((s) => s.map(fileOf))).toEqual(want.photos);
        const extra = await page.evaluate(() => ({
          // Background pictures (an inline data: placeholder of an allowed photo does not count).
          backgrounds: [...document.querySelectorAll("main *")].filter((el) => /url\((?!["']?data:)/.test(getComputedStyle(el).backgroundImage)).length,
          preloads: document.querySelectorAll('link[rel="preload"][as="image"]').length,
        }));
        expect(extra.backgrounds).toBe(0);
        if (want.photos.length === 0) expect(extra.preloads).toBe(0);
        for (const id of want.forbidden) expect(requests.filter((u) => u.includes(srcOf(id)))).toEqual([]);
      }
      // Nothing but the allowed photos was requested; a page with none requested no image at all.
      const allowed = expected(project, "en").photos;
      expect(requests.filter((u) => !allowed.some((src) => u.includes(src)))).toEqual([]);
      if (allowed.length === 0) expect(requests).toEqual([]);
    });
  }

  test("the watermarked finished photo of the wheat monument never shows; its two workshop photos do", async ({ page }) => {
    const wheat = projects.find((p) => p.media.includes("projects/wheat-monument-1"))!;
    expect(wheat.flags).toEqual(["ai-watermark"]);
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/projects/${wheat.slug}`, { waitUntil: "networkidle" });
      const files = (await page.locator("main img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src") ?? ""))).map(fileOf);
      expect(files).toEqual(["/media/projects/wheat-monument-2.webp", "/media/projects/wheat-monument-3.webp"]);
      expect(await page.content()).not.toContain("wheat-monument-1");
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Photos: source size, frames, order
// ---------------------------------------------------------------------------------------------------------------------

/** Each shown photo's scale against its source file and whether it stays inside its frame. */
function photoScale(page: Page) {
  return page.evaluate(async () => {
    for (const img of document.images) img.loading = "eager";
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    return [...document.querySelectorAll("main img")].map((el) => {
      const img = el as HTMLImageElement;
      const b = img.getBoundingClientRect();
      const frame = img.parentElement!.getBoundingClientRect();
      return {
        src: decodeURIComponent((img.getAttribute("src") ?? "").replace(/.*[?&]url=([^&]+).*/, "$1")),
        w: b.width,
        h: b.height,
        inside: b.left >= frame.left - 0.5 && b.right <= frame.right + 0.5 && b.top >= frame.top - 0.5 && b.bottom <= frame.bottom + 0.5,
      };
    });
  });
}

const SOURCE = new Map<string, readonly [number, number]>(Object.values(mediaRegistry).map((m) => [m.src, [m.width, m.height] as const]));

test.describe("photos", () => {
  for (const width of [1440, 390]) {
    test(`every photo of every project page at most at its source size, inside its frame, at ${width} px`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: 900 });
      let worst = 0;
      let count = 0;
      for (const project of [...MEDIA_RICH, ...SINGLE]) {
        const locale: TestLocale = count % 2 ? "ar" : "en";
        await page.goto(`/${locale}/projects/${project.slug}`, { waitUntil: "networkidle" });
        for (const { src, w, h, inside } of await photoScale(page)) {
          const source = SOURCE.get(src)!;
          expect(source, src).toBeDefined();
          expect(w, `${project.slug} ${src}`).toBeLessThanOrEqual(source[0] + 0.5);
          expect(h, `${project.slug} ${src}`).toBeLessThanOrEqual(source[1] + 0.5);
          expect(w, `${project.slug} ${src}`).toBeGreaterThan(0);
          expect(inside, `${project.slug} ${src}`).toBe(true);
          worst = Math.max(worst, w / source[0], h / source[1]);
          count++;
        }
        expect(await horizontalOverflow(page), project.slug).toBe(0);
      }
      expect(count).toBe(MEDIA_RICH.concat(SINGLE).reduce((n, p) => n + projectDetailMedia(p).length, 0));
      test.info().annotations.push({ type: "worst scale", description: `${width}px: ${worst.toFixed(3)} over ${count} photos` });
    });
  }

  test("Arabic: the gallery reads from the right, photos are never mirrored, the reference stays left to right", async ({ page }) => {
    await page.goto("/ar/projects/heritage-cannon-replicas", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // One row at this width, filled from the right: the first photo is the rightmost.
    const shots = await page
      .locator(".pd-gallery .pd-shot")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ right: r.right, top: r.top, bottom: r.bottom })));
    expect(shots.length).toBe(3);
    // The prints are centred on the row, so their tops differ with their heights: one row means their spans overlap.
    expect(Math.max(...shots.map((s) => s.top))).toBeLessThan(Math.min(...shots.map((s) => s.bottom)));
    expect(shots[0].right).toBeGreaterThan(shots[1].right);
    expect(shots[1].right).toBeGreaterThan(shots[2].right);
    const mirrored = await page.evaluate(() =>
      [...document.querySelectorAll("main img")].flatMap((img) => {
        const out: string[] = [];
        for (let el: Element | null = img; el && el !== document.body; el = el.parentElement) {
          const s = getComputedStyle(el);
          if ((s.transform !== "none" && /matrix\(-/.test(s.transform)) || (s.scale !== "none" && s.scale.startsWith("-"))) out.push(el.className);
        }
        return out;
      }),
    );
    expect(mirrored).toEqual([]);
    await expect(page.locator(".pd-source [dir=ltr]")).toHaveText("11");
    // Arabic faces, never letter-spaced; the slug stays Latin in the address.
    expect(await page.locator("h1").evaluate((h) => getComputedStyle(h).fontFamily)).toMatch(/Tajawal/);
    expect(await page.locator(".ip-hero .t-lead").evaluate((p) => getComputedStyle(p).fontFamily)).toMatch(/IBM Plex Sans Arabic/);
    expect(await page.locator(".ip-meta dd").first().evaluate((d) => getComputedStyle(d).letterSpacing)).toMatch(/^(normal|0px)$/);
    expect(page.url()).toMatch(/\/ar\/projects\/heritage-cannon-replicas$/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Shell, language, ways on
// ---------------------------------------------------------------------------------------------------------------------

test.describe("shell and language", () => {
  test("the header marks Projects as the section, the language switch keeps the project, the trail leads back", async ({ page, context }) => {
    const errors = trackErrors(page);
    await page.goto("/en/projects/geometric-lanterns", { waitUntil: "networkidle" });
    await expect(page.locator('.a2-nav a[aria-current="true"]')).toHaveAttribute("href", "/en/projects");
    await expect(page.locator('.a2-nav [aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('footer [aria-current="page"]')).toHaveCount(0);
    await expect(page.locator('.a2-header .a2-lang a[hreflang="ar-SA"]').first()).toHaveAttribute("href", "/ar/projects/geometric-lanterns");
    await page.locator(".a2-header .a2-lang").first().locator('a[hreflang="ar-SA"]').click();
    await page.waitForURL("**/ar/projects/geometric-lanterns");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar-SA");
    expect((await context.cookies()).find((c) => c.name === "NEXT_LOCALE")?.value).toBe("ar");
    // The same record in the other language.
    await expect(page.locator("h1")).toHaveText(projects.find((p) => p.slug === "geometric-lanterns")!.title.ar);
    await page.locator('.ip-crumbs a[href="/ar/projects"]').click();
    await page.waitForURL(/\/ar\/projects$/);
    await expect(page.locator(".a2-nav a[aria-current='page']")).toHaveAttribute("href", "/ar/projects");
    expect(errors).toEqual([]);
  });

  test("the ways on: the quotation form (unchanged, nothing filled in) and back to the overview", async ({ page }) => {
    await page.goto("/en/projects/clock-tower-landmark", { waitUntil: "networkidle" });
    await page.locator(".ip-hero a.btn-primary").click();
    await page.waitForURL("**/en/contact#quote");
    await expect(page.locator("#quote form")).toBeVisible();
    // Nothing carried over from the project: every field of the form is empty.
    const filled = await page.locator("#quote form").evaluate((f) =>
      [...f.querySelectorAll("input, textarea, select")]
        .filter((el) => !["checkbox", "radio", "file", "hidden", "submit"].includes((el as HTMLInputElement).type))
        .filter((el) => (el as HTMLInputElement).value !== "" && (el as HTMLSelectElement).selectedIndex !== 0).length,
    );
    expect(filled).toBe(0);
    await page.goto("/ar/projects/clock-tower-landmark", { waitUntil: "networkidle" });
    await page.locator(".ip-hero a.btn-secondary").click();
    await page.waitForURL(/\/ar\/projects$/);
    await expect(page.locator("#gallery li[data-project]:not([hidden])")).toHaveCount(27);
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the menu sheet marks Projects and its language switch keeps the project; no sideways scroll at 390 or 320 px", async ({ page }) => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        for (const path of ["/en/projects/stainless-landmark-sculpture", "/ar/projects/billboard-support-structure", "/ar/projects/clock-tower-landmark"]) {
          await page.goto(path, { waitUntil: "networkidle" });
          expect(await horizontalOverflow(page), `${path} ${width}`).toBe(0);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/ar/projects/billboard-support-structure", { waitUntil: "networkidle" });
      // The compact language control beside the burger keeps the project too.
      await expect(page.locator('.a2-header a[hreflang="en"]').first()).toHaveAttribute("href", "/en/projects/billboard-support-structure");
      await page.locator("details[data-sheet] > summary").tap();
      const sheet = page.locator(".a2-sheet");
      await expect(sheet.locator('a.a2-sheet-row[aria-current="true"]')).toHaveAttribute("href", "/ar/projects");
      await expect(sheet.locator('.a2-lang a[hreflang="en"]')).toHaveAttribute("href", "/en/projects/billboard-support-structure");
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Sizes, themes, forced colours, reduced motion, no JavaScript
// ---------------------------------------------------------------------------------------------------------------------

/** Representatives: several photos, one photo, the watermark case with workshop photos, the watermark case with none, authorship open, a render. */
const REPRESENTATIVES = [
  "clock-tower-landmark",
  "palm-leaf-shade-canopies",
  "wheat-stalks-monument",
  "stainless-landmark-sculpture",
  "illuminated-lattice-cubes",
  "laser-cut-bench",
] as const;

const SIZES = [
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

/** Sideways scroll, elements outside the screen, text outside its box, a cut title and photos above source size. */
function fit(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => (el as HTMLElement).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) && el.getBoundingClientRect().width > 0;
    const outside = [...document.querySelectorAll("main *")]
      .filter((el) => !el.closest(".sr-only") && visible(el))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.left < -1 || b.right > innerWidth + 1;
      })
      .map((el) => el.className || el.tagName);
    const spills: string[] = [];
    for (const el of document.querySelectorAll("main h1, main .t-lead, main .ip-meta dd, main .ip-meta dt, main .pd-source, main .pd-plate p, main .btn, main h2")) {
      if (!visible(el)) continue;
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) if (r.width > 0 && (r.left < box.left - 0.5 || r.right > box.right + 0.5)) spills.push(`${el.className}: ${r.right - box.right}`);
    }
    const h1 = document.querySelector("main h1") as HTMLElement;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      outside: [...new Set(outside)].slice(0, 5),
      spills: spills.slice(0, 5),
      titleCut: h1.scrollWidth > h1.clientWidth + 1,
    };
  });
}

test.describe("sizes, themes and modes", () => {
  test("twelve sizes, from 1920 × 1080 to 320 × 700, in both languages and themes: nothing overflows, no title is cut, no photo above its source size", async ({ browser }) => {
    test.setTimeout(240_000);
    let i = 0;
    for (const [width, height] of SIZES) {
      for (const slug of [REPRESENTATIVES[i % REPRESENTATIVES.length], REPRESENTATIVES[(i + 3) % REPRESENTATIVES.length]]) {
        const locale: TestLocale = i % 2 ? "ar" : "en";
        const theme = i % 3 ? "light" : "dark";
        i++;
        const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, isMobile: width < 834, hasTouch: width < 1024 });
        const page = await context.newPage();
        const errors = trackErrors(page);
        const where = `${width}×${height} ${locale} ${theme} ${slug}`;
        await page.goto(`/${locale}/projects/${slug}`, { waitUntil: "networkidle" });
        expect(await fit(page), where).toEqual({ overflow: 0, outside: [], spills: [], titleCut: false });
        for (const { src, w, h } of await photoScale(page)) {
          expect(w, `${where} ${src}`).toBeLessThanOrEqual(SOURCE.get(src)![0] + 0.5);
          expect(h, `${where} ${src}`).toBeLessThanOrEqual(SOURCE.get(src)![1] + 0.5);
        }
        expect(errors, where).toEqual([]);
        await context.close();
      }
    }
  });

  test("light and dark: the theme applies to every part, the source plate and the photo stage included", async ({ page, context }) => {
    for (const [theme, background] of [
      ["light", "rgb(244, 244, 241)"],
      ["dark", "rgb(19, 24, 32)"],
    ] as const) {
      await context.addInitScript((t) => localStorage.setItem("rawasy-theme", t), theme);
      for (const slug of ["stainless-landmark-sculpture", "clock-tower-landmark"]) {
        await page.goto(`/en/projects/${slug}`, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(background);
        const surface = await page.locator(".pd-plate, .pd-print").first().evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(surface).toBe(theme === "light" ? "rgb(253, 253, 251)" : "rgb(28, 35, 45)");
      }
    }
  });

  test.describe("forced colours", () => {
    test.use({ contextOptions: { forcedColors: "active" } });

    test("links keep their underline, the source mark and the plate's edge take a system colour, focus stays visible", async ({ page }) => {
      for (const slug of ["clock-tower-landmark", "illuminated-lattice-cubes"]) {
        await page.goto(`/en/projects/${slug}`, { waitUntil: "networkidle" });
        expect(await page.locator(".pd-link").first().evaluate((a) => getComputedStyle(a).textDecorationLine)).toContain("underline");
        const mark = await page.locator(".pd-source, .pd-plate").first().evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
        expect(mark).not.toBe("rgba(0, 0, 0, 0)");
        expect(await page.locator(".pd-stage, .pd-plate").first().evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("solid");
      }
      await page.locator(".pd-link").first().focus();
      expect(await page.locator(".pd-link").first().evaluate((a) => getComputedStyle(a).outlineStyle)).not.toBe("none");
    });
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing in view stays hidden, on every kind of page", async ({ page }) => {
      for (const path of ["/ar/projects/clock-tower-landmark", "/en/projects/geometric-lanterns", "/en/projects/stainless-landmark-sculpture", "/ar/projects/palm-leaf-shade-canopies"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect.poll(() => hiddenReveals(page), { message: path, timeout: 3_000 }).toBe(0);
        // The hero, its photo or plate included, shows at once.
        expect(await page.locator(".ip-hero [data-reveal]").evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length), path).toBe(0);
      }
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("every kind of page is complete from the server, in the light theme", async ({ page }) => {
      for (const slug of REPRESENTATIVES) {
        for (const locale of LOCALES) {
          const path = `/${locale}/projects/${slug}`;
          await page.goto(path, { waitUntil: "load" });
          const want = expected(projects.find((p) => p.slug === slug)!, locale);
          await expect(page.locator("h1"), path).toHaveText(want.title);
          await expect(page.locator(".ip-hero .ip-meta"), path).toBeVisible();
          await expect(page.locator(".ip-cta"), path).toBeVisible();
          expect(await page.locator("main img").count(), path).toBe(want.photos.length);
          const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length);
          expect(hidden, path).toBe(0);
          expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), path).toBe("rgb(244, 244, 241)");
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// An unknown project
// ---------------------------------------------------------------------------------------------------------------------

test.describe("unknown project", () => {
  test("a real 404 with this design's localized page at one and more path segments, noindex, never redirected again", async ({ request }) => {
    for (const [path, locale] of [
      ["/en/projects/not-a-project", "en"],
      ["/ar/projects/not-a-project", "ar"],
      ["/en/projects/not-a-project/extra", "en"],
      ["/ar/projects/a/b/c", "ar"],
    ] as const) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      const html = await response.text();
      expect(html, path).toContain(`<title>${TITLE_404[locale]}</title>`);
      expect(html, path).toMatch(/<meta name="robots" content="noindex"\/>/);
    }
    // Page data: one redirect to the address with its cache key, then a 404 — never a loop.
    const headerSets: Record<string, string>[] = [{ RSC: "1" }, { RSC: "1", "Next-Router-Prefetch": "1" }];
    for (const headers of headerSets) {
      const first = await request.get("/en/projects/not-a-project", { maxRedirects: 0, headers });
      expect(first.status()).toBe(307);
      const next = await request.get(first.headers()["location"], { maxRedirects: 0, headers });
      expect(next.status()).toBe(404);
    }
  });

  for (const locale of LOCALES) {
    test(`/${locale}/projects/not-a-project: the localized 404 in this design, its language switch keeps the address, the theme applies`, async ({ page, context }) => {
      const errors = trackErrors(page);
      await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
      const documents: string[] = [];
      page.on("request", (r) => void (r.resourceType() === "document" && documents.push(r.url())));
      const response = await page.goto(`/${locale}/projects/not-a-project`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(404);
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("h1")).toHaveText(NOT_FOUND[locale]);
      await expect(page).toHaveTitle(TITLE_404[locale]);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      await expect(page.locator("[aria-current='page']")).toHaveCount(0);
      const target = other(locale);
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[target]}"]`).first()).toHaveAttribute("href", `/${target}/projects/not-a-project`);
      await page.waitForTimeout(1000);
      expect(documents).toHaveLength(1);
      expect(errors).toEqual([]);
    });
  }

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("the menu sheet opens and its language switch keeps the unknown address", async ({ page }) => {
      await page.goto("/en/projects/not-a-project", { waitUntil: "networkidle" });
      await page.locator("details[data-sheet] > summary").tap();
      const sheet = page.locator(".a2-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.a2-lang a[hreflang="ar-SA"]')).toHaveAttribute("href", "/ar/projects/not-a-project");
      expect(await horizontalOverflow(page)).toBe(0);
    });
  });
});

test("decoration is hidden from assistive technology on the project pages and the unknown-project 404", async ({ page }) => {
  for (const path of ["/en/projects/geometric-lanterns", "/ar/projects/clock-tower-landmark", "/en/projects/stainless-landmark-sculpture", "/en/projects/not-a-project"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const exposed = await page.evaluate(() =>
      [...document.querySelectorAll(".a2-ambient, .a2-cursor, svg.mc-icon, .ip-404-code")]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .map((el) => el.getAttribute("class")),
    );
    expect(exposed, path).toEqual([]);
    // The separators between classifications and services are not read out.
    const separators = await page.evaluate(() =>
      [...document.querySelectorAll(".pd-inline > li")].map((li) => getComputedStyle(li, "::after").content).filter((c) => c !== "none"),
    );
    for (const content of separators) expect(content, path).toMatch(/\/\s*""$/);
  }
});

test("structured data on the page itself: the trail and the page, read from the rendered document", async ({ page }) => {
  for (const locale of LOCALES) {
    await page.goto(`/${locale}/projects/wheat-stalks-monument`, { waitUntil: "domcontentloaded" });
    const blocks = await jsonLd(page);
    expect(blocks.map((b) => b["@type"])).toEqual(["WebPage", "BreadcrumbList"]);
  }
});
