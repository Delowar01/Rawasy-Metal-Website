# RAWASY Metal Website — Modern Commerce Theme Exploration (Theme Lab)

**Date:** 2026-09-25 · **Branch:** `claude/new-session-5eijs6` · **Commit:** `3d9b4c6` (report in the following commit)

**Status: three theme options (A, B and C) are built as isolated previews and returned for your visual review. I have not picked a winner.**
Nothing else was started. Stages 1E–1J and Phase 2 are on hold. The current website is unchanged and stays live. Stage 1D still awaits your review.

---

## 1. Summary

- I built an isolated **theme lab** with three genuinely different Modern Commerce directions:
  - **A · Clean Premium Commerce**
  - **B · Bold Industrial Commerce**
  - **C · Minimal Luxury Commerce**
- Each option is a complete homepage plus a design-system sheet:
  - Homepage sections: header, hero, who we are, services, machinery, projects, clients, call to action and contact, footer.
  - Design-system sheet: palette, English and Arabic type, radius, borders, shadows, buttons with their states, cards, icons, tags, form fields, header and footer.
- Every option works in English (LTR) and Arabic (RTL), on desktop, tablet and phone, and in the light theme.
- The three options differ in layout, composition, type, colour, depth and motion, not just in colour.
- All content, figures and photos come from the existing content layer. No new facts, and no rewritten copy.
- The engraving cover, the renders and the AI-watermarked or authorship-flagged photos stay out.
- The existing site is proven unchanged:
  - all 104 prerendered pages are identical to the approved build;
  - the site CSS is byte-identical;
  - the sitemap and robots.txt are unchanged;
  - the 121 existing browser tests pass.

## 2. How to view

- Start the site with `npm run build && npm start`, or `npm run dev`.
- **English previews:**
  - `/theme-lab/en/modern-commerce-a`
  - `/theme-lab/en/modern-commerce-b`
  - `/theme-lab/en/modern-commerce-c`
- **Arabic:** replace `en` with `ar`.
- **Design-system sheets:** add `/system`, e.g. `/theme-lab/en/modern-commerce-b/system`.
- `/theme-lab` redirects to option A in your language.
- The dark **lab bar** at the top switches between A, B and C, homepage and design system, and English and Arabic. It is preview chrome, not part of any option.
- Links inside the previews open the current website's pages, which still have the old design.

---

## 3. Response to the brief, section by section

**§1 — Current site not modified; isolated previews.**
- The routes are `/theme-lab/{en|ar}/modern-commerce-{a|b|c}` plus `/system`.
- They have their own root layout and stylesheet: no site header, footer, loader, cursor or site CSS.
- They are noindex twice over: the `<meta name="robots" content="noindex, nofollow">` tag and an `X-Robots-Tag: noindex, nofollow` header.
- They are not in `routes`, the sitemap or any navigation, and no site page links to them (tested).
- Existing pages:
  - The HTML of all 104 pages matches the approved build. The RSC and meta files (518 and 109) match too, once build IDs and asset hashes are normalised.
  - The one framework-level difference is the router's list of static siblings of `[locale]`, which now contains `"theme-lab"`. It tells Next.js that `/theme-lab` is not a language.
  - The site CSS files are byte-identical on all 104 pages.
- Two shared files changed, and only for isolation:
  - `src/proxy.ts` lets `/theme-lab/{locale}/…` through and redirects bare lab URLs.
  - `src/app/globals.css` gains two `@source not` lines, so lab classes never enter the site CSS.

**§2 — Three genuinely different directions.**

| | A · Clean Premium Commerce | B · Bold Industrial Commerce | C · Minimal Luxury Commerce |
| --- | --- | --- | --- |
| Character | Bright, crisp, highly readable, "product catalogue" commerce | Confident, high-contrast manufacturing supplier | Premium, restrained, international |
| Page base | Cool light grey `#F4F6F9` with white raised cards | Steel grey `#EEF0F3`, graphite bands `#14171B`, white product cards | Porcelain `#FAFAF8`, stone `#F2F1ED`, white sections |
| Hero | Split: headline, figures and CTAs on the left; framed laser photo with floating machine and service cards on the right; service quick-bar underneath | Full-bleed graphite hero with the steel-hall photo bleeding off the edge; huge bold headline; mono spec strip; white service tiles overlapping the hero edge | Centred headline in large light type; three-photo mosaic with quiet labels |
| Services | Six equal image cards with icon chips, tags and actions | Two feature panels (photo + checklist) and four image-overlay cards | Six borderless "product" tiles with framed photos and quiet links |
| Machinery | Featured product panel and a list of five horizontal machine cards | Dark "showroom": six product cards with power badges and spec footers | Spotlight panel for one machine and a row of five small cards |
| Projects | Bento grid with floating white labels | Justified photo gallery with overlay titles and an orange "view all" tile | Four portrait frames with captions below |
| Clients | 7-column grid of white tiles, greyscale to colour on hover | Colour logos in bordered tiles | Hairline grid of monochrome logos |
| CTA / contact | Navy panel (Riyadh at night behind) with steps and white contact rows | Full orange band with dark contact cards | Centred statement, steps, three hairline contact columns and a compliance line |
| Footer | Navy, four columns | Black with an orange top rule, bold statement | Stone, understated, with a charcoal button |

**§3 — Current visual language removed.**
- None of the three uses:
  - blueprint or coordinate grids, axes or measurement rulers;
  - drafting references or engineering-sheet compositions;
  - scan lines, technical frames or perforated fields;
  - outlined numerals or decorative project numbering;
  - a warm beige page, or magazine-style asymmetry.
- Mono type survives only for machine figures in B (for example `12,000 W`).
- Numbers appear only for the three "how it works" steps.

**§4 — Commercial clarity.** All three options make every item below immediately clear:

| Item | How it is shown |
| --- | --- |
| Who RAWASY is | The who-we-are statement |
| What it provides | Six services |
| Machinery and capabilities | All six machines, with power where it is sourced |
| Projects | Six (A, B) or four (C) featured projects |
| Industries | A: chips · B: tags · C: a text line |
| Clients | All 21 logos, with no counts |
| Certificates and compliance | A: "Registered. Licensed. Accountable." in the contact panel · B: the three registrations in the "What we do" panel · C: a compliance line under contact |
| Contact and quotation | Phone, WhatsApp, email, address and "Get a Quote" / "Start a Project" |

The presentation formats used: service cards, image cards, feature panels, capability blocks, CTA panels, project cards, icon-and-text cards, contact cards and field styles.

**§5 — Cards.**
- Every option mixes standard, wide, image, feature and horizontal cards (see the "Cards" block of each design-system sheet).
- Hover behaviour:
  - A: lifts 4 px with a stronger shadow.
  - B: lifts 6 px and wipes in a 3 px orange top edge.
  - C: a quiet 3 px lift, with the name underline drawing in.
- There is a whole-card click area, and every card keeps a visible keyboard focus ring.

**§6 — Borders.** Each option has visible subtle, default, strong and active tiers:
- **A:** `#E5E9EF`, `#D5DBE3`, `#B9C3CF`, active 2 px orange.
- **B:** `#DCE0E5`, `#C9CFD7`, 1.5 px `#A6AFBA`, active 3 px orange edge; 13 % white lines on graphite.
- **C:** hairlines `#EBEAE6`, `#DFDDD8`, `#C7C4BD`, active 1 px charcoal.

**§7 — Shadows.** Each option has card, raised, hover, floating, image and inset levels:
- **A:** soft contact shadows plus ambient ones.
- **B:** deeper shadows, a "pressed base" under its buttons, and an on-dark level.
- **C:** wide, low, diffuse shadows.

The dark-theme equivalents follow after approval.

**§8 — Radius.** No option is pill-shaped everywhere, and not every container is rounded.

| | Tags | Fields | Buttons | Cards | Panels | Other |
| --- | --- | --- | --- | --- | --- | --- |
| A | 6 | 8 | 10 | 16 | 24 | Badges are pills |
| B | 4 | 6 | 8 | 12 | 16 | The firmest set |
| C | Pill | 10 | 12 | 16 | 24 | Image frames 20 |

**§9 — English typography.** Two or three English typefaces per option:
- **A:** Plus Jakarta Sans (display 800, headings 760) and Inter (body, UI).
- **B:** Outfit (display 800, headings 750) and Inter, with Geist Mono for machine figures only.
- **C:** Urbanist (display and headings 500, light 300 figures) and DM Sans (body 17–20 px, line height 1.7).

Sora and Manrope are not used. All faces are self-hosted through `next/font`, and each option loads only its own.

**§10 — Arabic typography.**
- **A:** Tajawal for headings and semibold UI (500–800) + IBM Plex Sans Arabic for body (400/500 only).
- **B:** Alexandria for headings and bold UI + Noto Sans Arabic for body (400/600).
- **C:** Readex Pro for both headings and body (one variable family).
- All three test the faces you named; Noto Kufi is not used.
- Arabic headings are modern and never decorative.
- Arabic is never letter-spaced, and English uppercase kickers become normal-case Arabic.
- Body text uses line heights of 1.85–1.9.
- **Your call:** the Arabic body must stay readable; please judge the three Arabic pairs on the Arabic pages and in the specimens on each design-system sheet.

**§11 — Colour.**
- RAWASY orange `#F15F22` is the anchor and the primary action in all three.
- Supporting colours:
  - A: commercial navy, steel blue, teal, brass and blue-grey.
  - B: graphite, steel blue (with a light variant for dark bands), teal and brass.
  - C: muted steel, sand and deep teal.
- Colour appears in surfaces, section backgrounds, icon chips, tags, badges, image stages, hover states and the CTA or footer bands. Body text stays neutral.
- Colour roles and contrast:
  - Small text on tints passes AA.
  - The brass tag colours were darkened after the audit (see §4 of QA below).
  - Primary buttons use dark text on orange (5.4–5.8 : 1), as in V2.

**§12 — Light theme first.** Only the light theme is built:
- **A** is bright white and grey.
- **B** is light with graphite bands.
- **C** is porcelain and stone.
- None of them is beige editorial or a dark industrial page.
- The header shows the light/dark control with dark disabled and marked "Dark theme follows approval".

**§13 — Homepage demo.** Every option has all the sections the brief asked for.

**§14 — Hero.**
- Every hero uses real metal photography, not a drafting board.
- Every hero carries the approved headline, "Engineering metal into possibility.", the value proposition and two CTAs ("Start a Project", "Explore Our Capabilities").
- Sourced figures appear in A and B (12,000 W peak fibre-laser power, 360° bevel cutting, 4 laser systems, 6 service lines) and below the hero in C.
- I did not rewrite the headline (§25). A more commercial headline can be considered once a theme is chosen.

**§15 — Services.** Each option tests a different format:
- A: three-column image cards.
- B: feature panels plus image-overlay cards.
- C: borderless product tiles.

Each service has an image or icon, a name, a short description and an action. Laser Engraving shows an icon panel, because its only photo (third-party branding and serial numbers) and the renders stay off featured spots.

**§16 — Machinery as a product showcase.**
- The machines are cut-out product photos on lit "stages".
- Each shows its name, category, capability and rated power where the profile states it. Machines without a sourced power show their category, or "—" in B's spec row.
- Each links to its related service and carries a CTA ("Request a Quote" in A, "All machinery" in every option).
- No invented specifications.

**§17 — Projects.**
- Project cards are photo-led with categories; reference numbers never appear.
- A and B show the six featured projects; C shows four, because its large portrait frames need the best photos.
- Hover effects:
  - A: zoom and lift.
  - B: zoom, lift and an orange top edge.
  - C: slow zoom and a caption underline.

**§18 — Clients.** A clean logo wall in each option: no numbers, coordinates, sheet references or counts, and no partnership claims.

**§19 — Icons.**
- One new family of 30 icons on a 24 px grid with round caps (`src/components/theme-lab/Icon.tsx`).
- Covers the six services, figures, machine, factory, shield, truck, document, phone, mail, chat, pin, globe, sun/moon, arrows and menu.
- Styling per option:
  - A: line 1.75 with an 18 % duotone.
  - B: line 2 with an orange duotone.
  - C: line 1.4, no second tone.
- All icons are decorative (`aria-hidden`) and sit next to text.

**§20 — Motion.**
- Shared across all three:
  - card lift and image zoom;
  - fade-and-rise reveals (C rises less, and more slowly);
  - button arrows that nudge on hover;
  - a header that blurs and gains a shadow on scroll;
  - a nav active state that follows the section in view;
  - a cross-page fade between lab pages (View Transitions).
- Subtle background movement:
  - A: a slow hero glow drift and floating hero cards.
  - B: a slow push-in on the hero photo.
  - C: none.
- There are no grid, measurement or scan-line animations.
- Everything stops with reduced motion, and everything is visible without JavaScript.

**§21 — Navigation.**
- A commercial header with six links (About, Services, Capabilities, Projects, Clients, Contact).
- Strong active states:
  - A: an orange tint and a bottom bar.
  - B: a 4 px orange underline.
  - C: an orange dot.
- A prominent "Get a Quote" button, polished language and theme controls, and a blur on scroll.
- B adds a utility bar with phone, email, location and WhatsApp.
- Below 1,280 px the links move into a menu button. The menu is a `<details>` disclosure, so it also opens without JavaScript.

**§22 — Buttons.**
- **Primary:** RAWASY orange in all three.
- **Secondary:**
  - A: white with a border.
  - B: graphite.
  - C: white with a hairline border.
- **Dark:**
  - A: navy.
  - B: the graphite secondary doubles as the dark button.
  - C: charcoal.
- **Contextual:**
  - A: steel and teal tinted.
  - B: steel solid.
  - C: steel tinted.
- **Tertiary:** a text link with an arrow. On dark: A and B have outlined light buttons, B the most prominent.
- Rest, hover, focus and disabled states are shown on each design-system sheet.

**§23 — Content density.** The homepages are less than half the height of the current one:

| | Current homepage | A | B | C |
| --- | --- | --- | --- | --- |
| Height at 1,440 px | 16,043 px | 7,211 px | 7,175 px | 8,385 px |
| Height at 390 px | 23,907 px | 10,259 px | 11,364 px | 10,281 px |
| DOM elements | 2,094 | 840 | 866 | 537 |

Information is grouped into grids, panels and rails. There are no tabs or accordions: no new functionality was built.

**§24 — Mobile.**
- Every option has a clear header with a menu, a strong CTA and legible cards.
- Rails for services (A, C), machines (B) and projects (A) keep the pages short, and there are two-column grids where useful.
- There is no sideways scroll at 360, 390, 834, 1,024 or 1,280 px, in English or Arabic (tested).

**§25 — Existing content kept.** Every piece of text comes from `src/content`. The only exceptions are the lab's own chrome labels and design-sheet headings, which are not website copy.

**§26 — Current design kept.** The live routes and the V2 system are untouched and remain in place until you approve a theme.

**§27 — No new functionality.** None was built:
- no Stage 1E, project detail pages, admin panel or backend work;
- no filters;
- no working form: the form fields appear only as a style sample.

**§28 — Deliverables.** 19 review images are attached:
- `01` — desktop first view of A, B and C.
- `02` — phone first views in English and Arabic, and the open menus.
- `03`, `06`, `09` — full desktop homepages (A, B, C).
- `04`, `07`, `10` — full phone homepages.
- `05`, `08`, `11` — design-system sheets: palette, fonts, radius, borders, shadows, buttons, cards, icons and fields, with each option's header and footer.
- `12`–`18` — side-by-side comparisons of the who-we-are, services, machinery, projects, clients, CTA/contact and footer sections.
- `19` — the three full Arabic homepages.
- The live previews are at the URLs in section 2.

**§29 — Differences and implications. No recommendation of a winner.**

*How they differ:*
- **A** is the most "catalogue-clear" of the three: everything sits in labelled, bordered cards with icon chips and tags. It is the most information-dense and the easiest to scan. Its personality is friendly and precise rather than dramatic.
- **B** has the strongest presence and contrast. Graphite bands, big photography and bold type make it feel like a serious equipment supplier. It also has the most dark area: hero, machinery and footer. It is the loudest of the three and leans hardest on photography.
- **C** is the calmest and most premium. It has the fewest elements, generous whitespace and light large type. Photography and typography carry it. It shows the least information at once and says the most through restraint.

*Performance* (measured on the production build in local Chromium without throttling; the timings are indicative only):

| | Current homepage | A | B | C |
| --- | --- | --- | --- | --- |
| Own fonts, English page | ≈300 KB (all six site files, preloaded on every page) | ≈84 KB | ≈134 KB | ≈86 KB |
| Own fonts, Arabic page | ≈329 KB | ≈230 KB | ≈358 KB | ≈117 KB |
| Theme CSS (gzip) | 28 KB (+3 KB font CSS) | 5.7 KB | 6.9 KB | 4.3 KB |
| JavaScript | 246 KB (GSAP scenes) | 140 KB | 140 KB | 140 KB |
| Photos loaded on first view (desktop / phone) | 89 KB / 89 KB | 172 KB / 60 KB | 190 KB / 102 KB | 234 KB / 188 KB |
| Largest contentful paint (desktop, English) | 0.9 s | 0.5–0.7 s | 0.5 s | 0.3 s |

Notes on the table:
- The theme CSS figure is on top of 8.4 KB of shared lab utilities.
- The JavaScript figure is the same framework runtime plus one small observer; no GSAP is needed.
- **Fonts:**
  - B's Arabic body face, Noto Sans Arabic, is the heaviest single file (≈163 KB per weight for the Arabic range). If B is chosen, switching its Arabic body to IBM Plex Sans Arabic would save about 130 KB.
  - C is lightest: one variable Arabic family.
  - A sits in between.
- **Images:** C loads the most image bytes above the fold, because it has three photos in the first view. B's hero is a large background photo.
- **Layout shift:** it is 0 in English. It is small in Arabic (0.01–0.04) because the lab does not preload the Arabic faces; per-locale preloading in 1J removes it.
- **Lab-only overhead:** the lab pages also preload the current site's six font files (≈200–270 KB). Next.js 16 does this for every root layout while `experimental.globalNotFound` is on. The overhead is excluded from the table and disappears once the chosen theme replaces the site fonts.

*Design-system implications:*
- Any option replaces the V2 tokens and primitives and retires the Sora, Manrope and Noto Kufi faces:
  - the tinted section surfaces;
  - the technical frames, backdrops, scan lines and nameplates;
  - the chamfered buttons;
  - the outlined numerals.
- All three are already written on the same semantic token names: `bg`, `surface`, `ink`, `line`, `brand`, `steel`, `teal`, `brass`, `r-*` and `sh-*`. That makes the chosen token set a direct replacement for the V2 tokens in `globals.css`. The inner pages built in 1C and 1D would then be restyled with the chosen option's cards, buttons and sections.
- **A** has the largest component kit: icon chips, tags, badges, floating cards, the quick bar and contact rows. It maps most directly onto the existing inner pages (services, projects, contact form, certificates). Its dark theme needs a new palette.
- **B** needs a rule for dark bands on otherwise light pages, bold Arabic UI in Alexandria, and large high-resolution photos for heroes and backgrounds. Its dark theme is the most straightforward, since dark surfaces already exist.
- **C** needs the fewest components but depends most on photo quality and on disciplined whitespace. Technical content (machine specs, certificates, the legal pages) would need a quiet table and list style. Its dark theme needs a new palette.
- **Photos matter for all three.** The supplied photos are low-resolution: most project photos are 150–470 px wide. The previews keep images near their native size. Original photography is the single biggest quality lever for whichever theme you choose (asset inventory item 16).

---

## 4. QA actually run

- **Lint, typecheck and build:**
  - `npm run lint` ✔ and `npm run typecheck` ✔.
  - `npm run build` ✔: 121 static pages (109 site + 12 lab).
- **Browser tests:** `npm run test:e2e` ✔ **151/151**. That is the 121 existing tests plus 30 new ones in `e2e/theme-lab.spec.ts`, covering:
  - noindex meta and header;
  - isolation from the site CSS;
  - typefaces per option;
  - redirects;
  - the sitemap and site navigation;
  - all sections and nav anchors;
  - the 21 client logos with no counts;
  - flagged photos excluded;
  - decorative icons hidden;
  - whole-card link overlays staying inside their cards, and clickable hero actions;
  - no sideways scroll at 360–1,280 px in EN/AR;
  - no-JavaScript (content visible, menu opens);
  - reduced motion (no running animations, content shown at once).
- **Existing site unchanged**, compared against the approved commit `f37bad5` built in a worktree:
  - 104/104 HTML, 518/518 RSC and 109/109 meta files are identical after normalising build IDs, asset hashes and the router's `theme-lab` sibling entry;
  - the visible markup is identical on all 104 pages;
  - the site CSS is byte-identical on 104/104 pages;
  - the sitemap has no lab URLs, and robots.txt is unchanged.
- **Accessibility:** axe (WCAG 2.2 AA + best practice) over 12 lab pages at 1,440 and 390 px: 24 audits, **0 violations** after fixes. The first run found five things, all fixed:
  - content outside landmarks (the lab bar and B's utility bar);
  - an empty table header on the design sheets;
  - brass tag contrast on B (4.49 : 1) and C (3.98 : 1);
  - a scroll container on the phone design sheets that could not be focused;
  - redundant image alt text on project tiles.
- **Bugs found during review and fixed:**
  - Two of B's cards were not positioned, so their whole-card link overlay attached to the page. It covered the hero area and drew an orange line across the top. A regression test now guards this.
  - The phone menu's hidden panel caused sideways overflow in Chromium.
  - The lab bar overflowed at 360 px.
  - Nav links crowded at 1,024 px; they now move into the menu below 1,280 px.
  - A's Arabic UI at weight 600 would have shown faux-bold Plex; it now uses Tajawal.
  - English pages downloaded the 163 KB Noto Arabic file for the lab bar's "العربية" label.
- **Visual review:** every capture was taken on the production build: 1,440, 1,024, 834 and 390 px, English and Arabic, and the menus open. Dark theme was not reviewed; it is out of scope for this brief.

## 5. Needs RAWASY's confirmation

1. **Original, high-resolution photography.** All three directions rely on large imagery. The profile photos are small exports (asset inventory item 16).
2. **Photo licences** for the stock-looking photos the previews reuse: the steel hall, laser sparks, CNC bending, scaffolding, the site engineers and the Riyadh night skyline (inventory items 2 and 13).
3. **Laser engraving photos** of RAWASY's own work, or permission for the nameplates photo (item 12). Until then, engraving shows an icon panel.
4. Still open from earlier stages:
   - RAWASY's Google Maps place link;
   - the renewed commercial licence;
   - the registration numbers for display;
   - the two moderate shell accessibility findings planned for 1I/1J.

## 6. Known limitations

- **Light theme only** (§12). The theme control is shown but dark is disabled.
- **Homepage only.** Inner pages keep the current design, and the preview links open them.
- **Lab-only overhead:** the lab pages preload the current site's six font files (explained in §29). This does not affect the live site.
- **Arabic fonts are not preloaded in the lab,** so there is a small layout shift while they load on Arabic pages.
- **C shows four featured projects** instead of six, by design, to keep its large frames sharp.
- **The hero headline is the approved one** (content unchanged). Headline copy can be revisited after the theme is chosen.
- **The "Get a Quote" and machine links point to the current contact and capabilities pages.** The capabilities page is still the "in development" page.

## 7. How to run

```bash
npm install
npm run build && npm start      # http://localhost:3000/theme-lab
npm run dev                     # or during development
npm run lint && npm run typecheck
npm run build && npm run test:e2e
```

## 8. Files

- **New:**
  - `src/app/theme-lab/` — root layout, `lab.css`, six page routes.
  - `src/components/theme-lab/` — shared data, icons, motion, lab bar, the design-sheet renderer, and `a/`, `b/`, `c/` (homepage, design system, stylesheet and fonts per option).
  - `e2e/theme-lab.spec.ts`.
  - This report.
- **Changed:**
  - `src/proxy.ts` — the lab route exemption.
  - `src/app/globals.css` — two `@source not` lines.
  - `README.md`, `CLAUDE.md` and `docs/ASSET_INVENTORY.md` (item 16).

## 9. Next steps

- **Waiting for your selection:** A, B or C, or a combination you describe. Nothing proceeds until then.
- **After you choose, and only when you say so:**
  1. Build the dark equivalent of the chosen option.
  2. Replace the site tokens and fonts with the chosen system and restyle the approved pages with it.
  3. Remove the theme lab.
  4. Resume the stage plan (1D review, then 1E onwards) under the new theme.
