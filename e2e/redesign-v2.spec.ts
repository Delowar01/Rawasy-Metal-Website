import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { horizontalOverflow, skipIntro, trackErrors } from "./helpers";

/**
 * Visual redesign V2: the Projects overview (filters, image-led grid), the
 * unnumbered clients wall, the contact map, the new type system, colour-role
 * contrast, responsive layouts, reduced motion and keyboard use.
 */

test.beforeEach(async ({ context }) => {
  await skipIntro(context);
  await stubGoogleMaps(context);
});

/** google.com is not reachable from the test environment: answer the map embed with a blank page. */
async function stubGoogleMaps(context: BrowserContext) {
  await context.route(/^https:\/\/(www|maps)\.google\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>map</title>" }),
  );
}

const ADDRESS = "Al Mashael, Sulay, Riyadh 14325, Saudi Arabia";

/** Gallery items that are currently shown. */
function shownItems(page: Page) {
  return page.locator("#gallery ul.proj-masonry > li:not([hidden])");
}

test.describe("projects overview", () => {
  test("image-led: hero collage, featured project, highlights, gallery, then the text index", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const order = await page.evaluate(() =>
      ["#featured-title", "#highlights-title", "#gallery-title", "#index-title"].map(
        (id) => document.querySelector(id)!.getBoundingClientRect().top + scrollY,
      ),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The hero carries photographs, not just text.
    expect(await page.locator("main section").first().locator("img").count()).toBeGreaterThanOrEqual(3);
    // Every gallery card leads with a photo and names its project.
    const items = page.locator("#gallery ul.proj-masonry > li");
    const count = await items.count();
    expect(count).toBeGreaterThan(20);
    expect(await items.locator("a img").count()).toBeGreaterThanOrEqual(count);
    // The text index comes last and lists the same projects.
    await expect(page.locator('section[aria-labelledby="index-title"] ol > li')).toHaveCount(count);
    expect(errors).toEqual([]);
  });

  test("withheld photos and flagged projects stay out", async ({ page, request }) => {
    const html = await (await request.get("/en/projects")).text();
    for (const id of ["wheat-monument-1", "stainless-landmark-1", "billboard-structure-1"]) expect(html).not.toContain(id);
    for (const slug of ["illuminated-lattice-cubes", "perforated-seed-sculpture", "canopy-tree-sculpture", "laser-cut-bench", "street-litter-bins", "stainless-landmark-sculpture", "billboard-support-structure"]) {
      expect(html).not.toContain(`/projects/${slug}"`);
    }
    await page.goto("/en/projects");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("filtering shows only matching projects and announces the choice", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const bar = page.getByRole("group", { name: "Filter projects by category" });
    const all = await shownItems(page).count();

    const chip = bar.getByRole("button", { name: "Shade & Canopies" });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(bar.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => shownItems(page).count()).toBeLessThan(all);
    const categories = await shownItems(page).evaluateAll((lis) => lis.map((li) => li.getAttribute("data-categories") ?? ""));
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.split(" ").includes("shade"))).toBe(true);
    await expect(page.locator("#gallery p[aria-live]")).toHaveText("Showing: Shade & Canopies");
    // Shown cards are visible (their reveal ran), not just un-hidden.
    await shownItems(page).first().scrollIntoViewIfNeeded();
    await expect.poll(() => shownItems(page).first().evaluate((li) => getComputedStyle(li).opacity)).toBe("1");

    await bar.getByRole("button", { name: "All" }).click();
    await expect.poll(() => shownItems(page).count()).toBe(all);
  });

  test("the hero's quick filter sets the gallery filter and moves to it", async ({ page }) => {
    await page.goto("/ar/projects", { waitUntil: "networkidle" });
    const hero = page.getByRole("group", { name: "تصفّح حسب الفئة" });
    await hero.getByRole("button", { name: "أعمال القص بالليزر" }).click();
    const galleryChip = page.getByRole("group", { name: "تصفية المشاريع حسب الفئة" }).getByRole("button", { name: "أعمال القص بالليزر" });
    await expect(galleryChip).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.locator("#gallery").evaluate((el) => Math.abs(el.getBoundingClientRect().top) < 140)).toBe(true);
  });

  test("filters work from the keyboard", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const bar = page.getByRole("group", { name: "Filter projects by category" });
    const chip = bar.getByRole("button", { name: "Decorative Metal" });
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("cards respond to hover and keyboard focus", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "networkidle" });
    const card = page.locator("#gallery .proj-card").first();
    await card.scrollIntoViewIfNeeded();
    const rest = await card.evaluate((el) => getComputedStyle(el).borderColor);
    await card.hover();
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).borderColor)).not.toBe(rest);
    await expect.poll(() => card.locator(".zoom-img img").first().evaluate((img) => getComputedStyle(img).transform)).not.toBe("none");

    await page.mouse.move(0, 0);
    await card.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(card).toBeFocused();
    expect(await card.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await expect(card).toHaveAttribute("href", /^\/en\/projects\/[a-z0-9-]+$/);
  });

  for (const [width, columns] of [
    [1440, 4],
    [834, 2],
    [390, 1],
  ] as const) {
    test(`the gallery is ${columns} column${columns > 1 ? "s" : ""} wide at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en/projects", { waitUntil: "networkidle" });
      const count = await page.locator("#gallery ul.proj-masonry").evaluate((ul) => getComputedStyle(ul).columnCount);
      expect(Number(count)).toBe(columns);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }

  test("phones scroll the filter bar sideways without scrolling the page", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/ar/projects", { waitUntil: "networkidle" });
    const bar = page.getByRole("group", { name: "تصفية المشاريع حسب الفئة" });
    const scrollable = await bar.evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === "auto");
    expect(scrollable).toBe(true);
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("filtering skips the animated re-flow and cards do not move", async ({ page }) => {
      await page.goto("/en/projects", { waitUntil: "networkidle" });
      const bar = page.getByRole("group", { name: "Filter projects by category" });
      await page.evaluate(() => {
        (window as unknown as { vt: boolean }).vt = false;
        new MutationObserver(() => {
          if (document.documentElement.hasAttribute("data-vt")) (window as unknown as { vt: boolean }).vt = true;
        }).observe(document.documentElement, { attributes: true });
      });
      await bar.getByRole("button", { name: "Structures", exact: true }).click();
      await expect(bar.getByRole("button", { name: "Structures", exact: true })).toHaveAttribute("aria-pressed", "true");
      expect(await page.evaluate(() => (window as unknown as { vt: boolean }).vt)).toBe(false);

      const card = shownItems(page).first().locator(".proj-card");
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await page.waitForTimeout(400);
      expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("every project is listed and the filters are hidden", async ({ page }) => {
      await page.goto("/en/projects", { waitUntil: "load" });
      const items = page.locator("#gallery ul.proj-masonry > li");
      expect(await items.count()).toBeGreaterThan(20);
      expect(await page.locator("#gallery ul.proj-masonry > li[hidden]").count()).toBe(0);
      await expect(page.getByRole("group", { name: "Filter projects by category" })).toBeHidden();
    });
  });
});

test.describe("clients", () => {
  test("no numbering, grid references or counts anywhere on the page", async ({ page }) => {
    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}/clients`, { waitUntil: "networkidle" });
      const text = await page.locator("main").innerText();
      expect(text, locale).not.toMatch(/\b0\d\b/);
      expect(text, locale).not.toMatch(/\b21\b/);
      expect(text, locale).not.toContain("RW—C");
      // No A–G column letters or 1–3 row numbers standing on their own.
      const loneMarks = await page.locator("main").evaluate((main) =>
        [...main.querySelectorAll("span, p, li")].filter((el) => el.children.length === 0 && /^\s*([A-G]|[1-7])\s*$/.test(el.textContent ?? "")).length,
      );
      expect(loneMarks, locale).toBe(0);
    }
  });

  test("the colour switch reveals every logo's own colours, from the keyboard too", async ({ page }) => {
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const toggle = page.getByRole("switch", { name: "Original colours" });
    await expect(toggle).not.toBeChecked();
    const colour = page.locator(".logo-cell .client-color").first();
    expect(await colour.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    await expect.poll(() => colour.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await colour.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("/media/clients/");
  });

  test("hovering a cell reveals its colours", async ({ page }) => {
    await page.goto("/en/clients", { waitUntil: "networkidle" });
    const cell = page.locator(".logo-cell").nth(3);
    await cell.hover();
    await expect.poll(() => cell.locator(".client-color").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
});

test.describe("contact map", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`${locale}: a lazy, titled, keyless embed of the verified address and a Get directions link`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      const query = encodeURIComponent(ADDRESS);
      const map = page.locator("#location iframe");
      await expect(map).toHaveCount(1);
      await expect(map).toHaveAttribute("loading", "lazy");
      expect((await map.getAttribute("title"))?.length ?? 0).toBeGreaterThan(10);
      const src = (await map.getAttribute("src")) ?? "";
      expect(src.startsWith(`https://www.google.com/maps?q=${query}`)).toBe(true);
      expect(src).toContain("output=embed");
      expect(src).toContain(`hl=${locale}`);
      expect(src).not.toMatch(/[?&]key=/);

      const directions = page.getByRole("link", { name: locale === "ar" ? /الحصول على الاتجاهات/ : /Get directions/ });
      await expect(directions).toHaveAttribute("href", `https://www.google.com/maps/dir/?api=1&destination=${query}`);
      await expect(directions).toHaveAttribute("target", "_blank");
      await expect(directions).toHaveAttribute("rel", /noopener/);
      await expect(page.locator("#location address")).toContainText(locale === "ar" ? "حي المشاعل" : "Al Mashael");
      expect(errors).toEqual([]);
    });
  }

  test("map and details sit side by side on desktop and stack on phones", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    const details = page.locator("#location .card").first();
    const map = page.locator("#location figure");
    let d = (await details.boundingBox())!;
    let m = (await map.boundingBox())!;
    expect(d.x + d.width).toBeLessThanOrEqual(m.x + 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    d = (await details.boundingBox())!;
    m = (await map.boundingBox())!;
    expect(d.y + d.height).toBeLessThanOrEqual(m.y + 1);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("typography", () => {
  test("English: Sora for headings, Manrope for text, Geist Mono for labels — all self-hosted", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
    });
    await page.goto("/en/about", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^Sora\b/);
    expect(await page.locator("main p.t-lead").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^Manrope\b/);
    expect(await page.locator("main .t-label").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Geist Mono/);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")));
    expect(loaded).toEqual(expect.arrayContaining(["Sora", "Manrope"]));
    expect(external).toEqual([]);
  });

  test("Arabic: Noto Kufi Arabic for headings, IBM Plex Sans Arabic for text, no letter-spacing", async ({ page }) => {
    await page.goto("/ar/about", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const h1 = page.locator("h1");
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Noto Kufi Arabic/);
    expect(await h1.evaluate((el) => getComputedStyle(el).letterSpacing)).toMatch(/^(normal|0px)$/);
    expect(await page.locator("main p.t-lead").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Sans Arabic/);
  });
});

test.describe("colour roles", () => {
  /** Text colour / surface pairs the redesign uses for small text; each must reach WCAG AA (4.5:1). */
  const PAIRS: [string, string][] = [
    ["--text-primary", "--background"],
    ["--text-secondary", "--background"],
    ["--text-secondary", "--surface-recessed"],
    ["--text-secondary", "--eng-surface"],
    ["--text-secondary", "--proc-surface"],
    ["--text-secondary", "--craft-surface"],
    ["--text-tertiary", "--surface-elevated"],
    ["--eng-ink", "--surface-elevated"],
    ["--eng-ink", "--eng-surface"],
    ["--eng-ink", "--eng-surface-2"],
    ["--proc-ink", "--surface-elevated"],
    ["--proc-ink", "--proc-surface"],
    ["--craft-ink", "--surface-elevated"],
    ["--craft-ink", "--craft-surface"],
    ["--accent-text", "--surface-elevated"],
    ["--slate-text", "--slate"],
    ["--slate-text-2", "--slate"],
    ["--btn-fg", "--btn-bg"],
    ["--btn2-fg", "--btn2-bg"],
    ["--logo-plate-ink", "--logo-plate"],
  ];

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: role inks, captions and buttons reach 4.5:1`, async ({ page, context }) => {
      await context.addInitScript((t) => localStorage.setItem("rawasy-theme", t), theme);
      await page.goto("/en/about", { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const failures = await page.evaluate((pairs) => {
        const probe = document.createElement("span");
        document.body.append(probe);
        const rgb = (token: string) => {
          probe.style.color = `var(${token})`;
          const [r, g, b] = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
          return [r, g, b];
        };
        const lum = ([r, g, b]: number[]) => {
          const c = [r, g, b].map((v) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const out: string[] = [];
        for (const [fg, bg] of pairs) {
          const [a, b] = [lum(rgb(fg)), lum(rgb(bg))].sort((x, y) => y - x);
          const ratio = (a + 0.05) / (b + 0.05);
          if (ratio < 4.5) out.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`);
        }
        probe.remove();
        return out;
      }, PAIRS);
      expect(failures).toEqual([]);
    });
  }
});

test.describe("about page", () => {
  test("a full company profile: fifteen parts, no invented figures", async ({ page }) => {
    await page.goto("/en/about", { waitUntil: "networkidle" });
    // Hero + thirteen numbered sections + the closing CTA.
    for (const id of ["overview", "what", "metal", "beyond", "vision", "approach", "process", "why", "workshop", "machinery", "work", "clients", "compliance"]) {
      await expect(page.locator(`section#${id}`), id).toHaveCount(1);
    }
    await expect(page.locator("#page-cta-title")).toHaveCount(1);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/founded|established in|employees|\d+\+?\s*(projects|years)/i);
    // Links onward to capabilities, projects, clients and certificates.
    for (const route of ["capabilities", "projects", "clients", "certificates"]) {
      expect(await page.locator(`main a[href="/en/${route}"]`).count(), route).toBeGreaterThan(0);
    }
  });
});

test("the homepage introduction explains the company: six service lines, site support, vision and two ways on", async ({ page }) => {
  await page.goto("/en", { waitUntil: "networkidle" });
  const intro = page.locator("#intro");
  await expect(intro.locator("ul a[href^='/en/services/']")).toHaveCount(6);
  for (const name of ["Formwork systems", "Wood & steel props", "Rental services", "Installation & dismantling", "Transportation"]) {
    await expect(intro.getByText(name, { exact: true })).toHaveCount(1);
  }
  await expect(intro.locator("blockquote")).toContainText("leading force");
  await expect(intro.getByRole("link", { name: "About RAWASY" })).toHaveAttribute("href", "/en/about");
  await expect(intro.getByRole("link", { name: "Explore services" })).toHaveAttribute("href", "/en/services");
  // The homepage keeps its logo marquee, without a count.
  expect(await page.locator("#clients").innerText()).not.toMatch(/\b21\b/);
});
