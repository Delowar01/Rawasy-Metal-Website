import { expect, test, type Page } from "@playwright/test";
import { LOCALES, trackErrors } from "./helpers";

/**
 * Stage 1J: keyboard focus inside the rows that scroll sideways. Four rows hold focusable items: the homepage's machine
 * picks and project cards (phones and tablets), the Capabilities machine selector (phones) and the Projects category
 * bar (up to tablets). Chromium leaves such a row where it is while 32 px of the focused item already show, so on the
 * Stage 1I build Tab could land on an item that stayed mostly off screen, its name hidden (a machine pick with 56 of its
 * 240 px showing on a 320 px phone, a category toggle cut in half). The motion controller now moves the row at once
 * until the focused item shows whole; the page itself never moves sideways.
 */

const ROWS = [
  { name: "the homepage's machine picks", path: "", item: "a.a2-mx-pick" },
  { name: "the homepage's project cards", path: "", item: "a.a2-proj" },
  { name: "the Capabilities machine selector", path: "/capabilities", item: "a.cm-pick" },
  { name: "the Projects category bar", path: "/projects", item: ".pj-bar .pj-chip" },
];

const SIZES = [
  { name: "320 px phone", viewport: { width: 320, height: 700 }, phone: true },
  { name: "390 px phone", viewport: { width: 390, height: 844 }, phone: true },
  { name: "200 % zoom (1280 x 720 window)", viewport: { width: 640, height: 360 }, phone: false },
];

/** Waits until React has hydrated the page and its motion controller listens. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const main = document.querySelector("main");
    return !!main && Object.keys(main).some((k) => k.startsWith("__reactFiber")) && document.documentElement.hasAttribute("data-smooth-scroll");
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** The focused element against its row: its place in the row, whether it shows whole inside the row and the screen. */
function placeOfFocus(page: Page, item: string) {
  return page.evaluate((item) => {
    const el = document.activeElement as HTMLElement;
    let row = el.parentElement;
    while (row && !(row.scrollWidth > row.clientWidth && /(auto|scroll)/.test(getComputedStyle(row).overflowX))) row = row.parentElement;
    const card = el.getBoundingClientRect();
    const box = row?.getBoundingClientRect();
    return {
      index: [...document.querySelectorAll(item)].indexOf(el),
      keyboard: el.matches(":focus-visible"),
      row: !!row,
      inRow: !!box && card.left >= box.left - 0.5 && card.right <= box.right + 0.5,
      onScreen: card.left >= -0.5 && card.right <= innerWidth + 0.5,
      pageX: scrollX,
      card: [Math.round(card.left), Math.round(card.right)],
      box: box ? [Math.round(box.left), Math.round(box.right)] : null,
    };
  }, item);
}

for (const size of SIZES)
  for (const locale of LOCALES)
    test.describe(`${size.name}, ${locale}: Tab through each row that scrolls sideways shows every item whole`, () => {
      for (const row of ROWS) {
        test(row.name, async ({ browser }) => {
          const context = await browser.newContext({ viewport: size.viewport, isMobile: size.phone, hasTouch: size.phone });
          const page = await context.newPage();
          const errors = trackErrors(page);
          await page.goto(`/${locale}${row.path}`, { waitUntil: "networkidle" });
          await hydrated(page);
          const items = page.locator(row.item);
          const count = await items.count();
          expect(count, "items in the row").toBeGreaterThan(2);
          // From the keyboard: a key press first, so the script's focus counts as keyboard focus (:focus-visible).
          await page.keyboard.press("Shift");
          await items.first().focus();
          for (let i = 0; i < count; i++) {
            if (i > 0) await page.keyboard.press("Tab");
            const seen = await placeOfFocus(page, row.item);
            const where = `item ${i + 1} of ${count}: card ${seen.card}, row ${seen.box}`;
            expect(seen.index, where).toBe(i);
            expect(seen.keyboard, where).toBe(true);
            expect(seen.row, `${where}: the row scrolls sideways at this size`).toBe(true);
            expect(seen.inRow, `${where}: whole inside its row`).toBe(true);
            expect(seen.onScreen, `${where}: whole on screen`).toBe(true);
            expect(seen.pageX, "the page never moves sideways").toBe(0);
          }
          expect(errors).toEqual([]);
          await context.close();
        });
      }
    });

test("a tap on a toggle cut off at the row's end focuses it without moving the row: only keyboard focus does", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/en/projects", { waitUntil: "networkidle" });
  await hydrated(page);
  await page.locator(".pj-bar").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const point = await page.evaluate(() => {
    const row = document.querySelector(".pj-bar .pj-chips-row")!;
    const box = row.getBoundingClientRect();
    const cut = [...row.querySelectorAll<HTMLElement>(".pj-chip")].find((c) => {
      const r = c.getBoundingClientRect();
      return r.left < box.right - 20 && r.right > box.right + 1;
    })!;
    const r = cut.getBoundingClientRect();
    return { x: (r.left + box.right) / 2, y: r.top + r.height / 2, left: row.scrollLeft };
  });
  await page.touchscreen.tap(point.x, point.y);
  const after = await page.evaluate(() => ({
    chip: !!document.activeElement?.matches(".pj-chip"),
    keyboard: !!document.activeElement?.matches(":focus-visible"),
    left: document.querySelector(".pj-bar .pj-chips-row")!.scrollLeft,
  }));
  expect(after.chip).toBe(true);
  expect(after.keyboard).toBe(false);
  expect(after.left).toBe(point.left);
  await context.close();
});
