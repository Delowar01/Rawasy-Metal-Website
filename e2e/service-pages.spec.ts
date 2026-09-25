import { expect, test, type Page } from "@playwright/test";
import { HTML_LANG, hiddenReveals, horizontalOverflow, jsonLd, LOCALES, skipIntro, trackErrors } from "./helpers";

/**
 * Stage 1D: the six service detail pages. Routes and language, SEO and the
 * review gate, the sourced relations (machines, projects, related services),
 * the quote action, imagery rules, keyboard use, reduced motion, layout at
 * phone widths and rendering without JavaScript.
 */

const SERVICES = ["laser-cutting", "cnc-bending", "steel-structures", "fabrication", "laser-engraving", "scaffolding"] as const;
type Slug = (typeof SERVICES)[number];

const NAMES: Record<Slug, { en: string; ar: string }> = {
  "laser-cutting": { en: "Laser Cutting", ar: "القص بالليزر" },
  "cnc-bending": { en: "CNC Bending", ar: "الثني بتقنية CNC" },
  "steel-structures": { en: "Steel Structures", ar: "الهياكل الحديدية" },
  fabrication: { en: "Metal Fabrication", ar: "التصنيع المعدني" },
  "laser-engraving": { en: "Laser Engraving", ar: "الحفر بالليزر" },
  scaffolding: { en: "Scaffolding", ar: "السقالات" },
};

/** Machines the company profile ties to each service (machines.ts). */
const MACHINES: Record<Slug, string[]> = {
  "laser-cutting": ["tube-cutting-12kw", "fiber-laser-combo-12kw", "fiber-laser-6kw", "fiber-laser-3kw"],
  "cnc-bending": ["cnc-press-brake"],
  "steel-structures": [],
  fabrication: ["laser-welding"],
  "laser-engraving": [],
  scaffolding: [],
};

/** Projects whose own record lists the service. */
const PROJECTS: Record<Slug, string[]> = {
  "laser-cutting": ["geometric-lanterns", "perforated-canopy-screen", "clock-tower-landmark", "suspended-lantern"],
  "cnc-bending": ["perforated-metal-seating"],
  "steel-structures": ["palm-leaf-shade-canopies", "gateway-welcome-signs", "car-park-shade-structures", "curved-steel-frames"],
  fabrication: ["heritage-cannon-replicas", "dome-finial-and-crescent", "sculpture-fabrication", "lattice-tower-replica"],
  "laser-engraving": [],
  scaffolding: [],
};

const RELATED: Record<Slug, Slug[]> = {
  "laser-cutting": ["cnc-bending", "fabrication", "laser-engraving"],
  "cnc-bending": ["laser-cutting", "fabrication", "steel-structures"],
  "steel-structures": ["fabrication", "cnc-bending", "scaffolding"],
  fabrication: ["laser-cutting", "cnc-bending", "steel-structures"],
  "laser-engraving": ["laser-cutting", "fabrication"],
  scaffolding: ["steel-structures", "fabrication"],
};

/** Decorative layers used on the service pages; none may reach assistive technology. */
const DECORATION = [
  ".tf",
  ".tf-hl",
  ".tf-c",
  ".tf-m",
  ".backdrop",
  ".scan",
  ".plight",
  ".section-rule",
  ".reg-marks",
  ".rivets",
  ".ruler",
  ".outline-num",
  ".step-rail",
  ".axis-line",
  ".axis-bubble",
  ".bench-plate",
  ".swatch",
  ".rail-cut",
  ".rail-fold",
  ".rail-fine",
  ".line-draw",
].join(", ");

test.beforeEach(async ({ context }) => {
  await skipIntro(context);
});

function main(page: Page) {
  return page.locator("main");
}

test.describe("routes, language and SEO", () => {
  for (const locale of LOCALES) {
    for (const slug of SERVICES) {
      test(`/${locale}/services/${slug}`, async ({ page }) => {
        const errors = trackErrors(page);
        const response = await page.goto(`/${locale}/services/${slug}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);

        await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(NAMES[slug][locale]);

        // Heading levels never skip (h1 → h2 → h3).
        const levels = await page.locator("main :is(h1, h2, h3, h4)").evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
        for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);

        // Breadcrumb: Home → Services → service, also as structured data, with a Service node.
        const crumbs = page.locator('main nav[aria-label] ol > li');
        await expect(crumbs).toHaveCount(3);
        await expect(crumbs.nth(1).locator("a")).toHaveAttribute("href", `/${locale}/services`);
        const data = await jsonLd(page);
        const service = data.find((d) => d["@type"] === "Service");
        expect(service?.name).toBe(NAMES[slug][locale]);
        expect(service?.url).toMatch(new RegExp(`/${locale}/services/${slug}$`));
        expect(service?.provider?.["@id"]).toMatch(/#organization$/);
        expect(data.find((d) => d["@type"] === "BreadcrumbList")?.itemListElement).toHaveLength(3);

        // Localized canonical and alternates; noindex until Stage 1D is approved.
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}/services/${slug}$`));
        for (const lang of ["en", "ar", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
        expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toContain(NAMES[slug][locale]);

        // No development placeholder left, and a general-workflow note on the process.
        await expect(page.getByText(locale === "en" ? "This page is being engineered." : "نعمل على هندسة هذه الصفحة.")).toHaveCount(0);
        await expect(page.locator("#process")).toContainText(locale === "en" ? "not a certified procedure" : "وليست إجراءً معتمدًا");

        expect(await horizontalOverflow(page)).toBe(0);
        expect(errors).toEqual([]);
      });
    }
  }

  test("service pages stay out of the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toContain("/services/");
  });

  test("an unknown service is a 404", async ({ page }) => {
    const response = await page.goto("/en/services/not-a-service");
    expect(response?.status()).toBe(404);
  });
});

test.describe("sourced relations", () => {
  for (const slug of SERVICES) {
    test(`${slug}: machines, projects, related services and the quote action`, async ({ page }) => {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });

      // Machines: only those the profile ties to the service, each linking to Capabilities.
      const machineLinks = main(page).locator('#machinery a[href^="/en/capabilities#"]');
      await expect(machineLinks).toHaveCount(MACHINES[slug].length);
      if (MACHINES[slug].length === 0) await expect(page.locator("#machinery")).toHaveCount(0);
      for (const machine of MACHINES[slug]) await expect(main(page).locator(`#machinery a[href="/en/capabilities#${machine}"]`)).toHaveCount(1);

      // Projects: only projects whose own record lists the service.
      const projectLinks = await main(page).locator('#projects a[href^="/en/projects/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(projectLinks.sort()).toEqual(PROJECTS[slug].map((p) => `/en/projects/${p}`).sort());
      if (PROJECTS[slug].length === 0) await expect(page.locator("#projects")).toHaveCount(0);

      // Related services.
      const related = await main(page).locator('#related a[href^="/en/services/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(related).toEqual(RELATED[slug].map((s) => `/en/services/${s}`));

      // The quote action (hero and closing band) opens the contact page's request form.
      await expect(main(page).locator('a[href="/en/contact#quote"]')).toHaveCount(2);
      await expect(page.locator('section[aria-labelledby="page-cta-title"] a[href^="tel:+966"]')).toHaveCount(1);
    });
  }

  test("rated power appears only where the profile states it", async ({ page }) => {
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    for (const [machine, power] of [
      ["tube-cutting-12kw", "12,000"],
      ["fiber-laser-combo-12kw", "12,000"],
      ["fiber-laser-6kw", "6,000"],
      ["fiber-laser-3kw", "3,000"],
    ]) {
      await expect(page.locator(`#machinery a[href="/en/capabilities#${machine}"]`)).toContainText(power);
    }
    await page.goto("/en/services/cnc-bending", { waitUntil: "networkidle" });
    await expect(page.locator("#machinery")).toContainText("CNC Press Brake Machine");
    await expect(page.locator("#machinery")).not.toContainText("Rated power");
  });

  test("the quote link lands on the request form", async ({ page }) => {
    await page.goto("/ar/services/scaffolding", { waitUntil: "networkidle" });
    await page.locator('main a[href="/ar/contact#quote"]').first().click();
    await page.waitForURL("**/ar/contact#quote");
    await expect(page.locator("#quote")).toBeInViewport();
  });
});

test.describe("imagery", () => {
  test("images have text alternatives and questionable images stay off the pages", async ({ page, request }) => {
    for (const slug of SERVICES) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      // Every image either has alt text or sits inside a link or card that names it (alt="" there).
      const missing = await page.locator("main img").evaluateAll((imgs) =>
        imgs.filter((img) => !img.hasAttribute("alt") || (img.getAttribute("alt") === "" && !img.closest("a, [aria-hidden='true']"))).length,
      );
      expect(missing, slug).toBe(0);
      // Engraving has no authentic photographs yet: its hero is a drawn plate.
      if (slug === "laser-engraving") expect(await page.locator("main img").count()).toBe(0);
      else expect(await page.locator("main img").count(), slug).toBeGreaterThan(2);
    }
    const engraving = await (await request.get("/en/services/laser-engraving")).text();
    // Third-party branding with part/serial numbers, and renders: not on the engraving page.
    for (const id of ["engraving-nameplates", "engraving-wood", "engraving-rotary"]) expect(engraving).not.toContain(id);
    const cutting = await (await request.get("/en/services/laser-cutting")).text();
    expect(cutting).not.toContain("canopy-tree-1");
    for (const slug of SERVICES) {
      const html = await (await request.get(`/ar/services/${slug}`)).text();
      for (const id of ["wheat-monument-1", "stainless-landmark-1", "billboard-structure-1"]) expect(html, slug).not.toContain(id);
    }
  });

  test("photographs are never shown wider than their source", async ({ page }) => {
    for (const slug of SERVICES) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      const tooWide = await page.locator("main img").evaluateAll((imgs) =>
        imgs
          .map((img) => {
            // Sources are the extracted profile images; their size is in the registry and the frame's max width.
            const box = img.getBoundingClientRect();
            const frame = img.closest("[style*='max-width'], li[style*='width']") as HTMLElement | null;
            const max = frame ? parseFloat(frame.style.maxWidth || frame.style.width) : Infinity;
            return { src: img.getAttribute("src") ?? "", width: box.width, max };
          })
          .filter((i) => i.width > i.max * 1.16 + 1),
      );
      expect(tooWide, slug).toEqual([]);
    }
  });

  test("decorative layers are hidden from assistive technology", async ({ page }) => {
    for (const slug of SERVICES) {
      await page.goto(`/ar/services/${slug}`, { waitUntil: "networkidle" });
      const exposed = await page.evaluate(
        (selector) => [...document.querySelectorAll(selector)].filter((el) => !el.closest('[aria-hidden="true"]')).map((el) => el.className),
        DECORATION,
      );
      expect(exposed, slug).toEqual([]);
    }
  });
});

test.describe("layout", () => {
  test("RTL mirrors the hero and the process", async ({ page }) => {
    await page.goto("/ar/services/laser-cutting", { waitUntil: "networkidle" });
    const h1 = await page.locator("h1").boundingBox();
    const visual = await page.locator('section[aria-labelledby="page-title"] figure').first().boundingBox();
    expect(h1!.x).toBeGreaterThan(visual!.x);
    // The first process station sits at the right in Arabic.
    const stations = page.locator("#process ol > li");
    const first = await stations.first().boundingBox();
    const last = await stations.last().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
  });

  test("dark theme applies to the service pages", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    await page.goto("/en/services/steel-structures", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(22, 25, 27)");
  });

  for (const width of [360, 390, 834]) {
    test(`no sideways scrolling at ${width}px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      const overflowing: string[] = [];
      for (const locale of LOCALES) {
        for (const slug of SERVICES) {
          await page.goto(`/${locale}/services/${slug}`, { waitUntil: "networkidle" });
          if ((await horizontalOverflow(page)) > 0) overflowing.push(`${locale}/${slug}`);
        }
      }
      expect(overflowing).toEqual([]);
    });
  }
});

test.describe("keyboard", () => {
  test("the quote action is reachable and shows focus", async ({ page }) => {
    await page.goto("/en/services/fabrication", { waitUntil: "networkidle" });
    const quote = page.locator('section[aria-labelledby="page-title"] a[href="/en/contact#quote"]');
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await quote.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    const outline = await quote.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("cards are links that can be focused", async ({ page }) => {
    await page.goto("/en/services/laser-cutting", { waitUntil: "networkidle" });
    const card = page.locator('#related a[href="/en/services/cnc-bending"]');
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/en/services/cnc-bending");
  });
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("nothing in view stays hidden, drawings are complete and scan lines are off", async ({ page }) => {
    for (const slug of SERVICES) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "networkidle" });
      await expect.poll(() => hiddenReveals(page), { message: slug, timeout: 3_000 }).toBe(0);
      const undrawn = await page.locator(".line-draw [pathLength]").evaluateAll(
        (paths) => paths.filter((p) => getComputedStyle(p).strokeDashoffset !== "0px" && getComputedStyle(p).strokeDashoffset !== "0").length,
      );
      expect(undrawn, slug).toBe(0);
      const scans = await page.locator(".scan").evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== "none").length);
      expect(scans, slug).toBe(0);
    }
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("all content is rendered and visible", async ({ page }) => {
    for (const slug of SERVICES) {
      await page.goto(`/en/services/${slug}`, { waitUntil: "load" });
      await expect(page.locator("h1")).toHaveCount(1);
      const hidden = await page.evaluate(
        () => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length,
      );
      expect(hidden, slug).toBe(0);
      await expect(page.locator("#process li").first()).toBeVisible();
    }
  });
});
