import { expect, test, type Page } from "@playwright/test";
import { skipIntro } from "./helpers";

/**
 * Stage 1C-V visual system on the pages still in that design (the Capabilities and project placeholders and the previous
 * design's 404): decoration semantics. The ambient layers, active states and the pointer light retired with the pages
 * that drew them, as those pages moved to the Modern Commerce design (TM-1 to TM-2.5); the notes below say where each
 * behaviour is checked now.
 */

test.beforeEach(async ({ context }) => {
  await skipIntro(context);
});

/** Decorative layers of the visual system. None of them may reach assistive technology. */
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
  ".wipe-line",
  ".client-line",
  ".service-row-edge",
  ".step-rail",
  ".step-node",
  ".outline-num",
  ".proj-shade",
  ".proj-flag",
  ".filter-chip-mark",
  ".map-plate",
  ".logo-toggle-track",
].join(", ");

function exposedDecoration(page: Page) {
  return page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].filter((el) => !el.closest('[aria-hidden="true"]')).map((el) => el.className),
    DECORATION,
  );
}

test("decorative layers are hidden from assistive technology", async ({ page }) => {
  test.setTimeout(120_000);
  // Contact (TM-2.2), About, Industries, Clients and Certificates (TM-2.3), the services overview and the six service
  // pages (TM-2.4) and the projects overview (TM-2.5) moved to the Modern Commerce design (their decoration:
  // commerce-contact, commerce-company, commerce-certificates, commerce-services and commerce-projects.spec.ts); the pages
  // left in this design stand in.
  for (const path of ["/en/capabilities", "/ar/capabilities", "/en/projects/geometric-lanterns", "/ar/projects/clock-tower-landmark", "/en/projects/not-a-project"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    expect(await exposedDecoration(page), path).toEqual([]);
  }
});

// Ambient motion — "drifting grids and scan lines run only while on screen", "ambient motion rests while the page is being
// scrolled" and, with reduced motion, "layers stay still and scan lines are hidden" — ran on the projects overview, the
// last page with this design's section backdrops and scan lines. It moved to the Modern Commerce design in Stage TM-2.5,
// where that decoration is retired (decision D8); no page left in this design draws it. commerce-projects.spec.ts checks
// the same behaviour of the Modern Commerce ambient on the projects overview: it rests while the page scrolls, runs again
// after, and holds still with reduced motion (the homepage's own test is in commerce-home.spec.ts).

// "line work draws itself once revealed, without a resize" moved to commerce-services.spec.ts with the last drawings
// that used it (the service pages, Stage TM-2.4): "the four other drawings draw themselves once when revealed" checks
// the same Chromium regression on their Modern Commerce versions (an inherited --draw, not an attribute selector).

// "the pointer light follows a mouse over the services plate": the pointer light retired with its last page (the
// services overview, Stage TM-2.4; decision D8). commerce-services.spec.ts checks the Modern Commerce pointer there
// (desktop mouse only; never on touch or with reduced motion).

// "no pointer light on touch" (ambient motion on touch screens): the pointer light retired with the services overview
// (Stage TM-2.4, D8); commerce-services.spec.ts checks that the Modern Commerce pointer never switches on for touch.

// Active states:
// - "the services overview marks the row being read" moved to commerce-services.spec.ts with the overview (Stage TM-2.4):
//   "the index marks the service being read and jumps to it from the keyboard (one marked at a time)".
// - "legal contents mark the section being read" moved to commerce-inner.spec.ts with the legal pages (Stage TM-2.1).
// - "focus shows the same frame as hover" ran on the projects overview's cards, the last links with this design's
//   technical frame; the frame retired with the page's move (Stage TM-2.5, D8). commerce-projects.spec.ts checks that
//   keyboard focus gives the highlight cards the same raised state as hover.
