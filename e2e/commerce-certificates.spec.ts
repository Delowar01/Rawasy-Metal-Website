import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { horizontalOverflow, jsonLd, trackErrors } from "./helpers";

/**
 * Stage TM-2.3: the certificates page in the Modern Commerce design (src/app/(commerce)/[locale]/certificates, components
 * in src/components/commerce/certificates/). Migrated here from stage-1c.spec.ts: the register, the keyboard dialog with
 * focus return, the Arabic-first rule and the redaction checks. Added: the eight redacted files byte for byte, the
 * digit-run guard, previews no larger than the previous design showed them (and never filtered or zoomed), Escape and
 * backdrop closing, the links without JavaScript, and the pointer inside the dialog (desktop mouse, keyboard, touch,
 * reduced motion, Arabic). The generic inner-page checks (routes and search metadata, breadcrumbs, sideways scrolling,
 * reduced motion, no JavaScript) still run on this page from stage-1c.spec.ts.
 */

/** SHA-1 of the eight redacted files (the TM-2 plan's E4 baseline, in full). They are never re-encoded or replaced. */
const FILES: Record<string, string> = {
  "commercial-activity-licence.webp": "0b4405b6193b73dad562675d66615bdd87267421",
  "commercial-activity-licence-thumb.webp": "dd740fa944b546039ca83dc85514d9dc2cafe4a6",
  "commercial-registration-ar.webp": "2fa3939705e69e0574fb79b025d05a676c1cd429",
  "commercial-registration-ar-thumb.webp": "af4a0ef12ad6b29e50b3648459caa3ab4fe799e1",
  "commercial-registration-en.webp": "f3511dcc0c51ae4c54b75256853de35d7a299be6",
  "commercial-registration-en-thumb.webp": "7f27a975d9893dd00e46171534cdddc47dfb9ec5",
  "vat-registration.webp": "d725f4a14584bc59af9b883bb1c625da9b5dd7d1",
  "vat-registration-thumb.webp": "7681b9f1ab74134a69dacb6979e7917af1b9ceeb",
};
const sha1 = (data: Buffer) => createHash("sha1").update(data).digest("hex");

const DOCS = ["commercial-registration", "vat-registration", "commercial-activity-licence"] as const;
const LABELS = {
  en: { view: "View document", close: "Close", columns: ["No.", "Document", "Issued by", "Reference"], reference: "Available on request", register: "Document register" },
  ar: { view: "عرض الوثيقة", close: "إغلاق", columns: ["م", "الوثيقة", "جهة الإصدار", "المرجع"], reference: "متاح عند الطلب", register: "سجل الوثائق" },
} as const;

/**
 * The largest sizes the previous design showed the previews at (measured on its build, CSS pixels): no preview may be
 * shown larger in the new design. Cards: the landscape registration and the two portrait documents; the dialog: the
 * registration's versions and the portrait documents.
 */
const PREVIOUS = {
  1440: { cardLandscape: [380, 269], cardPortrait: [211, 298], dialogLandscape: [483, 341], dialogPortrait: [672, 952] },
  390: { cardLandscape: [233, 165], cardPortrait: [129, 183], dialogLandscape: [302, 214], dialogPortrait: [302, 428] },
} as const;

/** A run of seven or more digits (Western or Arabic-Indic): a registration or certificate number would be one. */
const DIGIT_RUN = /[0-9٠-٩۰-۹]{7,}/;
/** Digits written in groups (spaces, dots, dashes or slashes between them). */
const GROUPED = /\d(?:\d|[  ./-](?=\d))+/g;
/** The documents' own dates (issue and registration dates, from the company profile) are the one grouped exception. */
const DATE = /^(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/;

const trigger = (page: Page, doc: string) => page.locator(`#${doc} a[aria-haspopup="dialog"]`).last();
const plate = (page: Page, doc: string) => page.locator(`#${doc} a.ct-plate`);
const dialog = (page: Page) => page.locator("dialog[open]");

/** Rendered size, transform and filter of the certificate previews in a container. */
const previews = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((imgs) =>
    imgs.map((img) => {
      const r = img.getBoundingClientRect();
      const s = getComputedStyle(img);
      return {
        src: (img as HTMLImageElement).currentSrc,
        w: r.width,
        h: r.height,
        portrait: r.height > r.width,
        filter: s.filter,
        transform: s.transform,
        scale: s.scale,
      };
    }),
  );

// ---------------------------------------------------------------------------------------------------------------------
// The redacted files
// ---------------------------------------------------------------------------------------------------------------------

test("the eight redacted files are byte-identical to the baseline, and the site serves them as they are", async ({ request }) => {
  for (const [file, hash] of Object.entries(FILES)) {
    expect(sha1(readFileSync(join(process.cwd(), "public/media/certificates", file))), file).toBe(hash);
    const response = await request.get(`/media/certificates/${file}`);
    expect(response.status(), file).toBe(200);
    expect(response.headers()["content-type"], file).toBe("image/webp");
    expect(sha1(await response.body()), file).toBe(hash);
  }
});

test("previews are shown as they are: no filter or zoom, the same image service quality, never larger than before", async ({ browser }) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    for (const locale of ["en", "ar"] as const) {
      const phone = width < 800;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      await page.goto(`/${locale}/certificates`, { waitUntil: "networkidle" });
      const limits = PREVIOUS[width];
      const check = (list: Awaited<ReturnType<typeof previews>>, landscape: readonly number[], portrait: readonly number[], where: string) => {
        for (const p of list) {
          expect(p.src, where).toMatch(/\/_next\/image\?url=%2Fmedia%2Fcertificates%2F[a-z-]+\.webp&w=\d+&q=75$/);
          expect([p.filter, p.transform, p.scale], where).toEqual(["none", "none", "none"]);
          const [w, h] = p.portrait ? portrait : landscape;
          expect(p.w, `${where} width`).toBeLessThanOrEqual(w + 0.5);
          expect(p.h, `${where} height`).toBeLessThanOrEqual(h + 0.5);
        }
      };
      const cards = await previews(page, "main .ct-plate img");
      expect(cards).toHaveLength(3);
      check(cards, limits.cardLandscape, limits.cardPortrait, `${locale} ${width} cards`);
      // Hovering a plate lifts the preview a little; it never grows.
      if (!phone) {
        await plate(page, "vat-registration").hover();
        await page.waitForTimeout(700);
        const lifted = (await previews(page, "#vat-registration .ct-plate img"))[0];
        expect(lifted.w).toBeLessThanOrEqual(limits.cardPortrait[0] + 0.5);
        expect(lifted.scale).toBe("none");
      }
      for (const doc of DOCS) {
        await trigger(page, doc).click();
        await expect(dialog(page)).toBeVisible();
        await page.waitForTimeout(450);
        const shown = await previews(page, "dialog[open] img");
        expect(shown.length).toBe(doc === "commercial-registration" ? 2 : 1);
        check(shown, limits.dialogLandscape, limits.dialogPortrait, `${locale} ${width} dialog ${doc}`);
        await page.keyboard.press("Escape");
        await expect(dialog(page)).toHaveCount(0);
      }
      await context.close();
    }
  }
});

test("no run of seven or more digits in the page's text, alt text, labels or structured data", async ({ page }) => {
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`/${locale}/certificates`, { waitUntil: "networkidle" });
    const texts: string[] = [await page.locator("body").innerText()];
    const grouped: string[] = [await page.locator("main").innerText()];
    for (const doc of DOCS) {
      await trigger(page, doc).click();
      await expect(dialog(page)).toBeVisible();
      const inDialog = await dialog(page).innerText();
      texts.push(inDialog);
      grouped.push(inDialog);
      texts.push(...(await dialog(page).locator("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt") ?? ""))));
      await page.keyboard.press("Escape");
    }
    texts.push(
      ...(await page.evaluate(() =>
        [...document.querySelectorAll("[alt], [aria-label], [title], meta[content]")].flatMap((el) =>
          ["alt", "aria-label", "title", "content"].map((name) => el.getAttribute(name) ?? ""),
        ),
      )),
      await page.title(),
      JSON.stringify(await jsonLd(page)),
    );
    for (const text of texts) expect(text.match(DIGIT_RUN)?.[0], locale).toBeUndefined();
    // Numbers written in groups count too (a registration number with spaces); only the documents' dates have seven or more digits.
    for (const text of grouped) {
      for (const match of text.matchAll(GROUPED)) {
        if (match[0].replace(/\D/g, "").length >= 7) expect(match[0], locale).toMatch(DATE);
      }
    }
    // Nothing sensitive or unverified: no ISO claim, no licence expiry (the profile's copy shows 1447 AH).
    const all = texts.join("\n");
    expect(all).not.toMatch(/\bISO\b/);
    expect(all).not.toMatch(/expir/i);
    expect(all).not.toMatch(/1447/);
    expect(all).not.toMatch(/انتهاء/);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The register and the page
// ---------------------------------------------------------------------------------------------------------------------

test("the register: number, document, issuer and reference, in both languages; each document links to its card", async ({ page }) => {
  for (const locale of ["en", "ar"] as const) {
    const errors = trackErrors(page);
    await page.goto(`/${locale}/certificates`, { waitUntil: "networkidle" });
    const table = page.locator("main table");
    await expect(table.locator("caption")).toHaveText(LABELS[locale].register);
    await expect(table.locator('thead th[scope="col"]')).toHaveText([...LABELS[locale].columns]);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    for (const [i, doc] of DOCS.entries()) {
      const row = rows.nth(i);
      await expect(row.locator("td").first()).toHaveText(`0${i + 1}`);
      await expect(row.locator('th[scope="row"] a')).toHaveAttribute("href", `#${doc}`);
      await expect(row.locator("td").last()).toHaveText(LABELS[locale].reference);
      await expect(page.locator(`main li#${doc}`)).toHaveCount(1);
    }
    await expect(page.locator("main section#redaction")).toHaveCount(1);
    await expect(page.locator("#redaction ol > li")).toHaveCount(3);
    // The previews are not certified copies, and the note says so.
    await expect(page.locator("#redaction")).toContainText(locale === "en" ? "They are not certified copies." : "وليست نسخًا مصدّقة");
    expect((await jsonLd(page)).some((d) => d["@type"] === "WebPage")).toBe(true);
    expect(errors).toEqual([]);
  }
});

test("the register's links and the page's anchors land each document and the redaction note below the header", async ({ page }) => {
  await page.goto("/en/certificates", { waitUntil: "networkidle" });
  const landing = (selector: string) =>
    page.evaluate((sel) => {
      const top = document.querySelector(sel)!.getBoundingClientRect().top;
      const header = document.querySelector(".a2-header")!.getBoundingClientRect().bottom;
      return top - header;
    }, selector);
  // The page scrolls smoothly: wait for it to come to rest just below the header.
  for (const doc of DOCS) {
    await page.locator(`main table a[href="#${doc}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${doc}$`));
    await expect.poll(() => landing(`#${doc}`)).toBeLessThan(40);
    expect(await landing(`#${doc}`)).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
  await page.goto("/en/certificates#redaction", { waitUntil: "networkidle" });
  await expect.poll(() => landing("#redaction")).toBeLessThan(40);
  expect(await landing("#redaction")).toBeGreaterThanOrEqual(0);
});

test("phones: the register keeps the number and the document (with its issuer); nothing scrolls sideways", async ({ browser }) => {
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}/certificates`, { waitUntil: "networkidle" });
      const visibleColumns = await page.locator("main thead th").evaluateAll((ths) => ths.filter((th) => th.getBoundingClientRect().width > 0).length);
      expect(visibleColumns).toBe(2);
      await expect(page.locator("main tbody tr").first().locator(".ct-row-issuer")).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
    }
    await context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------------------------------------------------

test.describe("the document dialog", () => {
  test("keyboard: opens as a labelled modal, keeps focus inside, Escape closes it and focus returns to the trigger", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const open = trigger(page, "vat-registration");
    await expect(open).toHaveAttribute("href", "/media/certificates/vat-registration.webp");
    await expect(open).toHaveAttribute("aria-label", "View document: VAT Registration");
    await open.focus();
    await page.keyboard.press("Enter");
    const d = dialog(page);
    await expect(d).toBeVisible();
    expect(await d.evaluate((el) => el.matches(":modal"))).toBe(true);
    await expect(d).toHaveAttribute("aria-labelledby", "register-dialog-title");
    await expect(d.locator("#register-dialog-title")).toHaveText("VAT Registration");
    await expect(page.getByRole("dialog", { name: "VAT Registration" })).toBeVisible();
    await expect(d.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(d.locator("img")).toHaveCount(1);
    await expect(d.locator("img")).toHaveAttribute("alt", "VAT Registration — Numbers, QR codes and personal details are redacted in this preview.");
    await expect(d).toContainText(/redacted/i);
    // Focus stays inside the modal dialog.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("dialog") || document.activeElement === document.body)).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(open).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("the close button and a click on the backdrop close it; focus returns to the trigger", async ({ page }) => {
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const open = plate(page, "commercial-registration");
    await open.click();
    await expect(dialog(page).locator("img")).toHaveCount(2);
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(open).toBeFocused();

    await open.click();
    await expect(dialog(page)).toBeVisible();
    const box = (await dialog(page).boundingBox())!;
    // A point on the backdrop, outside the dialog's box.
    await page.mouse.click(Math.max(4, box.x - 12), Math.max(4, box.y - 12));
    await expect(dialog(page)).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  test("Arabic shows the Arabic version of a bilingual document first; the close button sits at the start of the reading side", async ({ page }) => {
    await page.goto("/ar/certificates", { waitUntil: "networkidle" });
    await trigger(page, "commercial-registration").click();
    const figures = page.locator("dialog[open] figure");
    await expect(figures).toHaveCount(2);
    await expect(figures.first().locator("figcaption")).toHaveText("النسخة العربية");
    await expect(figures.first().locator("img")).toHaveAttribute("src", /commercial-registration-ar/);
    await expect(figures.last().locator("figcaption")).toHaveText("النسخة الإنجليزية");
    // Mirrored: the close button on the left, the title on the right.
    const close = (await dialog(page).getByRole("button", { name: "إغلاق" }).boundingBox())!;
    const title = (await dialog(page).locator("#register-dialog-title").boundingBox())!;
    expect(close.x + close.width).toBeLessThan(title.x + 1);
    await dialog(page).getByRole("button", { name: "إغلاق" }).click();
    await expect(dialog(page)).toHaveCount(0);
    // English shows the English version first.
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    await trigger(page, "commercial-registration").click();
    await expect(page.locator("dialog[open] figure").first().locator("img")).toHaveAttribute("src", /commercial-registration-en/);
  });

  test("dark theme: the dialog takes the dark surfaces", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    await trigger(page, "commercial-activity-licence").click();
    await expect(dialog(page)).toBeVisible();
    expect(await dialog(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(28, 35, 45)");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("each trigger is a link to the redacted file itself", async ({ page, request }) => {
    await page.goto("/en/certificates", { waitUntil: "load" });
    const hrefs = await page.locator('main a[aria-haspopup="dialog"]').evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual([
      "/media/certificates/commercial-registration-en.webp",
      "/media/certificates/commercial-registration-en.webp",
      "/media/certificates/vat-registration.webp",
      "/media/certificates/vat-registration.webp",
      "/media/certificates/commercial-activity-licence.webp",
      "/media/certificates/commercial-activity-licence.webp",
    ]);
    for (const href of new Set(hrefs)) {
      const response = await request.get(href!);
      expect(response.headers()["content-type"]).toBe("image/webp");
    }
    // Arabic pages link the Arabic version of the registration first.
    await page.goto("/ar/certificates", { waitUntil: "load" });
    await expect(page.locator('#commercial-registration a[aria-haspopup="dialog"]').first()).toHaveAttribute("href", "/media/certificates/commercial-registration-ar.webp");
    await page.locator('#vat-registration a[aria-haspopup="dialog"]').first().click();
    await expect(page).toHaveURL(/\/media\/certificates\/vat-registration\.webp$/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The pointer and the dialog
// ---------------------------------------------------------------------------------------------------------------------

const pointer = (page: Page) => ({
  opacity: () => page.locator(".a2-cursor").evaluate((el) => getComputedStyle(el).opacity),
  /** The cursor the browser shows over the element at a point (the topmost element there). */
  cursorAt: (x: number, y: number) => page.evaluate(([px, py]) => getComputedStyle(document.elementFromPoint(px, py)!).cursor, [x, y]),
});

test.describe("the pointer while the dialog is open", () => {
  test("desktop mouse: the custom pointer gives way to the system cursor inside the dialog, and comes back on close", async ({ page }) => {
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const html = page.locator("html");
    const { opacity, cursorAt } = pointer(page);

    // Before: the custom pointer is on, and the page hides the system cursor.
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 320, { steps: 3 });
    await expect(html).toHaveAttribute("data-cursor-on", "");
    await expect(page.locator(".a2-cursor")).toHaveAttribute("data-shown", "");
    await expect.poll(opacity).toBe("1");
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe("none");

    // Open: the pointer hides and the system cursor is back over every part of the dialog and its backdrop.
    const open = plate(page, "vat-registration");
    await open.click();
    const d = dialog(page);
    await expect(d).toBeVisible();
    await expect(html).toHaveAttribute("data-cursor-modal", "");
    await expect.poll(opacity).toBe("0");
    const close = d.getByRole("button", { name: "Close" });
    const closeBox = (await close.boundingBox())!;
    const titleBox = (await d.locator("#register-dialog-title").boundingBox())!;
    await page.mouse.move(titleBox.x + 8, titleBox.y + titleBox.height / 2, { steps: 4 });
    expect(await cursorAt(titleBox.x + 8, titleBox.y + titleBox.height / 2)).toBe("auto");
    expect(await cursorAt(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)).toBe("pointer");
    expect(await d.evaluate((el) => [getComputedStyle(el).cursor, getComputedStyle(el, "::backdrop").cursor])).toEqual(["auto", "auto"]);
    const imageBox = (await d.locator("img").boundingBox())!;
    expect(await cursorAt(imageBox.x + 20, imageBox.y + 20)).not.toBe("none");
    // The close button is the element under the mouse there, and it works.
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".ct-close"), [closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2])).toBe(true);
    await close.click();

    // Closed: the custom pointer is back, and focus is on the trigger.
    await expect(dialog(page)).toHaveCount(0);
    await expect(html).not.toHaveAttribute("data-cursor-modal", "");
    await page.mouse.move(330, 330, { steps: 3 });
    await expect.poll(opacity).toBe("1");
    await expect(open).toBeFocused();

    // Escape and the backdrop clear the mark too.
    await open.click();
    await expect(html).toHaveAttribute("data-cursor-modal", "");
    await page.keyboard.press("Escape");
    await expect(html).not.toHaveAttribute("data-cursor-modal", "");
    await open.click();
    await expect(html).toHaveAttribute("data-cursor-modal", "");
    await page.mouse.click(4, 4);
    await expect(html).not.toHaveAttribute("data-cursor-modal", "");
  });

  test("Arabic: the same, with the dialog mirrored", async ({ page }) => {
    await page.goto("/ar/certificates", { waitUntil: "networkidle" });
    const { opacity, cursorAt } = pointer(page);
    await page.mouse.move(600, 300);
    await page.mouse.move(620, 320, { steps: 3 });
    await expect.poll(opacity).toBe("1");
    await plate(page, "commercial-registration").click();
    await expect(page.locator("html")).toHaveAttribute("data-cursor-modal", "");
    await expect.poll(opacity).toBe("0");
    const close = (await dialog(page).getByRole("button", { name: "إغلاق" }).boundingBox())!;
    expect(await cursorAt(close.x + close.width / 2, close.y + close.height / 2)).toBe("pointer");
    await dialog(page).getByRole("button", { name: "إغلاق" }).click();
    await page.mouse.move(640, 340, { steps: 3 });
    await expect.poll(opacity).toBe("1");
  });

  test("keyboard only: no custom pointer appears; the dialog opens, traps focus and returns it", async ({ page }) => {
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const open = trigger(page, "commercial-activity-licence");
    await open.focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
    await expect(dialog(page).getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-modal", "");
  });

  test("touch: tapping opens and closes the dialog; the system pointer is untouched", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/en/certificates", { waitUntil: "networkidle" });
    const open = plate(page, "vat-registration");
    await open.scrollIntoViewIfNeeded();
    await open.tap();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
    await dialog(page).getByRole("button", { name: "Close" }).tap();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
    expect(await horizontalOverflow(page)).toBe(0);
    await context.close();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("no custom pointer, and the dialog opens and closes without movement", async ({ page }) => {
      await page.goto("/en/certificates", { waitUntil: "networkidle" });
      await page.mouse.move(300, 300);
      await page.mouse.move(340, 340, { steps: 4 });
      await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
      await plate(page, "vat-registration").click();
      await expect(dialog(page)).toBeVisible();
      const motion = await dialog(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { translate: s.translate, transition: s.transitionDuration, opacity: s.opacity };
      });
      expect(motion).toEqual({ translate: "none", transition: "0s", opacity: "1" });
      expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe("auto");
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
    });
  });
});

test("decoration is hidden from assistive technology; the page's own text carries everything", async ({ page }) => {
  for (const locale of ["en", "ar"] as const) {
    await page.goto(`/${locale}/certificates`, { waitUntil: "networkidle" });
    const exposed = await page.evaluate(() =>
      [...document.querySelectorAll("main svg, main .ct-swatch, main .step-num, main .ct-plate-open, .a2-ambient, .a2-cursor")]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .map((el) => el.getAttribute("class")),
    );
    expect(exposed, locale).toEqual([]);
    // Card previews carry no alt text of their own: the link names the document.
    expect(await page.locator("main .ct-plate img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt")))).toEqual(["", "", ""]);
    await expect(page.locator("main .ct-plate").first()).toHaveAttribute("aria-label", `${LABELS[locale].view}: ${locale === "en" ? "Commercial Registration" : "السجل التجاري"}`);
  }
});
