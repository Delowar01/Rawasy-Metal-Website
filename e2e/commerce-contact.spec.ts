import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { company } from "../src/content/company";
import { contactPage } from "../src/content/contact";
import { HTML_LANG, horizontalOverflow, LOCALES, trackErrors } from "./helpers";

/**
 * Stage TM-2.2: the contact page in the Modern Commerce design (src/app/(commerce)/[locale]/contact, components in
 * src/components/commerce/contact/). The quote form's logic is the previous design's, unchanged: these tests pin its
 * outputs to explicit expected values (the same values the previous build produced for the same inputs). Migrated here:
 * the form, file, hand-off, direct-contact and no-JavaScript tests of stage-1c.spec.ts and the map tests of
 * redesign-v2.spec.ts. The generic inner-page checks (routes and search metadata, breadcrumbs, sideways scrolling,
 * reduced motion, no JavaScript) still run on this page from stage-1c.spec.ts.
 *
 * google.com cannot be reached from the test environment, so the map embed is answered with a stub page: the tests
 * check the embed's attributes and addresses in the page, not the live map (a manual check before launch).
 */

const ADDRESS = company.address.en.full;
const QUERY = encodeURIComponent(ADDRESS);
const EMBED = (locale: string) => `https://www.google.com/maps?q=${QUERY}&hl=${locale}&z=15&output=embed`;
const DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${QUERY}`;
const SEARCH = `https://www.google.com/maps/search/?api=1&query=${QUERY}`;
const WHATSAPP = "https://wa.me/966537368310";
const EMAIL = "rawasymetal@gmail.com";

const LABELS = {
  en: { submit: "Prepare request", email: "Send by email", whatsapp: "Send on WhatsApp", copy: "Copy request", copied: "Copied", edit: "Edit request", direct: "Direct contact" },
  ar: { submit: "تجهيز الطلب", email: "إرسال بالبريد الإلكتروني", whatsapp: "إرسال عبر واتساب", copy: "نسخ الطلب", copied: "تم النسخ", edit: "تعديل الطلب", direct: "تواصل مباشر" },
} as const;

async function stubGoogleMaps(context: BrowserContext) {
  await context.route(/^https:\/\/(www|maps)\.google\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>map</title><body style='margin:0;background:#dfe3e6'>" }),
  );
}

test.beforeEach(async ({ context }) => {
  await stubGoogleMaps(context);
});

const form = (page: Page) => page.locator("#quote form");
const submit = (page: Page) => page.locator('#quote form button[type="submit"]');
/** The chosen files, as their list shows them. */
const fileRows = (page: Page) => page.locator(".qf-file-list > li");
const fileNotices = (page: Page) => page.locator('.qf-files [aria-live="polite"] p');
const file = (name: string, size = 2048, fill = 7) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.alloc(size, fill) });
/** Where an element's top edge sits, and the header's bottom edge. */
const landing = (page: Page, selector: string) =>
  page.evaluate(
    (sel) => ({
      top: Math.round(document.querySelector(sel)!.getBoundingClientRect().top),
      header: Math.round(document.querySelector(".a2-header")!.getBoundingClientRect().bottom),
    }),
    selector,
  );

// ---------------------------------------------------------------------------------------------------------------------
// Golden outputs: for fixed inputs, the prepared request, the email link (subject and body, CRLF line ends), the WhatsApp
// link and the copied text, written out in full. The previous build produced exactly these values (TM-2.2 report).
// ---------------------------------------------------------------------------------------------------------------------

type Fixture = {
  locale: "en" | "ar";
  fill: Record<string, string>;
  select: Record<string, string>;
  files: string[];
  subject: string;
  request: string[];
};

const FIXTURES: Record<string, Fixture> = {
  "English, every field and three files": {
    locale: "en",
    fill: {
      fullName: "Test Person",
      company: "Example Steel Co.",
      email: "test@example.com",
      phone: "+966 50 123 4567",
      requirement: "20 plates, 6 mm mild steel, 1200 x 600",
      location: "Riyadh",
      message: "We need laser-cut steel plates as per the attached drawing, delivered by mid-October.",
    },
    select: { service: "laser-cutting", projectType: "custom-piece" },
    files: ["drawing.pdf", "plan.dwg", "photo.png"],
    subject: "Quote request — Laser Cutting — Example Steel Co.",
    request: [
      "Quote request",
      "",
      "Full name: Test Person",
      "Company: Example Steel Co.",
      "Email: test@example.com",
      "Phone: +966 50 123 4567",
      "Service: Laser Cutting",
      "Project type: Custom piece or one-off",
      "Estimated requirement: 20 plates, 6 mm mild steel, 1200 x 600",
      "Project location: Riyadh",
      "",
      "Project details:",
      "We need laser-cut steel plates as per the attached drawing, delivered by mid-October.",
      "",
      "Files to attach: drawing.pdf, plan.dwg, photo.png",
    ],
  },
  "Arabic, every field, Arabic-Indic digits and an Arabic file name": {
    locale: "ar",
    fill: {
      fullName: "أحمد علي",
      company: "شركة المثال للحديد",
      email: "ahmed@example.com",
      phone: "٠٥٠١٢٣٤٥٦٧",
      requirement: "٢٠ لوحًا، سماكة ٦ مم",
      location: "جدة",
      message: "نحتاج قص ألواح حديد بالليزر حسب المخطط المرفق، مع التسليم خلال أسبوعين.",
    },
    select: { service: "steel-structures", projectType: "production" },
    files: ["مخطط-الموقع.pdf", "detail.step"],
    subject: "طلب عرض سعر — الهياكل الحديدية — شركة المثال للحديد",
    request: [
      "طلب عرض سعر",
      "",
      "الاسم الكامل: أحمد علي",
      "الشركة: شركة المثال للحديد",
      "البريد الإلكتروني: ahmed@example.com",
      "رقم الجوال: ٠٥٠١٢٣٤٥٦٧",
      "الخدمة: الهياكل الحديدية",
      "نوع المشروع: قطع متكررة أو إنتاج بالكمية",
      "الاحتياج التقديري: ٢٠ لوحًا، سماكة ٦ مم",
      "موقع المشروع: جدة",
      "",
      "تفاصيل المشروع:",
      "نحتاج قص ألواح حديد بالليزر حسب المخطط المرفق، مع التسليم خلال أسبوعين.",
      "",
      "ملفات للإرفاق: مخطط-الموقع.pdf, detail.step",
    ],
  },
  "English, required fields only, not sure of the service": {
    locale: "en",
    fill: { fullName: "Sam Lee", email: "sam@example.org", phone: "0501234567", message: "Looking for a quote on scaffolding rental for a two-week job." },
    select: { service: "not-sure" },
    files: [],
    subject: "Quote request — Several services / not sure yet — Sam Lee",
    request: [
      "Quote request",
      "",
      "Full name: Sam Lee",
      "Email: sam@example.org",
      "Phone: 0501234567",
      "Service: Several services / not sure yet",
      "",
      "Project details:",
      "Looking for a quote on scaffolding rental for a two-week job.",
    ],
  },
  "Arabic, required fields only, Persian digits": {
    locale: "ar",
    fill: { fullName: "سارة", email: "sara@example.net", phone: "۰۵۰۱۲۳۴۵۶۷", message: "أرغب في عرض سعر لحفر لوحات تعريفية نحاسية." },
    select: { service: "not-sure" },
    files: [],
    subject: "طلب عرض سعر — أكثر من خدمة / لم أحدّد بعد — سارة",
    request: [
      "طلب عرض سعر",
      "",
      "الاسم الكامل: سارة",
      "البريد الإلكتروني: sara@example.net",
      "رقم الجوال: ۰۵۰۱۲۳۴۵۶۷",
      "الخدمة: أكثر من خدمة / لم أحدّد بعد",
      "",
      "تفاصيل المشروع:",
      "أرغب في عرض سعر لحفر لوحات تعريفية نحاسية.",
    ],
  },
};

/** The English full fixture's two links, byte for byte as the previous build wrote them. */
const EN_MAILTO =
  "mailto:rawasymetal@gmail.com?subject=Quote%20request%20%E2%80%94%20Laser%20Cutting%20%E2%80%94%20Example%20Steel%20Co.&body=Quote%20request%0D%0A%0D%0AFull%20name%3A%20Test%20Person%0D%0ACompany%3A%20Example%20Steel%20Co.%0D%0AEmail%3A%20test%40example.com%0D%0APhone%3A%20%2B966%2050%20123%204567%0D%0AService%3A%20Laser%20Cutting%0D%0AProject%20type%3A%20Custom%20piece%20or%20one-off%0D%0AEstimated%20requirement%3A%2020%20plates%2C%206%20mm%20mild%20steel%2C%201200%20x%20600%0D%0AProject%20location%3A%20Riyadh%0D%0A%0D%0AProject%20details%3A%0D%0AWe%20need%20laser-cut%20steel%20plates%20as%20per%20the%20attached%20drawing%2C%20delivered%20by%20mid-October.%0D%0A%0D%0AFiles%20to%20attach%3A%20drawing.pdf%2C%20plan.dwg%2C%20photo.png";
const EN_WHATSAPP =
  "https://wa.me/966537368310?text=Quote%20request%0A%0AFull%20name%3A%20Test%20Person%0ACompany%3A%20Example%20Steel%20Co.%0AEmail%3A%20test%40example.com%0APhone%3A%20%2B966%2050%20123%204567%0AService%3A%20Laser%20Cutting%0AProject%20type%3A%20Custom%20piece%20or%20one-off%0AEstimated%20requirement%3A%2020%20plates%2C%206%20mm%20mild%20steel%2C%201200%20x%20600%0AProject%20location%3A%20Riyadh%0A%0AProject%20details%3A%0AWe%20need%20laser-cut%20steel%20plates%20as%20per%20the%20attached%20drawing%2C%20delivered%20by%20mid-October.%0A%0AFiles%20to%20attach%3A%20drawing.pdf%2C%20plan.dwg%2C%20photo.png";

test.describe("golden outputs", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  for (const [name, fx] of Object.entries(FIXTURES)) {
    test(name, async ({ page }) => {
      const errors = trackErrors(page);
      const L = LABELS[fx.locale];
      await page.goto(`/${fx.locale}/contact`, { waitUntil: "networkidle" });
      const requests: string[] = [];
      page.on("request", (r) => {
        if (!/\/_next\/static\/|google\.com/.test(r.url())) requests.push(`${r.method()} ${r.url()}`);
      });

      for (const [field, value] of Object.entries(fx.fill)) await page.fill(`#quote-${field}`, value);
      for (const [field, value] of Object.entries(fx.select)) await page.selectOption(`#quote-${field}`, value);
      if (fx.files.length) await page.setInputFiles("#quote-files", fx.files.map((n) => file(n)));
      await page.getByRole("button", { name: L.submit }).click();

      const request = fx.request.join("\n");
      const heading = page.locator(".qf-ready h3");
      await expect(heading).toBeFocused();
      await expect(page.locator("#quote-request")).toHaveValue(request);

      const mailto = (await page.getByRole("link", { name: L.email }).getAttribute("href"))!;
      expect(mailto).toBe(`mailto:${EMAIL}?subject=${encodeURIComponent(fx.subject)}&body=${encodeURIComponent(fx.request.join("\r\n"))}`);
      const whatsapp = page.getByRole("link", { name: L.whatsapp });
      expect(await whatsapp.getAttribute("href")).toBe(`${WHATSAPP}?text=${encodeURIComponent(request)}`);
      await expect(whatsapp).toHaveAttribute("target", "_blank");
      await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
      if (name.startsWith("English, every field")) {
        expect(mailto).toBe(EN_MAILTO);
        expect(await whatsapp.getAttribute("href")).toBe(EN_WHATSAPP);
      }

      // Copying puts exactly the request on the clipboard and says so — it is not sending.
      await page.getByRole("button", { name: L.copy }).click();
      await expect(page.getByRole("button", { name: L.copied })).toBeVisible();
      await expect(page.locator('.qf-ready p[aria-live="polite"]')).toHaveText(L.copied);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(request);

      // The files to attach are named, never uploaded: nothing at all was requested while preparing and copying.
      if (fx.files.length) await expect(page.locator(".qf-attach-list li")).toHaveText(fx.files);
      expect(requests).toEqual([]);

      // Editing returns to the form with everything kept, focus on the first field.
      await page.getByRole("button", { name: L.edit }).click();
      await expect(page.locator("#quote-fullName")).toBeFocused();
      for (const [field, value] of Object.entries(fx.fill)) await expect(page.locator(`#quote-${field}`)).toHaveValue(value);
      expect(errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The form: validation, errors, files, hand-offs (migrated from stage-1c.spec.ts, selectors moved to the new markup)
// ---------------------------------------------------------------------------------------------------------------------

/** Waits for the script to take over the form (it sets `noValidate`): a click before that is the no-JS submission. */
const enhanced = (page: Page) => expect(form(page)).toHaveJSProperty("noValidate", true);

/**
 * Clicks "Prepare request" with the button already in view: when Playwright has to scroll to it, the page's smooth
 * scrolling (on once the page has loaded) can still be gliding as the click lands, beside the button.
 */
async function pressSubmit(page: Page) {
  await submit(page).evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await submit(page).click();
}

async function fillValidQuote(page: Page, locale: "en" | "ar") {
  await enhanced(page);
  await page.fill("#quote-fullName", locale === "ar" ? "أحمد علي" : "Test Person");
  await page.fill("#quote-email", "test@example.com");
  // Arabic-Indic digits are accepted in the phone number.
  await page.fill("#quote-phone", locale === "ar" ? "٠٥٠١٢٣٤٥٦٧" : "+966 50 123 4567");
  await page.selectOption("#quote-service", "laser-cutting");
  await page.fill(
    "#quote-message",
    locale === "ar" ? "نحتاج قص ألواح حديد بالليزر حسب المخطط المرفق." : "We need laser-cut steel plates as per the attached drawing.",
  );
}

test.describe("quote form", () => {
  test("validation, error summary and field errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    await expect(form(page)).toHaveJSProperty("noValidate", true);
    await page.getByRole("button", { name: "Prepare request" }).click();

    const summary = page.locator('[role="alert"]');
    await expect(summary.locator("li")).toHaveCount(5);
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.querySelector('[role="alert"]'))).toBe(true);
    for (const name of ["fullName", "email", "phone", "service", "message"]) {
      await expect(page.locator(`#quote-${name}`)).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator(`#quote-${name}`)).toHaveAttribute("aria-describedby", new RegExp(`quote-${name}-error`));
    }
    await expect(page.locator("#quote-company")).not.toHaveAttribute("aria-invalid", "true");
    // A hint stays described alongside the error.
    await expect(page.locator("#quote-phone")).toHaveAttribute("aria-describedby", "quote-phone-hint quote-phone-error");

    // Error links move focus to their field.
    await summary.locator("a").nth(1).click();
    await expect(page.locator("#quote-email")).toBeFocused();

    // Specific messages for malformed values; errors clear once fixed.
    await page.fill("#quote-email", "name@");
    await page.fill("#quote-phone", "12");
    await page.fill("#quote-message", "Too short");
    await expect(page.locator("#quote-email-error")).toContainText("valid email");
    await expect(page.locator("#quote-phone-error")).toContainText("8 to 15 digits");
    await expect(page.locator("#quote-message-error")).toContainText("at least 20 characters");
    await page.fill("#quote-email", "name@company.com");
    await expect(page.locator("#quote-email-error")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const locale of LOCALES) {
    test(`errors are shown by an edge, a message and an icon — not by colour alone (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      await enhanced(page);
      await pressSubmit(page);
      const field = page.locator("#quote-fullName");
      const edge = locale === "ar" ? "borderRightWidth" : "borderLeftWidth";
      const other = locale === "ar" ? "borderLeftWidth" : "borderRightWidth";
      expect(await field.evaluate((el, p) => getComputedStyle(el)[p as "borderLeftWidth"], edge)).toBe("4px");
      expect(await field.evaluate((el, p) => getComputedStyle(el)[p as "borderLeftWidth"], other)).toBe("1px");
      const message = page.locator("#quote-fullName-error");
      await expect(message).toHaveText(contactPage.form.errors.fullName[locale]);
      await expect(message.locator("svg[aria-hidden]")).toHaveCount(1);
      await expect(page.locator(".qf-summary-title svg[aria-hidden]")).toHaveCount(1);
      // Fixing the field clears its error state.
      await field.fill(locale === "ar" ? "أحمد علي" : "Test Person");
      expect(await field.evaluate((el, p) => getComputedStyle(el)[p as "borderLeftWidth"], edge)).toBe("1px");
      await expect(field).not.toHaveAttribute("aria-invalid", "true");
    });
  }

  test("files: up to five, 10 MB each, the eight allowed types; refusals are announced; removal; nothing is uploaded", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    const writes: string[] = [];
    page.on("request", (r) => void (r.method() !== "GET" && writes.push(`${r.method()} ${r.url()}`)));
    const input = page.locator("#quote-files");
    await expect(input).toHaveAttribute("accept", ".pdf,.dwg,.dxf,.step,.stp,.jpg,.jpeg,.png");
    await expect(input).toHaveAttribute("aria-describedby", "quote-files-note");

    // Types: the eight extensions (in any letter case) are accepted; anything else is refused by name.
    await input.setInputFiles([file("a.pdf"), file("b.dwg"), file("c.dxf"), file("d.step"), file("e.stp")]);
    await expect(fileRows(page)).toHaveCount(5);
    await expect(fileNotices(page)).toHaveCount(0);
    // A sixth file is one too many.
    await input.setInputFiles([file("f.jpg")]);
    await expect(fileRows(page)).toHaveCount(5);
    await expect(fileNotices(page)).toHaveText(["You can add up to 5 files."]);
    // Removing clears the notice and returns focus to the picker.
    for (let i = 5; i > 0; i -= 1) {
      await fileRows(page).first().getByRole("button", { name: /^Remove: / }).click();
      await expect(fileRows(page)).toHaveCount(i - 1);
    }
    await expect(fileNotices(page)).toHaveCount(0);
    await expect(input).toBeFocused();
    await input.setInputFiles([file("f.jpg"), file("g.JPEG"), file("h.png"), file("PLAN.PDF")]);
    await expect(fileRows(page)).toHaveCount(4);

    // Size: exactly 10 MB is accepted, one byte more is not. Unsupported types are refused.
    await fileRows(page).first().getByRole("button", { name: "Remove: f.jpg" }).click();
    await input.setInputFiles([file("limit.dwg", 10 * 1024 * 1024), file("over.dwg", 10 * 1024 * 1024 + 1), file("setup.exe", 16), file("notes.txt", 16)]);
    await expect(fileRows(page)).toHaveCount(4);
    await expect(fileRows(page).last()).toContainText("limit.dwg");
    await expect(fileRows(page).last()).toContainText("10.0 MB");
    await expect(fileNotices(page)).toHaveText([
      "\u2068over.dwg\u2069 is larger than 10 MB.",
      "\u2068setup.exe\u2069 isn't a supported file type.",
      "\u2068notes.txt\u2069 isn't a supported file type.",
    ]);
    // The notices are in a polite live region next to the picker.
    await expect(page.locator('.qf-files > [aria-live="polite"]')).toHaveCount(1);
    // The same file twice is listed once.
    await input.setInputFiles([file("h.png")]);
    await expect(fileRows(page)).toHaveCount(4);

    // Only the names go into the request; the files stay on the device.
    await fillValidQuote(page, "en");
    await pressSubmit(page);
    await expect(page.locator("#quote-request")).toHaveValue(/Files to attach: g\.JPEG, h\.png, PLAN\.PDF, limit\.dwg$/);
    expect(writes).toEqual([]);
  });

  for (const locale of LOCALES) {
    test(`the prepared request hands off to email and WhatsApp without claiming delivery (${locale})`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      await fillValidQuote(page, locale);
      await page.setInputFiles("#quote-files", [{ name: "drawing.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(2048) }]);
      await pressSubmit(page);

      const heading = page.locator("h3[tabindex='-1']");
      await expect(heading).toBeFocused();
      await expect(heading).toHaveText(contactPage.form.ready.title[locale]);
      await expect(page.locator(".qf-ready-body")).toHaveText(contactPage.form.ready.body[locale]);

      const mailto = page.locator(`a[href^="mailto:${EMAIL}?subject="]`);
      await expect(mailto).toHaveCount(1);
      const mailHref = decodeURIComponent((await mailto.getAttribute("href")) ?? "");
      expect(mailHref).toContain(locale === "ar" ? "طلب عرض سعر" : "Quote request");
      expect(mailHref).toContain("drawing.pdf");

      const whatsapp = page.locator(`a[href^="${WHATSAPP}?text="]`);
      await expect(whatsapp).toHaveAttribute("target", "_blank");
      await expect(page.locator("#quote-request")).toHaveValue(/test@example\.com/);
      await expect(page.locator("#quote-request")).toHaveAttribute("readonly", "");

      // The page never says the request was sent.
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/sent successfully|has been sent|thank you for your request|submitted|received|تم إرسال|أُرسل طلبك|تم استلام/i);

      // Editing keeps what was entered.
      await page.getByRole("button", { name: LABELS[locale].edit }).click();
      await expect(page.locator("#quote-fullName")).toBeFocused();
      await expect(page.locator("#quote-fullName")).toHaveValue(locale === "ar" ? "أحمد علي" : "Test Person");
      expect(errors).toEqual([]);
    });
  }

  test("a copy that fails says so and selects the text instead", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    });
    await fillValidQuote(page, "en");
    await pressSubmit(page);
    await page.getByRole("button", { name: "Copy request" }).click();
    await expect(page.locator(".qf-copy-failed")).toHaveText(contactPage.form.ready.copyFailed.en);
    await expect(page.locator("#quote-request")).toBeFocused();
    expect(await page.locator("#quote-request").evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBeGreaterThan(100);
  });

  test("by keyboard: the error summary, its links, the file picker and the ready state", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    await enhanced(page);
    await submit(page).focus();
    await page.keyboard.press("Enter");
    const holder = page.locator(".qf-summary");
    await expect(holder).toBeFocused();
    expect(await holder.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
    await page.keyboard.press("Tab");
    await expect(holder.locator("a").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#quote-fullName")).toBeFocused();

    // The file picker sits inside the drop zone, which shows the focus.
    await page.locator("#quote-message").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#quote-files")).toBeFocused();
    expect(await page.locator(".qf-drop").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");

    await fillValidQuote(page, "en");
    await submit(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".qf-ready h3")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Send by email" })).toBeFocused();
  });

  test("the ready state: a check mark, the three ways to send, the summary to copy — never a success message", async ({ page }) => {
    await page.goto("/ar/contact", { waitUntil: "networkidle" });
    await fillValidQuote(page, "ar");
    await pressSubmit(page);
    const ready = page.locator(".qf-ready");
    await expect(ready.locator(".qf-ready-mark svg")).toHaveCount(1);
    await expect(ready.locator(".qf-actions > *")).toHaveCount(3);
    await expect(ready.locator(".qf-actions a.btn-primary")).toHaveText(LABELS.ar.email);
    await expect(ready.locator(".qf-fallback")).toHaveText(contactPage.form.ready.fallback.ar);
    await expect(ready.getByLabel(contactPage.form.ready.preview.ar)).toHaveAttribute("dir", "auto");
    // The back arrow points against the reading direction: right in Arabic.
    const box = await ready.locator(".qf-edit").boundingBox();
    const arrow = await ready.locator(".qf-back").boundingBox();
    expect(arrow!.x).toBeGreaterThan(box!.x + box!.width / 2);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Without JavaScript: the form posts to the visitor's email app (migrated from stage-1c.spec.ts and extended)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form falls back to the visitor's email app", async ({ page, request }) => {
    await page.goto("/en/contact", { waitUntil: "load" });
    await expect(form(page)).toHaveAttribute("action", `mailto:${EMAIL}?subject=Quote%20request`);
    await expect(form(page)).toHaveAttribute("method", "post");
    await expect(form(page)).toHaveAttribute("enctype", "text/plain");
    await expect(form(page)).not.toHaveAttribute("novalidate", /.*/);
    await expect(page.locator("#quote-files")).toBeHidden();
    await expect(page.locator(".qf-files")).toBeHidden();
    expect(await form(page).locator("[required]").evaluateAll((els) => els.map((el) => el.id))).toEqual([
      "quote-fullName",
      "quote-email",
      "quote-phone",
      "quote-service",
      "quote-message",
    ]);
    // Playwright's no-JS mode still parses <noscript> as text, so check the server HTML for the note.
    const html = await (await request.get("/en/contact")).text();
    expect(html).toMatch(/<noscript><p class="qf-noscript">JavaScript is off/);
  });

  test("native validation stops an empty request; a complete one opens the email app with the details as plain text", async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.enable");
    const navigations: string[] = [];
    cdp.on("Page.frameRequestedNavigation", (event) => navigations.push(event.url));
    await page.goto("/en/contact", { waitUntil: "load" });
    navigations.length = 0;

    await submit(page).click();
    await page.waitForTimeout(500);
    expect(navigations).toEqual([]);
    expect(await form(page).locator("input:invalid, select:invalid, textarea:invalid").evaluateAll((els) => els.map((el) => el.id))).toEqual([
      "quote-fullName",
      "quote-email",
      "quote-phone",
      "quote-service",
      "quote-message",
    ]);

    await page.fill("#quote-fullName", "Test Person");
    await page.fill("#quote-email", "test@example.com");
    await page.fill("#quote-phone", "0501234567");
    await page.selectOption("#quote-service", "laser-cutting");
    await page.fill("#quote-message", "We need laser-cut steel plates as per the attached drawing.");
    await submit(page).click();
    await expect.poll(() => navigations.length).toBe(1);
    expect(navigations[0]).toBe(
      `mailto:${EMAIL}?subject=Quote%20request&body=` +
        "fullName%3DTest%20Person%0D%0Acompany%3D%0D%0Aemail%3Dtest%40example.com%0D%0Aphone%3D0501234567%0D%0Aservice%3Dlaser-cutting%0D%0A" +
        "projectType%3D%0D%0Arequirement%3D%0D%0Alocation%3D%0D%0Amessage%3DWe%20need%20laser-cut%20steel%20plates%20as%20per%20the%20attached%20drawing.%0D%0A%0D%0A",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The page: shell, hero, direct contact, anchors, RTL
// ---------------------------------------------------------------------------------------------------------------------

test.describe("page", () => {
  for (const locale of LOCALES) {
    test(`the Modern Commerce shell marks Contact as the current page; the language switch opens the other Contact (${locale})`, async ({ page }) => {
      const errors = trackErrors(page);
      const other = locale === "en" ? "ar" : "en";
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      await expect(page.locator("body.mc")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
      // Contact is the current page in the header bar and in the phone menu, and nothing else is.
      const current = page.locator(".a2-header a[aria-current='page']");
      expect(await current.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([`/${locale}/contact`, `/${locale}/contact`]);
      await expect(page.locator(".a2-header a.nav-link[aria-current='page']")).toBeVisible();
      await expect(page.locator(`.a2-header .a2-lang a[hreflang="${HTML_LANG[other]}"]`).first()).toHaveAttribute("href", `/${other}/contact`);
      await expect(page.locator("footer.a2-footer")).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
      // No floating WhatsApp button (decision D7): WhatsApp is a contact row, inside the page flow.
      expect(await page.locator("a[href^='https://wa.me/']").evaluateAll((els) => els.filter((el) => getComputedStyle(el).position === "fixed").length)).toBe(0);

      // The theme switch works on this page too.
      const theme = await page.locator("html").getAttribute("data-theme");
      await page.locator('.a2-header button[aria-pressed="false"]:visible').first().click();
      await expect(page.locator("html")).not.toHaveAttribute("data-theme", theme ?? "light");
      expect(errors).toEqual([]);
    });

    test(`split hero: the trail, label, title and lead beside direct contact; the two actions jump to the form and the map (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      const hero = page.locator(".ip-hero");
      await expect(hero.locator("h1#page-title")).toHaveText(contactPage.hero.title[locale]);
      await expect(hero.locator(".eyebrow")).toHaveText(contactPage.hero.eyebrow[locale]);
      await expect(hero.locator(".t-lead")).toHaveText(contactPage.hero.intro[locale]);
      await expect(hero.getByRole("link", { name: contactPage.actions.quote[locale] })).toHaveAttribute("href", `/${locale}/contact#quote`);
      await expect(hero.getByRole("link", { name: contactPage.actions.findUs[locale] })).toHaveAttribute("href", `/${locale}/contact#location`);

      const group = page.getByRole("group", { name: LABELS[locale].direct });
      const links = group.getByRole("link");
      await expect(links).toHaveCount(5);
      expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
        "tel:+966537368310",
        "tel:+966552616189",
        WHATSAPP,
        `mailto:${EMAIL}`,
        `/${locale}/contact#location`,
      ]);
      // Numbers and the email stay left to right in Arabic too.
      for (const value of ["+966 53 736 8310", "+966 55 261 6189", EMAIL]) {
        await expect(group.locator(`[dir="ltr"]`, { hasText: value }).first()).toBeVisible();
      }
      const text = await hero.locator(".a2-read").boundingBox();
      const aside = await group.boundingBox();
      expect(aside!.width).toBeGreaterThan(300);
      // Beside the text on a desktop screen, after it in the reading direction.
      if (locale === "en") expect(aside!.x).toBeGreaterThanOrEqual(text!.x + text!.width);
      else expect(aside!.x + aside!.width).toBeLessThanOrEqual(text!.x);
    });
  }

  test("direct contact links (migrated)", async ({ page }) => {
    await page.goto("/ar/contact", { waitUntil: "networkidle" });
    const sheet = page.getByRole("group", { name: "تواصل مباشر" });
    await expect(sheet.locator('a[href="tel:+966537368310"]')).toHaveCount(1);
    await expect(sheet.locator('a[href="tel:+966552616189"]')).toHaveCount(1);
    await expect(sheet.locator(`a[href="mailto:${EMAIL}"]`)).toHaveCount(1);
    await expect(sheet.locator(`a[href^="${WHATSAPP}"]`)).toHaveAttribute("rel", /noopener/);
    await expect(sheet.locator(`a[href^="${WHATSAPP}"]`)).toHaveAttribute("target", "_blank");
    await expect(sheet.locator(`a[href^="${WHATSAPP}"] .sr-only`)).toHaveText(" (يفتح في نافذة جديدة)");
  });

  test("a select's arrow sits at the end of the line: right in English, left in Arabic", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      const select = page.locator("#quote-service");
      expect(await select.evaluate((el) => getComputedStyle(el).appearance)).toBe("none");
      const s = (await select.boundingBox())!;
      const a = (await page.locator("#quote-service + .qf-select-arrow").boundingBox())!;
      if (locale === "en") expect(a.x).toBeGreaterThan(s.x + s.width - 48);
      else expect(a.x + a.width).toBeLessThan(s.x + 48);
      // The text keeps clear of the arrow.
      const pad = await select.evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineEnd));
      expect(pad).toBeGreaterThanOrEqual(40);
    }
  });

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    test(`#quote and #location land just below the sticky header at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const locale of LOCALES) {
        for (const id of ["quote", "location"]) {
          await page.goto(`/${locale}/contact#${id}`, { waitUntil: "networkidle" });
          await expect
            .poll(async () => {
              const { top, header } = await landing(page, `#${id}`);
              return top >= header && top - header <= 24;
            }, { message: `/${locale}/contact#${id}` })
            .toBe(true);
        }
      }
    });

    test(`the homepage's Start a Project lands on the form at ${width} px, shown at once`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const locale of LOCALES) {
        await page.goto(`/${locale}`, { waitUntil: "networkidle" });
        await page.locator(".a2-hero .btn-primary").click();
        await page.waitForURL(`**/${locale}/contact#quote`);
        // Visible immediately: the quote section has no reveal to wait for.
        expect(await page.locator("#quote [data-reveal]").count()).toBe(0);
        expect(await page.locator(".cp-form").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
        await expect
          .poll(async () => {
            const { top, header } = await landing(page, "#quote");
            return top >= header && top - header <= 24;
          })
          .toBe(true);
        await expect(page.locator("#quote h2")).toBeInViewport();
      }
    });
  }

  test("phones: the menu's language switch opens the other Contact; nothing scrolls sideways", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await stubGoogleMaps(context);
    const page = await context.newPage();
    for (const locale of LOCALES) {
      const other = locale === "en" ? "ar" : "en";
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      await page.locator("details[data-sheet] > summary").tap();
      const sheet = page.locator("details[data-sheet] .a2-sheet");
      await expect(sheet.locator(`a[hreflang="${HTML_LANG[other]}"]`)).toHaveAttribute("href", `/${other}/contact`);
      await expect(sheet.locator("a[aria-current='page']")).toHaveAttribute("href", `/${locale}/contact`);
      expect(await horizontalOverflow(page)).toBe(0);
    }
    await context.close();
  });

  test("phones: a long file name is shortened in the list and its remove button stays on screen", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
    await stubGoogleMaps(context);
    const page = await context.newPage();
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    const name = "north-elevation-drawing-revision-three-final-approved-for-fabrication.pdf";
    await page.locator("#quote-files").setInputFiles([file(name)]);
    const row = fileRows(page).first();
    await row.scrollIntoViewIfNeeded();
    const remove = (await row.getByRole("button", { name: `Remove: ${name}` }).boundingBox())!;
    const form = (await page.locator(".cp-form").boundingBox())!;
    expect(remove.x + remove.width).toBeLessThanOrEqual(form.x + form.width);
    expect(await row.locator(".qf-file-name").evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await page.locator(".qf-files").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Location and map (migrated from redesign-v2.spec.ts; the embed and its links are unchanged: decision D10)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("location and map", () => {
  for (const locale of LOCALES) {
    test(`the embed, its title, loading, referrer policy and full screen, and both Google Maps links, unchanged (${locale})`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${locale}/contact`, { waitUntil: "networkidle" });
      const map = page.locator("#location iframe");
      await expect(map).toHaveCount(1);
      expect(
        await map.evaluate((el) => Object.fromEntries([...el.attributes].filter((a) => a.name !== "class").map((a) => [a.name, a.value]))),
      ).toEqual({
        src: EMBED(locale),
        title: contactPage.location.mapTitle[locale],
        loading: "lazy",
        referrerpolicy: "strict-origin-when-cross-origin",
        allowfullscreen: "",
      });
      const directions = page.getByRole("link", { name: new RegExp(contactPage.location.directions[locale]) });
      await expect(directions).toHaveAttribute("href", DIRECTIONS);
      await expect(directions).toHaveAttribute("target", "_blank");
      await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
      const open = page.getByRole("link", { name: new RegExp(contactPage.location.openMap[locale]) });
      await expect(open).toHaveAttribute("href", SEARCH);
      await expect(open).toHaveAttribute("target", "_blank");
      await expect(page.locator("#location address")).toContainText(locale === "ar" ? "حي المشاعل" : "Al Mashael");
      await expect(page.locator("#location figcaption")).toHaveText(contactPage.location.mapCaption[locale]);
      // Until the map loads (or if it cannot), the frame's surface shows the address — decoration, hidden from assistive technology.
      const surface = page.locator("#location .cp-map-surface");
      await expect(surface).toHaveAttribute("aria-hidden", "true");
      await expect(surface).toHaveText(company.address[locale].full);
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

  test("the pointer hides over the map (the frame takes the mouse) and comes back on the page", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "networkidle" });
    const frame = page.locator("#location iframe");
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toBeInViewport();
    const box = (await frame.boundingBox())!;
    const card = (await page.locator("#location .cp-loc").boundingBox())!;
    const cursor = page.locator(".a2-cursor");
    const opacity = () => cursor.evaluate((el) => getComputedStyle(el).opacity);
    const html = page.locator("html");

    await page.mouse.move(card.x + 40, card.y + card.height / 2, { steps: 4 });
    await expect(html).toHaveAttribute("data-cursor-on", "");
    await expect(cursor).toHaveAttribute("data-shown", "");
    await expect.poll(opacity).toBe("1");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(html).toHaveAttribute("data-cursor-away", "");
    await expect.poll(opacity).toBe("0");

    await page.mouse.move(card.x + 40, card.y + card.height / 2, { steps: 8 });
    await expect(html).not.toHaveAttribute("data-cursor-away", "");
    await expect.poll(opacity).toBe("1");
  });

  test("touch: tapping the map leaves the system pointer alone", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await stubGoogleMaps(context);
    const page = await context.newPage();
    await page.goto("/en/contact#location", { waitUntil: "networkidle" });
    const frame = page.locator("#location iframe");
    await frame.scrollIntoViewIfNeeded();
    const box = (await frame.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-away", "");
    await expect(page.locator("html")).not.toHaveAttribute("data-cursor-on", "");
    await context.close();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Decoration and dark theme
// ---------------------------------------------------------------------------------------------------------------------

test("icons and the map's surface are decoration; the page's own text carries everything", async ({ page }) => {
  await page.goto("/en/contact", { waitUntil: "networkidle" });
  expect(await page.locator("main svg").evaluateAll((els) => els.filter((el) => el.getAttribute("aria-hidden") !== "true").length)).toBe(0);
  expect(await page.locator("main .step-num").evaluateAll((els) => els.filter((el) => el.getAttribute("aria-hidden") !== "true").length)).toBe(0);
});

test("dark theme: the form card and fields take the dark surfaces", async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem("rawasy-theme", "dark"));
  await page.goto("/ar/contact", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const colour = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await colour(page.locator(".cp-form"))).toBe("rgb(28, 35, 45)");
  expect(await colour(page.locator("#quote-fullName"))).toBe("rgb(28, 35, 45)");
  expect(await colour(page.locator(".qf-drop"))).toBe("rgb(34, 42, 53)");
});
