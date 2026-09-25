# RAWASY Metal Website — Modern Commerce Option A V2 (theme refinement)

**Date:** 2026-09-25 · **Branch:** `claude/new-session-5eijs6` · **Implementation commit:** `85bc3b4` (this report is in the following commit)

**Status: A V2 is built and returned for your visual review. I have not approved it.**

- Only Option A was refined. B and C were not touched; A stays available beside A V2 for comparison.
- The theme is not applied to the website. The live routes are unchanged (proof in item 27).
- Stage 1E, later stages and Phase 2 were not started. Stage 1D still awaits your review.
- Nothing moves to a full-site migration until you explicitly approve A V2.

## How to view

- Start with `npm run build && npm start` (or `npm run dev`), then open:
  - `/theme-lab/en/modern-commerce-a-v2` and `/theme-lab/ar/modern-commerce-a-v2` (homepage)
  - add `/system` for the design-system sheet
  - `/theme-lab/en/modern-commerce-a` for the original A, side by side
- `/theme-lab` now opens A V2 in your language.
- The dark lab bar at the top is preview chrome. It switches A / A V2 / B / C, homepage and design system, and English and Arabic.
- Links inside the previews open the current website's pages, which still have the old design.

---

## Report items

### 1. Implementation commit SHA

`85bc3b4` — "Add theme lab option A V2 with signature laser illustrations".

### 2. Current branch SHA

The branch head is the commit that adds this report, directly on top of `85bc3b4`. It is pushed to `claude/new-session-5eijs6`, and its SHA is given in the chat report.

### 3. A V2 routes

| View | English | Arabic |
| --- | --- | --- |
| Homepage | `/theme-lab/en/modern-commerce-a-v2` | `/theme-lab/ar/modern-commerce-a-v2` |
| Design system | `/theme-lab/en/modern-commerce-a-v2/system` | `/theme-lab/ar/modern-commerce-a-v2/system` |
| A, kept for comparison | `/theme-lab/en/modern-commerce-a` (+ `/system`) | `/theme-lab/ar/modern-commerce-a` (+ `/system`) |

- Noindex twice over: a `noindex, nofollow` meta tag and an `X-Robots-Tag` header.
- Not in the sitemap, `routes` or any navigation, and no site page links to the lab (all tested).
- The lab keeps its own root layout and stylesheet: no site header, footer, loader or site CSS.
- `/theme-lab` and `/theme-lab/{locale}` redirect to A V2.

### 4. Files added / changed

**Added (14):**
- `src/app/theme-lab/[locale]/modern-commerce-a-v2/page.tsx` and `…/system/page.tsx` — the routes.
- `src/components/theme-lab/a2/`
  - `HomeA2.tsx` — header, hero, capability strip, about, services, machinery, projects, industries, clients, compliance, contact, footer.
  - `MachineShowcase.tsx` — the machine selector (client component; works without JavaScript).
  - `SystemA2.tsx` — the design-system sheet.
  - `SheetControls.tsx` — replay buttons and the phone preview.
  - `a2.css` — tokens and components scoped to `.lab-a2`.
- `src/components/theme-lab/signature/` — the reusable signature illustrations:
  - `LaserCut.tsx`, `LaserEngrave.tsx`, `useSignature.ts`, `geometry.ts`, `signature.css`.
- `e2e/theme-lab-a-v2.spec.ts` — 16 browser tests.

**Changed (11):**
- `src/components/theme-lab/`
  - `options.ts` — the A V2 option, and sheet labels in English and Arabic.
  - `data.ts` — more existing content: about, clients and industries pages, compliance note, back-to-top.
  - `Icon.tsx` — industry, site-support, quote, replay and colour icons.
  - `LabMotion.tsx` — the A V2 behaviours, keyed on new attributes only.
  - `SystemSheet.tsx` — an optional extra slot.
  - `ui.tsx` — the lab bar's short labels.
- `src/app/theme-lab/lab.css` — the image clip reveal.
- `src/proxy.ts` — the lab's default option is now A V2.
- `e2e/theme-lab.spec.ts` — A V2 joins the shared lab checks; the redirect test expects A V2.
- `README.md`, `CLAUDE.md` — docs.

No site component, content file, route or site stylesheet changed.

### 5. Overall design changes

A V2 keeps A's base:
- the bright commercial layout, with white raised cards on a cool light grey;
- visible borders and soft layered shadows;
- orange primary actions; steel blue, teal and brass accents used by role;
- compact length and easy scanning;
- Plus Jakarta Sans + Inter for English, Tajawal + IBM Plex Sans Arabic for Arabic. The pairs held up, so no new families (2 English + 2 Arabic).

What changed:
- **Structure**
  - The page now covers every main section: hero, capability strip, who we are, services, machinery, projects, industries, clients, compliance, contact.
  - Section padding is 72–104 px on desktop and 48–72 px on phones.
  - The page is 7,906 px tall at 1440, against 7,235 for A and 16,043 for the current homepage.
- **Signature moments**
  - Two custom animated illustrations: laser cutting and laser engraving.
  - They replace A's static icon panel for engraving and give the laser card its identity.
- **One motion system**: shared durations (180 / 320 / 600 / 900 ms), one ease, transform and opacity only.
- **Removed**
  - A's continuously floating hero cards; they now enter once and move only with the pointer.
- **Kept out** (no blueprint, drafting or editorial devices)
  - no technical tables;
  - no outlined numbers;
  - no scan-line backgrounds;
  - mono type only for token values on the design-system sheet.
- **Dark-ready**
  - Every colour is a token on `.lab-a2`: surfaces, ink, lines, tones, glass, scrims, shadow colour and stages.
  - A dark theme only redefines those names.

### 6. UX improvements (understanding RAWASY within seconds)

- **Who and where:** the badge (RAWASY United International · Riyadh · Saudi Arabia), the headline and the one-line summary, above the fold.
- **What they do:** the six services appear right under the hero as a capability strip, each one tap from its page.
- **Machinery, completed work, industries, clients:** each has its own labelled section, and each is reachable from the header.
- **How to get a quote:**
  - Get a Quote is always in the sticky header, and pinned at the bottom of the phone menu.
  - Start a Project in the hero; Request a Quote in the Services menu, on every machine and in the contact block.
  - WhatsApp, phone and email in the contact block.
- **Navigation:**
  - The eight header items match the site's pages.
  - The active section is highlighted as you scroll (pill plus an orange bar on the header's edge).
  - Services opens a compact menu with all six services.
- **Usability first:** every effect is optional. Hover effects have tap, focus or switch equivalents, and nothing waits for an animation.

### 7. Hero

- **Left:**
  - badge, headline ("Engineering metal into possibility.") and short description;
  - two actions: Start a Project and Explore Our Capabilities;
  - a small trust / capability strip: the four sourced capability statements with check marks.
- **Right:** the laser photo in a framed panel, with three floating cards. All figures are sourced:
  - 12,000 W peak fibre-laser power;
  - 6 integrated service lines;
  - Laser Cutting · CNC Bending · Metal Fabrication.
- **Entrance:**
  - the text rises in 70 ms steps;
  - the photo opens from a clipped frame and settles from 110 % over 1.8 s;
  - the cards rise in at 520, 660 and 800 ms.
- **Accents:**
  - a thin orange light on the frame's top edge;
  - a soft orange and steel glow that drifts slowly (18 s) and pauses when the hero is off screen.
- **Pointer parallax:** desktop mouse only, never with reduced motion. The photo moves about 5 px and the cards 9–16 px, eased over 0.9 s.
- No bouncing, no looping float, no scroll effect.
- **On phones:**
  - the photo follows the text;
  - one floating card (12,000 W) keeps the photo visible;
  - the six services follow directly.

### 8. About

- **Left:**
  - "Who we are" and the statement ("A Saudi metal partner — from the first laser cut to the finished structure.");
  - one factual paragraph;
  - two actions: About RAWASY and Explore services.
- **Right:** one panel with three parts.
  - The real workshop photo, revealed with a clip-and-settle.
  - A vision card: quote mark, "Our vision", the vision statement, Riyadh.
  - A "Beyond metalwork" card: "Scaffolding and site support.", five support items with icons (formwork, props, rental, installation, transport) and a link to the Scaffolding service.
- **Below:** "Why RAWASY", six compact cards from the profile's own "Why choose us": Precision, Technology, Craftsmanship, Reliability, Custom Solutions, Project Execution.
  - Desktop: 3 × 2.
  - Phones: a swipe rail.

### 9. Services

**Layout:**
- Two featured cards, then four standard cards. All six are equally reachable: here, in the strip and in the header menu.
- **Laser Cutting (featured):**
  - the animated cut on a dark stage;
  - 12,000 W and 360° spec tiles, and three capability tags;
  - Explore service.
- **Steel Structures (featured):** the large steel-hall photo, three tags and Explore service. The photo grows to match the laser card's height.
- **CNC Bending, Metal Fabrication, Laser Engraving, Scaffolding (standard):** a visual, an icon chip, the name, the short description, one capability tag from the service's own highlights, and Explore service.
- Metal Fabrication shows its supporting photo (a welder at the bench), because its cover, the workshop photo, now leads About. No photo repeats on the page.
- Laser Engraving shows the animated brass plate, never the nameplate photo or the renders.

**Interaction:**
- All cards: a visible border, a soft shadow, a 3 px lift, a 3.5 % photo zoom, an accent edge that draws along the top, and an arrow that moves.
- Laser Cutting, the signature exception:
  - on hover or focus its border turns orange with a soft orange glow;
  - the card lifts, the arrow moves and the cut replays (about 2.1 s).
- Laser Engraving also replays on hover or focus.

**Phones:** the featured cards stack, then a 2 × 2 mini grid (visual, icon, name, tag, link).

### 10. Machinery

- One lit stage plus a selector rail of all six machines.
- **The stage shows:**
  - a large cut-out photo and a category badge;
  - the name, which links to the machine's capabilities anchor, and a one-line capability;
  - a rated-power tag, only where the power is sourced (12,000, 12,000, 6,000 and 3,000 W);
  - the related service and Request a Quote.
- **Choosing a machine:**
  - the stage crossfades (600 ms) and the photo settles from 94 %;
  - the spec tags rise in 120 ms later;
  - the stage's spotlight glides to a new position.
- **Rail cards:** they lift on hover and fill their power badge; the chosen one takes an orange edge.
- It is not a table, and has no scan lines, blueprint or constant motion.
- **Phones:** the stage, then a horizontal swipe rail.
- **Without JavaScript:** the rail links target the panels (`:target`), so the selector still works.

### 11. Projects

- **Layout:** image-led bento on desktop (the tulip wide, the clock tower tall, four more); a swipe rail of large cards on phones.
- **Each card:**
  - a category badge (the website's own classification);
  - the name on a bottom scrim;
  - "View project →", which appears on hover or focus and is always shown on touch screens.
- **Hover:** photo zoom, 3 px lift, and an orange line drawn along the bottom edge.
- No reference numbers or extra metadata.
- The photos are small (320–470 px natively), so the large tiles enlarge them by up to about 1.3×. See the limitations.

### 12. Industry section

- A compact grid of eight icon tiles (name and one line) in **two labelled groups**, so sourced facts stay apart from website classifications:
  - **"Named in the company profile":** Construction, Infrastructure, Industrial & Manufacturing, Commercial Projects.
  - **"Website classification, based on our work gallery":** Architecture & Façades, Public Realm & Landmarks, Street Furniture & Shade, Signage & Gateways.
- The group labels are the Industries page's existing copy.
- **In the content architecture:**
  - every item carries its source (`basis`: profile or inferred) in the data;
  - the markup carries `data-basis`, and a test checks the 4 + 4 split.
- The section's own note and the "Industries we serve" link remain.
- **Phones:** 2-column mini tiles (icon and name).

### 13. Client section

- A clean logo wall:
  - greyscale at rest;
  - original colours and a slight lift on hover.
- **An "Original colours" switch** colours the whole wall:
  - it serves touch and keyboard users, so nothing depends on hover;
  - it appears only with JavaScript and is announced as pressed or not pressed.
- A centred wrap (3, 4, 5 or 7 per row), so no row ends with a lone logo.
- The trademark note and "All clients" remain.
- No numbers, counts, coordinates, partnership claims or testimonials.

### 14. Trust / compliance

- A compact brass-toned strip with:
  - the title "Registered. Licensed. Accountable." and the note "Registration numbers are available on request.";
  - three cards: Commercial Registration (Ministry of Commerce), VAT Registration (Zakat, Tax and Customs Authority) and Commercial Activity Licence (Balady · Riyadh Region Municipality);
  - a link to Certificates & compliance.
- Only the supplied, verified documents are listed: no ISO claims, no numbers, no QR codes, no names.

### 15. CTA / contact

- **A dark panel** over the Riyadh night photo (more visible than in A, which gives the location context):
  - the label and the headline ("Have a drawing, a concept or a challenge? Let's shape it in metal.");
  - three short steps;
  - Request a Quote and Chat on WhatsApp.
- **A contact card:**
  - phone, WhatsApp, email and address as colour-coded rows;
  - the rows that are links lift and fill their icon on hover.
- Nothing else, so it isn't overloaded.

### 16. Animation system

| Layer | What moves | Timing |
| --- | --- | --- |
| A · Page entrance | Hero text, photo, cards and service strip fade and rise, staggered | 400–900 ms, 70–140 ms steps |
| B · Cards | 2–3 px lift, shadow, border and accent edge; photo zoom 3.5 % | 320 ms; zoom 900 ms |
| C · Buttons | Fill and shadow change, arrow moves 3 px, press feedback (98 %) | 180–320 ms |
| D · Images | Clip reveal: the frame opens from 9 % inset while the photo settles from 108 %; slow hover zoom | 1.1–1.6 s |
| E · Header | Blur once scrolled; shadow once past the hero | 320 ms |
| F · Sections | Fade-ups as they enter, 50–90 ms stagger (IntersectionObserver) | 700 ms |
| G · Signatures | Laser cutting and laser engraving | ~2.5 s once; ~2.1–2.2 s replay |

- **Motion tokens:** `--dur-1..4` (180 / 320 / 600 / 900 ms), `--ease` (ease-out) and `--ease-io`.
- **Built with:** CSS transitions and keyframes, IntersectionObserver and the Web Animations API.
- **Not used:** GSAP, canvas, WebGL, Three.js.
- **What animates:** transform, opacity, and for the signatures `stroke-dashoffset` and a one-off `clip-path`.
- **Nothing loops** except the hero light, which pauses off screen.
- **No scroll control:** no scroll-jacking, no sticky scroll traps and no scroll-position changes. Scrolling only reveals.
- **Reduced motion:**
  - every final state shows at once;
  - no parallax, no hero light, no replays (the replay buttons hide);
  - the machine selector and decorative lines switch instantly.

### 17. Laser-cutting animation

`<LaserCut />` in `src/components/theme-lab/signature/`:
- SVG only, driven by the Web Animations API.
- The page's markup is the finished picture.

**The picture:**
- a brushed steel plate with a sheen and four mounting holes;
- the cut: RAWASY's eight-point star (the khatam used in the original hero plate), on a dark stage.

**Sequence (first time the card is half in view):**
- **0–440 ms:** the plate enters.
- **360 ms:** the laser arms. A ring contracts onto the start point and the planned path shows as a faint dashed line.
- **480–1630 ms:** the kerf is cut at a constant feed rate.
  - The head follows the path with a keyframe at each of the star's 16 corners, in step with a `stroke-dashoffset` line.
  - A short white-hot segment trails the head.
  - Eight sparks fly outward on their own short cycles.
  - The glow is a wider translucent stroke, not a filter.
- **~1700–2300 ms:** the cut part lifts out (translate, slight rotation and scale), revealing the through-cut.
  - The plate's cut edge glows hot, then cools to a bronze heat tint.
- **~2.5 s:** settled.

**Behaviour:**
- It replays on mouse hover or keyboard focus of its card: the part drops back in and the cut runs again in about 2.1 s.
- It never loops.
- On touch screens it plays once when scrolled into view.
- With reduced motion, or without JavaScript, the finished state shows (the part lifted out of the plate).

### 18. Laser-engraving animation

`<LaserEngrave />` shows a brass nameplate with four screws and a medallion:
- a double ring with 24 fine ticks;
- an eight-point star from two squares;
- an inner ring and the RAWASY mark (RAWASY's own logo paths).

The grooves are drawn as a dark line with a light offset, so they read as cut into the metal.

**Sequence:**
- **0–440 ms:** the plate enters.
- **340 ms:** the crosshair arms.
- **480–1680 ms:** the pattern is engraved in eight raster passes.
  - The crosshair zig-zags across the medallion's width, level with a glowing scan line.
  - The line reveals the grooves pass by pass (`clip-path`).
- **~1740–2460 ms:** a band of light crosses the plate: "light catching the engraving".
- **~2.5 s:** settled.

**Behaviour:**
- It replays on hover or focus: the engraving fades and is re-engraved in about 2.2 s.
- It is never mirrored in Arabic, because it is an object, not text.

**Content (tested):**
- No photos, text, part or serial numbers, and no third-party branding.
- The nameplate photo and the engraving renders stay off the page.

Both components share `useSignature` (plays once at 50 % in view, replays on host hover or focus, and a `sig:replay` event for the sheet), so the service overview, service detail and capabilities pages can reuse them.

### 19. Mobile UX

- **Header:** logo, a language chip (from 400 px), Get a Quote, and a menu button that morphs into ×.
- **Menu:** a full-height sheet under the header.
  - Eight rows, 56 px tall.
  - Services expands into six service tiles.
  - A large English / العربية switch, and Call and WhatsApp buttons.
  - Get a Quote is pinned at the bottom.
  - The page is locked while the menu is open. It closes on a choice or with Escape.
- **Page:**
  - the hero, then a 2 × 3 service strip;
  - the About panel, then a swipe rail of the six "Why RAWASY" cards;
  - two featured services, then a 2 × 2 mini grid;
  - the machinery stage with a swipe rail;
  - a projects swipe rail;
  - two-column industry tiles;
  - a three-column logo wall, then compliance and contact.
- The rails scroll inside themselves: the page never scrolls sideways (tested at 360, 390 and 834 px).
- The laser illustrations play once as they scroll into view. Nothing depends on hover.

### 20. Arabic UX

- **Layout:**
  - Full right-to-left mirroring through logical properties, including the header, dropdown, menu, hero composition, cards, accent edges, machine-selector highlight and contact rows.
  - The hero text sits on the reading side (tested).
- **Type:**
  - Tajawal for headings and UI (500 / 700 / 800);
  - IBM Plex Sans Arabic for body text (400 / 500);
  - Arabic line heights of 1.85 for paragraphs and 1.32–1.5 for headings;
  - never letter-spaced (tested).
- **Numbers:**
  - Figures, phone numbers and "360°" stay left-to-right; the degree sign stays with its number (fixed during QA).
  - Direction arrows flip.
- **Language switch:** it keeps you on the same page (homepage ⇄ homepage, sheet ⇄ sheet).
- **Narrow screens:** below 400 px in Arabic, the header's language chip moves into the menu, where the full switch sits; the longer "اطلب عرض سعر" button then fits.

### 21. Accessibility

- **axe (WCAG 2.2 AA + best practice): 0 violations** in 8 audits, twice:
  - the audits: English and Arabic, homepage and sheet, 1440 and 390 px;
  - once with reduced motion;
  - once with full motion, with reveals shown and the animations finished.
- One finding came up and was fixed during QA: the phone "Why RAWASY" rail is now focusable, so it scrolls from the keyboard.
- **Keyboard:**
  - A skip link, and a logical tab order through the header.
  - The Services menu opens with Enter or Space. It closes with Escape (focus returns to it) or when focus leaves.
  - The phone menu closes with Escape.
  - Cards are whole-card links: focus lifts them and draws the accent edge, as hover does.
  - The machine selector works with Enter, and the colour switch with Space.
- **Assistive technology:**
  - Inactive machine panels are `aria-hidden` and out of the tab order.
  - Every illustration and icon is `aria-hidden`.
- **Motion and contrast:**
  - `prefers-reduced-motion` is honoured throughout.
  - Small text uses the AA-passing role inks.
- **Without JavaScript,** everything is visible:
  - the illustrations show their finished state;
  - menus are native disclosures;
  - the machine selector uses `:target`;
  - the script-only switch is hidden.

### 22. Performance

Measured on the local production server (Chromium). The timings are optimistic in absolute terms and meant for comparison.

| Page | Transfer | Requests | LCP | CLS | Height | DOM elements |
| --- | --- | --- | --- | --- | --- | --- |
| A V2 · EN · 1440 | 717 KB | 31 | 412 ms | 0 | 7,906 px | 1,486 |
| A V2 · AR · 1440 | 866 KB | 40 | 552 ms | 0.029 | 7,972 px | 1,486 |
| A V2 · EN · 390 | 616 KB | 24 | 204 ms | 0 | 11,287 px | 1,486 |
| A V2 · AR · 390 | 754 KB | 32 | 324 ms | 0.029 | 11,217 px | 1,486 |
| A · EN · 1440 | 720 KB | 30 | 336 ms | 0 | 7,235 px | 843 |
| Current homepage · EN · 1440 | 872 KB | 47 | 484 ms | 0 | 16,043 px | 2,094 |

- **Scripts:** 153 KB, against 141 KB for A. The signatures and the machine selector add about 12 KB. No animation library.
- **Fonts:** A V2's own English fonts are 84 KB, as in A. The Arabic page adds Tajawal and IBM Plex Sans Arabic.
  - Like every lab page, it also preloads the site's six fonts (about 269 KB).
  - That comes from the site's global not-found page, a known issue for 1J. It is excluded from the "own fonts" figure.
- **Animation cost:** transform, opacity and dash offsets only; one-shot signatures; the hero light pauses off screen; no expensive filters in motion. The only blur is the header's backdrop once scrolled, as in A.

### 23. Lint

`npm run lint` passed with 0 problems.

- One rule fired during development and was fixed properly: a `setState` call inside an effect.
- The selector's hydration flag now uses `useSyncExternalStore`.

### 24. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`) passed with 0 errors.

### 25. Build

`npm run build` succeeded.

- 16 theme-lab previews are prerendered: the 12 existing ones plus A V2's four (EN and AR × homepage and sheet).
- The site's 109 routes build as before.

### 26. Browser tests

`npm run test:e2e`: **176 passed, 0 failed** (full suite, 3.5 min, production build).

**New `theme-lab-a-v2.spec.ts` (16 tests):**
- header items and section targets;
- Services menu: open, six items, Escape with focus return, outside click;
- scroll-spy and the header shadow past the hero;
- phone menu: full height under the header, scroll lock, 44 px+ rows, language switch, pinned quote, Services expanding, closing on a choice;
- EN/AR mirroring and the language switch keeping the page;
- no letter-spacing in Arabic;
- industries 4 + 4 by source;
- machinery selector: in place, no jump, no hash, hidden panels out of the accessibility tree;
- the client colour switch;
- sheet overflow from 360 to 1440 px;
- laser cutting: plays once in view, a single ~2.5 s pass, finishes lifted, replays on hover with the orange edge;
- laser engraving: plays once, replays on keyboard focus;
- the engraving holds no photos, text or numbers;
- hero entrance, pointer parallax, and the ambient light pausing off screen;
- the sheet's replay buttons;
- reduced motion: finished illustrations and nothing running;
- keyboard: skip link, header, menu, cards, selector, switch;
- without JavaScript.

**Updated `theme-lab.spec.ts`:** A V2 joins every shared lab check:
- isolation from the site CSS, and only its own typefaces;
- noindex;
- redirects to A V2 (A still 200);
- sections and footer;
- flagged photos;
- card overlays;
- overflow at 360–1280 px;
- no-JS;
- reduced motion.

Failures during development, all resolved before the final run:
- **Test fixes:**
  - three over-broad locators;
  - two measurements taken while something was still moving: the menu sheet's opening animation, and Playwright re-scrolling a card still in its reveal. A real mouse click never scrolls the page.
- **Page fixes (real issues the tests found):**
  - the Arabic header overflowed by 6 px at 360 px;
  - the active-nav underline still scaled in under reduced motion.

### 27. Proof the current website is unchanged

I built the previous commit (`0080742`) in a separate worktree and compared it with this build.

- **Prerendered site files (104 HTML, 518 RSC, 109 meta):** 730 of 731 are identical, once build IDs and asset hashes are normalised.
  - The remaining file, `ar/projects.html`, differs only in where Next.js places its `<meta name="next-size-adjust">` tag inside `<head>`.
  - In an earlier build of this same tree, that tag had moved on `en/projects.html` instead. It is build-to-build ordering, not a change.
- **Site CSS:** byte-identical on 104 of 104 pages.
- **Source:**
  - no site component, content, route, sitemap, robots or `globals.css` change;
  - the only shared file outside the lab is `src/proxy.ts`, and only its lab default changed.
- **Option A:**
  - 22 of 24 captures are pixel-identical: full pages in EN and AR at 1440 and 390, every section, the phone menus.
  - The two first-view captures differ only in the header's language label, which is drawn 1 px lower. The layout geometry, CSS rules and font files are identical.
  - A's CSS is now split across two files, because A V2 reuses A's fonts. The difference is font rasterisation, not a design change.
  - A's HTML differs only by the lab bar's new "A V2" entry.
- B and C also differ only by that lab-bar entry.

### 28. Screenshots / comparison sheets provided

Sent in the chat; each is at most 2,400 px tall.

| # (brief §37) | Sheet |
| --- | --- |
| 1 · Full A V2 desktop EN | `01-a2-desktop-en.png` |
| 2 · Full A V2 desktop AR | `02-a2-desktop-ar.png` |
| 3 · Full A V2 mobile EN | `03-a2-mobile-en.png` |
| 4 · Full A V2 mobile AR | `04-a2-mobile-ar.png` |
| 5 · Hero comparison A → A V2 | `05-compare-hero.png` |
| 6 · Services comparison | `07-compare-services.png` |
| 7 · Machinery comparison | `08-compare-machinery.png` |
| 8 · Projects comparison | `09-compare-projects.png` |
| 9 · Client comparison (with industries and compliance) | `10-compare-clients.png` |
| 10 · CTA comparison | `11-compare-cta.png` |
| 11 · Laser-cutting animation states (12 moments) | `14-laser-cutting-states.png` |
| 12 · Laser-engraving animation states (12 moments) | `15-laser-engraving-states.png` |
| 13 · A V2 design-system sheet | `16-a2-design-system.png` |
| Extra (§36) · About, mobile and Arabic comparisons | `06-compare-about.png`, `12-compare-mobile.png`, `13-compare-arabic.png` |

---

## The design-system sheet (§31)

- **Foundations:**
  - palette (brand and neutrals, supporting colours, signature surfaces);
  - English and Arabic type specimens;
  - radius, borders and shadows;
  - buttons in four states.
- **Components:**
  - cards: the Laser Cutting feature, CNC and Engraving cards, a project card, the machine selector;
  - icons, tags and badges;
  - form fields;
  - client tiles with the colour switch;
  - contact blocks.
- **Motion and signatures:**
  - the motion token table;
  - both signature illustrations with Replay buttons and their phase lists;
  - a replayable reveal demo.
- **Mobile components:** the real homepage in a phone frame, with the mobile rules.
- **Tokens:** a dark-ready token table.

## Not done, by instruction

- Nothing was applied to the website.
- No work on B or C.
- No Stage 1E, other stage or Phase 2.
- No GSAP, WebGL or Three.js.
- I did not choose or approve anything.

## Items needing RAWASY's confirmation (unchanged, still open)

- **Photo rights and origin:**
  - the hero laser photo and the steel-hall photo look like stock (`docs/ASSET_INVENTORY.md`);
  - confirm the project photos as RAWASY's work;
  - supply full-resolution originals: the profile export is low-resolution.
- **Client logos:** permission to show them.
- **Engraving:** the illustration uses RAWASY's own mark. The nameplate photo (third-party branding, part and serial numbers) stays off until RAWASY supplies or approves images.
- **Google Maps place link** for the contact page; licence renewal and registration details as listed in the inventory.

## Known limitations

- **Light theme only.** The dark theme follows your approval (your order); the tokens are ready for it.
- **Links** in the preview open the current site's pages, in the old design. Machine links lead to `/capabilities`, which is still "in development" (1E not started).
- **Photo sizes:** project and About photos are small, so large tiles enlarge them by up to about 1.3–1.5× and look soft on high-density screens until originals arrive.
- **Fonts:** lab pages also preload the site's six fonts (global not-found page; to fix in 1J).
- **The phone preview** on the design-system sheet is a live frame of the homepage. It loads that page a second time, but lazily.
- **The Services menu** opens on click, tap or keyboard, not on hover. That is deliberate, so it never opens by accident.
- **Timings:** LCP and CLS were measured locally; field numbers will differ.

## How to run

```bash
npm install
npm run build && npm start      # then open /theme-lab/en/modern-commerce-a-v2
npm run lint && npm run typecheck
npm run test:e2e                # after a build; Playwright + Chromium
```

## Next steps

1. **Your visual review of A V2.** Tell me what to change, or approve it.
2. **After an explicit approval:** the dark-theme equivalent, then a migration plan for applying A V2 to the site. Neither is started until you say so.
3. **Stage 1D** (service pages) still awaits your review.
