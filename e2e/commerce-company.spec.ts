import { expect, test, type Page } from "@playwright/test";
import { company } from "../src/content/company";
import { mediaRegistry } from "../src/content/media.generated";
import { HTML_LANG, horizontalOverflow, jsonLd, LOCALES, skipIntro, trackErrors } from "./helpers";

/**
 * Stage TM-2.3: About, Industries and Clients in the Modern Commerce design (src/app/(commerce)/[locale]/{about,
 * industries,clients}, components in src/components/commerce/{about,industries,clients}/; Certificates has its own spec,
 * commerce-certificates.spec.ts). Migrated here: About's fifteen parts and the clients wall's tests of redesign-v2.spec.ts,
 * and the clients and industries tests of stage-1c.spec.ts. Added: the vision blockquote, the machine table, the project
 * cards' interim link to the gallery (decision D4) and the Capabilities placeholder (D5), photos never shown larger than
 * their source, the sectors' sources and services, the preview on hover, by keyboard, in Arabic, with reduced motion and
 * without script, the colour switch, and the pages' fonts. The generic inner-page checks (routes and search metadata,
 * breadcrumbs, sideways scrolling, reduced motion, no JavaScript) still run on these pages from stage-1c.spec.ts.
 */

test.beforeEach(async ({ context }) => {
  await skipIntro(context);
});

/** Source size of every image in the media registry, by its file path. */
const SOURCE = new Map<string, readonly [number, number]>(Object.values(mediaRegistry).map((m) => [m.src, [m.width, m.height] as const]));

/**
 * The largest scale (shown pixels per source pixel) of the photos in <main>, taking object-fit into account; logos and
 * images outside the registry are left out.
 */
async function largestPhotoScale(page: Page) {
  const shown = await page.locator("main img").evaluateAll((imgs) =>
    imgs
      .filter((img) => img.checkVisibility())
      .map((img) => {
        const r = img.getBoundingClientRect();
        const src = decodeURIComponent((img.getAttribute("src") ?? "").replace(/.*url=([^&]+).*/, "$1"));
        return { src, w: r.width, h: r.height, fit: getComputedStyle(img).objectFit };
      }),
  );
  let worst = { scale: 0, src: "" };
  for (const img of shown) {
    const size = SOURCE.get(img.src);
    if (!size || img.src.includes("/clients/")) continue;
    const [w, h] = size;
    const scale = img.fit === "contain" ? Math.min(img.w / w, img.h / h) : Math.max(img.w / w, img.h / h);
    if (scale > worst.scale) worst = { scale, src: img.src };
  }
  return worst;
}

/** Shows every reveal at once (captures and measurements of whole pages). */
const revealAll = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-shown", "")));

// ---------------------------------------------------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------------------------------------------------

const ABOUT_PARTS = ["overview", "what", "metal", "beyond", "vision", "approach", "process", "why", "workshop", "machinery", "work", "clients", "compliance"];

test.describe("about", () => {
  test("a full company profile: fifteen parts in order, each a named region, no invented figures", async ({ page }) => {
    for (const locale of LOCALES) {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      // Hero, thirteen sections in the previous design's order, then the closing call to action.
      const order = await page.locator("main > section[id]").evaluateAll((sections) => sections.map((s) => s.id));
      expect(order).toEqual(ABOUT_PARTS);
      for (const [i, id] of ABOUT_PARTS.entries()) {
        // The parts keep their numbers, 01 to 13.
        await expect(page.locator(`section#${id} .ip-index`).first(), id).toHaveText(String(i + 1).padStart(2, "0"));
        const labelled = await page.locator(`section#${id}`).getAttribute("aria-labelledby");
        await expect(page.locator(`#${labelled}`), id).toHaveCount(1);
        expect(await page.locator(`#${labelled}`).evaluate((el) => el.tagName), id).toBe("H2");
      }
      await expect(page.locator("#page-cta-title")).toHaveCount(1);
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/founded|established in|employees|\d+\+?\s*(projects|years)/i);
      // The registered names, as on the company's registration.
      await expect(page.locator('main [lang="en"]').filter({ hasText: company.legalName.en })).toHaveCount(1);
      await expect(page.locator('main [lang="ar"]').filter({ hasText: company.legalName.ar })).toHaveCount(1);
      // Organization, AboutPage and the breadcrumb trail.
      const types = (await jsonLd(page)).map((d) => d["@type"]);
      expect(types).toEqual(expect.arrayContaining(["AboutPage", "BreadcrumbList"]));
      expect(errors).toEqual([]);
    }
  });

  test("onward links: the six services, Capabilities (placeholder until Stage 1E), projects, clients and certificates", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    for (const route of ["capabilities", "projects", "clients", "certificates", "services", "contact"]) {
      expect(await page.locator(`main a[href="/en/${route}"]`).count(), route).toBeGreaterThan(0);
    }
    for (const slug of ["laser-cutting", "cnc-bending", "steel-structures", "fabrication", "laser-engraving", "scaffolding"]) {
      expect(await page.locator(`main a[href="/en/services/${slug}"]`).count(), slug).toBeGreaterThan(0);
    }
    // Decision D5: Capabilities keeps its placeholder; About links to the page itself.
    await expect(page.locator("#machinery a.btn")).toHaveAttribute("href", "/en/capabilities");
    // The division panels jump to their sections.
    await expect(page.locator('#what a[href="#metal"]')).toHaveCount(1);
    await expect(page.locator('#what a[href="#beyond"]')).toHaveCount(1);
  });

  test("decision D4: the project cards open the Projects gallery and say so; no link to an unfinished project page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/about`, { waitUntil: "networkidle" });
      const cards = page.locator("#work ul a");
      await expect(cards).toHaveCount(4);
      for (const card of await cards.all()) {
        await expect(card).toHaveAttribute("href", `/${locale}/projects#gallery`);
        await expect(card).toContainText(locale === "en" ? "View in the gallery" : "عرض في معرض الأعمال");
      }
      await expect(page.locator(`a[href^="/${locale}/projects/"]`)).toHaveCount(0);
      await expect(cards.locator("h3")).toHaveText(
        locale === "en"
          ? ["Tulip Roundabout Sculpture", "Clock Tower Landmark", "Palm-Leaf Shade Canopies", "Geometric Lanterns"]
          : [/./, /./, /./, /./],
      );
    }
    await page.goto("/en/about", { waitUntil: "networkidle" });
    await page.locator("#work ul a").first().click();
    await page.waitForURL("**/en/projects#gallery");
  });

  test("the vision is a blockquote, and the machine table keeps its header cells and its unstated values", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 2, name: "05 Our vision" })).toHaveAttribute("id", "vision-title");
    await expect(page.locator("#vision blockquote")).toHaveText(company.vision.statement.en);
    await expect(page.locator("#vision ol > li")).toHaveCount(4);
    const table = page.locator("#machinery table");
    await expect(table.locator("caption")).toHaveText("Machinery");
    await expect(table.locator('thead th[scope="col"]')).toHaveText(["Machine", "Type", "Rated power"]);
    await expect(table.locator('tbody th[scope="row"]')).toHaveCount(6);
    await expect(table.locator("tbody td.ip-table-end")).toHaveText(["12 kW", "12 kW", "6 kW", "3 kW", /—\s*Not stated in the company profile/, /—\s*Not stated in the company profile/]);
    await page.goto("/ar/about", { waitUntil: "networkidle" });
    await expect(page.locator("#machinery tbody .sr-only").first()).toHaveText("غير مذكورة في الملف التعريفي");
    await expect(page.locator("#vision blockquote")).toHaveText(company.vision.statement.ar);
  });

  test("photos are never shown larger than their source, on desktop and phones", async ({ browser }) => {
    for (const [width, height] of [
      [1440, 900],
      [834, 1112],
      [390, 844],
    ] as const) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 });
      await skipIntro(context);
      const page = await context.newPage();
      for (const path of ["/en/about", "/ar/about", "/en/industries"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await revealAll(page);
        await page.waitForTimeout(1200);
        const worst = await largestPhotoScale(page);
        expect(worst.scale, `${path} ${width}: ${worst.src}`).toBeLessThanOrEqual(1.005);
      }
      await context.close();
    }
  });

  test("fonts: Plus Jakarta Sans and Inter in English, Tajawal and IBM Plex Sans Arabic in Arabic, never letter-spaced", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Plus Jakarta Sans/);
    expect(await page.locator("main .ab-prose p").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Inter/);
    await page.goto("/ar/about", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const h1 = page.locator("h1");
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Tajawal/);
    expect(await h1.evaluate((el) => getComputedStyle(el).letterSpacing)).toMatch(/^(normal|0px)$/);
    expect(await page.locator("main .ab-prose p").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Sans Arabic/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Industries
// ---------------------------------------------------------------------------------------------------------------------

const BASIS = {
  en: { profile: "Named in the company profile", inferred: "Website classification, based on our work gallery" },
  ar: { profile: "مذكور في الملف التعريفي", inferred: "تصنيف للموقع مبني على معرض أعمالنا" },
} as const;

test.describe("industries", () => {
  test("eight sectors, each with its source and its related services; laser engraving is never linked", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/industries`, { waitUntil: "networkidle" });
      const rows = page.locator("#sectors ol > li");
      await expect(rows).toHaveCount(8);
      await expect(rows.locator("h3")).toHaveCount(8);
      const basis = await rows.locator(".in-basis").allInnerTexts();
      expect(basis.filter((b) => b.trim() === BASIS[locale].profile)).toHaveLength(4);
      expect(basis.filter((b) => b.trim() === BASIS[locale].inferred)).toHaveLength(4);
      // The legend explains both sources.
      await expect(page.locator("#sectors .in-legend li")).toHaveText([BASIS[locale].profile, BASIS[locale].inferred]);
      const services = await rows.locator("a").evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")))].sort());
      expect(services).toEqual(["cnc-bending", "fabrication", "laser-cutting", "scaffolding", "steel-structures"].map((s) => `/${locale}/services/${s}`));
      await expect(page.locator(`main a[href="/${locale}/services/laser-engraving"]`)).toHaveCount(0);
      // How the sectors are classified.
      await expect(page.locator("#sectors .in-note h2")).toHaveText(locale === "en" ? "How the sectors are classified." : "كيف صنّفنا هذه القطاعات.");
      await expect(page.locator("#sectors .in-note-text p")).toHaveCount(2);
      expect((await jsonLd(page)).some((d) => d["@type"] === "CollectionPage")).toBe(true);
    }
  });

  test("the preview follows keyboard focus and the mouse, and is hidden from assistive technology", async ({ page }) => {
    await page.goto("/en/industries", { waitUntil: "networkidle" });
    const items = page.locator("#sectors ol > li");
    const caption = page.locator("#sectors figure figcaption");
    await expect(page.locator("#sectors figure")).toHaveAttribute("aria-hidden", "true");
    const third = items.nth(2);
    const name = (await third.locator("h3").innerText()).trim();
    await third.locator("a").first().focus();
    await expect(caption).toContainText(name);
    await expect(third).toHaveAttribute("data-active");
    // The active photo is the third sector's.
    expect(await page.locator("#sectors .in-preview-layer").evaluateAll((layers) => layers.findIndex((l) => l.hasAttribute("data-active")))).toBe(2);
    const fifth = items.nth(4);
    await fifth.locator("h3").hover();
    await expect(caption).toContainText((await fifth.locator("h3").innerText()).trim());
    // Focus never moves to the preview.
    expect(await page.locator("#sectors figure a, #sectors figure button, #sectors figure [tabindex]").count()).toBe(0);
  });

  test("Arabic: the preview sits on the left of the list; each number beside its name; descriptions in the text face", async ({ page }) => {
    await page.goto("/ar/industries", { waitUntil: "networkidle" });
    const list = (await page.locator("#sectors ol").boundingBox())!;
    const preview = (await page.locator("#sectors figure").boundingBox())!;
    expect(preview.x + preview.width).toBeLessThan(list.x);
    const row = page.locator(".in-row").first();
    const number = (await row.locator(".in-index").boundingBox())!;
    const name = (await row.locator("h3").boundingBox())!;
    expect(number.x - (name.x + name.width)).toBeLessThan(16);
    const face = (selector: string) => row.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, ""));
    expect(await face("h3")).toBe("Tajawal");
    expect(await face(".in-body p")).toBe("IBM Plex Sans Arabic");
  });

  test("phones: no preview, a photo beside each sector's name; nothing scrolls sideways", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await skipIntro(context);
    const page = await context.newPage();
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/industries`, { waitUntil: "networkidle" });
      await expect(page.locator("#sectors figure")).toBeHidden();
      const thumbs = await page.locator("#sectors .in-thumb").evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().width > 0).length);
      expect(thumbs).toBe(8);
      // The description runs the full width of the row, under the photo and the name.
      const row = (await page.locator("#sectors ol > li").first().boundingBox())!;
      const body = (await page.locator("#sectors ol > li .in-body").first().boundingBox())!;
      expect(body.width).toBeGreaterThan(row.width * 0.9);
      expect(await horizontalOverflow(page)).toBe(0);
    }
    await context.close();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("the preview changes at once, without a cross-fade", async ({ page }) => {
      await page.goto("/en/industries", { waitUntil: "networkidle" });
      expect(await page.locator("#sectors .in-preview-layer").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
      await page.locator("#sectors ol > li").nth(3).locator("a").first().focus();
      await expect(page.locator("#sectors .in-preview-layer").nth(3)).toHaveCSS("opacity", "1");
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("every sector, source and link is there, and the preview shows the first sector", async ({ page }) => {
      await page.goto("/en/industries", { waitUntil: "load" });
      await expect(page.locator("#sectors ol > li")).toHaveCount(8);
      await expect(page.locator("#sectors ol > li a")).toHaveCount(21);
      await expect(page.locator("#sectors .in-preview-layer").first()).toHaveCSS("opacity", "1");
      const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length);
      expect(hidden).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------------------------------------------------

/** Rows of the wall whose last tile does not reach the wall's end (0 when every row is full). */
function unfilledRows(page: Page) {
  return page.locator("#clients-wall").evaluate((ul) => {
    const box = ul.getBoundingClientRect();
    const rtl = getComputedStyle(ul).direction === "rtl";
    const rows = new Map<number, DOMRect[]>();
    for (const li of ul.children) {
      const r = li.getBoundingClientRect();
      const key = Math.round(r.top);
      rows.set(key, [...(rows.get(key) ?? []), r]);
    }
    return [...rows.values()].filter((cells) => {
      const end = rtl ? Math.min(...cells.map((c) => c.left)) - box.left : box.right - Math.max(...cells.map((c) => c.right));
      return end > 2;
    }).length;
  });
}

const columns = (page: Page) => page.locator("#clients-wall").evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);

/** Logos and names that reach outside their own tile (a logo shown at its natural size spills over its neighbours). */
const spilling = (page: Page) =>
  page.locator("#clients-wall > li").evaluateAll((items) =>
    items.flatMap((li) => {
      const tile = li.querySelector(".cl-tile")!.getBoundingClientRect();
      return [...li.querySelectorAll("img, .cl-name")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < tile.left - 0.5 || r.right > tile.right + 0.5 || r.top < tile.top - 0.5 || r.bottom > tile.bottom + 0.5;
        })
        .map((el) => el.getAttribute("alt") ?? el.textContent ?? "");
    }),
  );

test.describe("clients", () => {
  test("21 named logos on one labelled wall, six across on desktop, every row full, every logo inside its tile", async ({ page }) => {
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const wall = page.locator("#clients-wall");
    await expect(wall).toHaveAttribute("aria-labelledby", "clients-list-title");
    await expect(page.locator("#clients-list-title")).toHaveText("Client logos");
    await expect(wall.locator("> li")).toHaveCount(21);
    const alts = await wall.locator("img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt") ?? ""));
    expect(alts.every((alt) => alt.trim().length > 1)).toBe(true);
    expect(new Set(alts).size).toBe(21);
    expect(await columns(page)).toBe(6);
    expect(await unfilledRows(page)).toBe(0);
    // Logos keep their proportions (contained, never cropped or stretched) and stay inside their tiles.
    expect(await wall.locator("img").evaluateAll((imgs) => imgs.every((img) => getComputedStyle(img).objectFit === "contain"))).toBe(true);
    expect(await spilling(page)).toEqual([]);
  });

  test("two across on phones, every row full, every logo inside its tile", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await skipIntro(context);
    const page = await context.newPage();
    await page.goto("/ar/clients", { waitUntil: "networkidle" });
    expect(await columns(page)).toBe(2);
    expect(await unfilledRows(page)).toBe(0);
    expect(await horizontalOverflow(page)).toBe(0);
    expect(await spilling(page)).toEqual([]);
    await context.close();
  });

  test("no numbering, grid references, counts or claims anywhere on the page", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/clients`, { waitUntil: "networkidle" });
      const text = await page.locator("main").innerText();
      expect(text, locale).not.toMatch(/\b0\d\b/);
      expect(text, locale).not.toMatch(/\b21\b/);
      expect(text, locale).not.toMatch(/\d/);
      expect(text, locale).not.toContain("RW—C");
      expect(text, locale).not.toMatch(/trusted|partner|testimonial/i);
      // No A–G column letters or 1–7 row numbers standing on their own.
      const loneMarks = await page.locator("main").evaluate((main) =>
        [...main.querySelectorAll("span, p, li")].filter((el) => el.children.length === 0 && /^\s*([A-G]|[1-7])\s*$/.test(el.textContent ?? "")).length,
      );
      expect(loneMarks, locale).toBe(0);
      // The closing panel's ways on are not numbered either.
      await expect(page.locator(".ip-cta-n")).toHaveCount(0);
    }
  });

  test("the colour switch shows every logo's own colours, from the keyboard too; hovering a tile shows its colours", async ({ page }) => {
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const toggle = page.getByRole("button", { name: "Original colours" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "clients-wall");
    const logo = page.locator("#clients-wall img").first();
    const filter = () => logo.evaluate((el) => getComputedStyle(el).filter);
    expect(await filter()).toMatch(/grayscale\(1\)/);
    await toggle.focus();
    // A visible focus ring.
    expect(await toggle.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#clients-wall")).toHaveAttribute("data-colour", "");
    await expect.poll(filter).toBe("none");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect.poll(filter).toMatch(/grayscale\(1\)/);
    const tile = page.locator("#clients-wall .logo-tile").nth(3);
    await tile.hover();
    await expect.poll(() => tile.locator("img").evaluate((el) => getComputedStyle(el).filter)).toBe("none");
  });

  test("in forced colours the switch still shows its state: an outlined track, a dot that moves, a filled track when on", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const toggle = page.getByRole("button", { name: "Original colours" });
    const look = () =>
      toggle.locator(".knob").evaluate((el) => {
        const k = getComputedStyle(el);
        const d = getComputedStyle(el, "::after");
        return { track: k.backgroundColor, border: k.borderTopStyle, dot: d.backgroundColor, at: d.translate };
      });
    const off = await look();
    expect(off.border).toBe("solid");
    expect(off.dot).not.toBe(off.track);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await look()).at).not.toBe(off.at);
    const on = await look();
    expect(on.track).not.toBe(off.track);
    expect(on.dot).not.toBe(on.track);
  });

  test("Arabic: the wall follows the reading direction; logos are never mirrored", async ({ page }) => {
    await page.goto("/ar/clients", { waitUntil: "networkidle" });
    const first = (await page.locator("#clients-wall > li").first().boundingBox())!;
    const wall = (await page.locator("#clients-wall").boundingBox())!;
    expect(first.x + first.width).toBeGreaterThan(wall.x + wall.width - 2);
    const transforms = await page.locator("#clients-wall img").evaluateAll((imgs) => imgs.map((i) => [getComputedStyle(i).transform, getComputedStyle(i).scale]));
    expect(transforms.every(([t, s]) => t === "none" && s === "none")).toBe(true);
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the logos are all there and the switch, which needs script, stays out of the way", async ({ page }) => {
      await page.goto("/en/clients", { waitUntil: "load" });
      await expect(page.locator("#clients-wall > li")).toHaveCount(21);
      await expect(page.getByRole("button", { name: "Original colours" })).toBeHidden();
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The four pages together
// ---------------------------------------------------------------------------------------------------------------------

test("the header and footer mark the page being read; the language switch keeps the page", async ({ page }) => {
  for (const route of ["about", "industries", "clients", "certificates"]) {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/${route}`, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      await expect(page.locator(`footer a[href="/${locale}/${route}"]`)).toHaveAttribute("aria-current", "page");
      if (route !== "certificates") await expect(page.locator(`.a2-nav a[href="/${locale}/${route}"]`)).toHaveAttribute("aria-current", "page");
      const other = locale === "en" ? "ar" : "en";
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other]}"]`).first()).toHaveAttribute("href", `/${other}/${route}`);
    }
  }
});

test("nothing spills out of its card or is cut off by it, on About, Industries, Clients and Certificates", async ({ browser }) => {
  // Every visible box (a border, a background or a shadow) holds its images and text. A box that clips must not cut
  // any of them; a scrolling region (the certificate dialog) is the one exception. Images are checked inside decoration
  // too (the Industries preview).
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [320, 700],
  ] as const) {
    const phone = width < 800;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, reducedMotion: "reduce" });
    await skipIntro(context);
    const page = await context.newPage();
    for (const path of ["/en/about", "/ar/about", "/en/industries", "/en/clients", "/ar/clients", "/en/certificates"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await revealAll(page);
      await page.evaluate(async () => {
        await Promise.all([...document.images].map((img) => ((img.loading = "eager"), img.decode().catch(() => {}))));
      });
      const previews = page.locator(".in-row");
      const passes = (await previews.count()) && width >= 1024 ? 8 : 1;
      for (let i = 0; i < passes; i++) {
        if (passes > 1) await previews.nth(i).hover();
        const escaping = await page.locator("main").evaluate((main) => {
          const found: string[] = [];
          const draws = (s: CSSStyleDeclaration) =>
            (s.borderTopStyle !== "none" && parseFloat(s.borderTopWidth) > 0) || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) || s.boxShadow !== "none";
          for (const box of main.querySelectorAll<HTMLElement>("*")) {
            if (!box.checkVisibility()) continue;
            const bs = getComputedStyle(box);
            if (!draws(bs) || /auto|scroll/.test(bs.overflowX + bs.overflowY)) continue;
            const b = box.getBoundingClientRect();
            if (b.width < 4 || b.height < 4) continue;
            for (const el of box.querySelectorAll<HTMLElement>("img, h2, h3, p, span, a, dt, dd, td, th, figcaption")) {
              if (!el.checkVisibility() || el.closest(".sr-only") || /absolute|fixed/.test(getComputedStyle(el).position)) continue;
              if (el.tagName !== "IMG" && (el.closest("[aria-hidden='true']") || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))) continue;
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) continue;
              if (Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom) > 1.5)
                found.push(`${el.tagName.toLowerCase()} «${(el.getAttribute("alt") || el.textContent || "").trim().slice(0, 24)}» in ${box.className}`);
            }
          }
          return found;
        });
        expect(escaping, `${path} at ${width}`).toEqual([]);
      }
    }
    await context.close();
  }
});

test("decoration is hidden from assistive technology on About, Industries and Clients", async ({ page }) => {
  for (const path of ["/en/about", "/ar/about", "/en/industries", "/ar/industries", "/en/clients", "/ar/clients"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const exposed = await page.evaluate(() =>
      [...document.querySelectorAll("main svg, main .step-num, main .ab-aim-n, main .ab-closing-rule, main .ab-proj-flag, main .in-preview, .a2-ambient, .a2-cursor")]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .map((el) => el.getAttribute("class")),
    );
    expect(exposed, path).toEqual([]);
  }
});

test("the pages in the previous design never prefetch the four pages and load none of the new design's faces", async ({ page }) => {
  const prefetched: string[] = [];
  page.on("request", (r) => void (r.headers()["next-router-prefetch"] && prefetched.push(new URL(r.url()).pathname)));
  // The pages left in the previous design (the services moved in Stage TM-2.4).
  for (const path of ["/en/capabilities", "/ar/projects", "/en/projects/geometric-lanterns", "/ar/capabilities"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator('footer a[href$="/about"]').first()).toBeAttached();
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const fonts = await page.evaluate(() => [...new Set([...document.fonts].map((f) => f.family.replace(/['"]/g, "")))]);
    expect(fonts, path).not.toContain("Plus Jakarta Sans");
    expect(fonts, path).not.toContain("Tajawal");
  }
  expect(prefetched.filter((p) => /\/(about|industries|clients|certificates)$/.test(p))).toEqual([]);
  // The rest of the previous design still prefetches as before.
  expect(prefetched).toContain("/en/projects");
});
