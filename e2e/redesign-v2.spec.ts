import { expect, test, type BrowserContext } from "@playwright/test";
import { skipIntro } from "./helpers";

/**
 * Visual redesign V2: the type system and colour-role contrast, on the pages still in that design (the Capabilities and
 * project placeholders). The contact map moved to commerce-contact.spec.ts, the clients wall and About to
 * commerce-company.spec.ts, the Projects overview to commerce-projects.spec.ts.
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

// The projects overview moved to the Modern Commerce design in Stage TM-2.5: its tests (the parts and their order, the 27
// projects, withheld photos and flagged projects, the category toggles and their shared choice, keyboard use, the
// columns, the phone bar, reduced motion, no JavaScript, and the per-project anchors) are in commerce-projects.spec.ts.

// The clients wall moved to the Modern Commerce design with the clients page in Stage TM-2.3: its tests (no numbering or
// counts, the colour switch from the keyboard, colour on hover) are in commerce-company.spec.ts.

// The contact map moved to the Modern Commerce design with the contact page in Stage TM-2.2: its tests (the unchanged
// embed and links, the layout, the pointer over the frame) are in commerce-contact.spec.ts.

test.describe("typography", () => {
  test("English: Sora for headings, Manrope for text, Geist Mono for labels — all self-hosted", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
    });
    // The Capabilities placeholder stands in for About (Modern Commerce since Stage TM-2.3), the services (TM-2.4) and
    // the projects overview (TM-2.5).
    await page.goto("/en/capabilities", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^Sora\b/);
    expect(await page.locator("main p.t-lead").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^Manrope\b/);
    expect(await page.locator("main .t-label").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Geist Mono/);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")));
    expect(loaded).toEqual(expect.arrayContaining(["Sora", "Manrope"]));
    expect(external).toEqual([]);
  });

  test("Arabic: Noto Kufi Arabic for headings, IBM Plex Sans Arabic for text, no letter-spacing", async ({ page }) => {
    await page.goto("/ar/capabilities", { waitUntil: "networkidle" });
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
      await page.goto("/en/capabilities", { waitUntil: "networkidle" });
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

// About moved to the Modern Commerce design in Stage TM-2.3: its fifteen parts, onward links and the check for invented
// figures are in commerce-company.spec.ts.
