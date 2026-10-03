# Stage 1E — Capabilities & Machinery (report)

Date: 2026-10-03 · Branch: `claude/new-session-5eijs6` · Status: **built and returned for the user's independent
review**. Capabilities is `review` (noindex, follow; not in the sitemap). Nothing was deployed. Stage 1F, 1I and 1J,
project case studies, the theme lab's removal and OG regeneration were not started.

## Summary

1. **The page.** `/en/capabilities` and `/ar/capabilities` replace the planned placeholder with the full Capabilities &
   Machinery page in the Modern Commerce design. In order:
   - a hero with the six machines on a graphite plate;
   - the rated power of the four lasers;
   - the machinery console: a selector beside a graphite equipment stage with a local grid, a floor axis, a scan line
     and a process sketch;
   - a technical register (a real table on wide screens, cards on phones);
   - the three services the machines support;
   - a source note and the closing invitation.
2. **Facts.** Exactly the six machines of `machines.ts`, with their records' fields only. Power is shown only for the
   four lasers (12,000 / 12,000 / 6,000 / 3,000 W). The press brake and laser welding read "Not stated in the company
   profile" / "غير مذكورة في الملف التعريفي" wherever power appears. No maker, model, size, tonnage, speed or tolerance
   appears anywhere; a test guards this.
3. **Addresses.** Each machine's panel has the raw slug as its id, so every existing `/capabilities#<slug>` link now
   lands on its machine. The selector writes the machine into the address. The header's language links keep it. Cold
   loads of all 12 machine addresses (EN/AR × six) land below the header on a desktop and a phone, with fonts held back
   300 and 1,200 ms.
4. **Without JavaScript** the console is a list of all six machines, each with its own stage, photo, facts and links.
5. **Freezes.** The homepage machinery (its two components byte-identical), the service pages, Contact, Projects,
   certificates, the TM-3 fixes and the theme lab are unchanged: identical prerendered files and JavaScript. Their CSS
   differs only by one utility rule added to the shared sheet (none on the theme lab, whose CSS is identical).
6. **Preflight.** `preserve/pre-stage-1e` was created at `ca672d7`. The Clients test race was fixed in the test only
   (`86d80a1`).
7. **A correction made during the final checks.** Two sentences I had written said that every register field comes from
   page 7 of the profile. Page 7 prints only the machine names (power inside four of them) and the photos. The type
   and related-service fields are the records' own wording. Both sentences were reworded, in English and Arabic, before
   the final build (item 16).
8. **Final runs on the final build.**
   - Full suite: 490 tests, 490 passed, 0 failed, 0 skipped, 0 flaky, no retries (14.5 min).
   - Clients forced-colours test, repeated 25 times: 25 of 25 passed (31.0 s).
   - lint, typecheck and build: clean.

---

## 1. `preserve/pre-stage-1e` SHA

`ca672d78760234f5b13055f0e60cf1ffde004e39`.

- Created and pushed before any change, with no force push. The branch did not exist before.
- Checked again on GitHub at the end of the stage: still at that commit.
- `preserve/pre-tm3` is still at `de62bc5cf0ad291fc90fffce0a3b81e762f1ba9b`.

## 2. Starting SHA

`ca672d78760234f5b13055f0e60cf1ffde004e39` (TM-3 correction 2's report commit). Preflight:

- fetched;
- clean tree;
- local = remote;
- TM-3 correction 2 present (`0f53145`, `ca672d7`);
- no unreviewed drift.

## 3. Test-race stabilization

Commit `86d80a14a4b0dadb831b6777180890f7fe8059ba`: "Stabilize the Clients forced-colours switch test: read the switch
only once it has settled (Stage 1E preflight)". It changes `e2e/commerce-company.spec.ts` only (+24 / −4).

- **Cause.** A probe showed it. The test waited until the dot's `translate` changed, but that changes on the
  transition's first frame (`none` → `0px`), when the track is still `Canvas`. Under load, the one colour read could
  land on that frame.
- **Fix.** The test now waits until the knob's own transitions have ended. `getAnimations({ subtree: true })` includes
  the `::after` slide. It then checks the settled forced palette:
  - off: `Canvas` track, `ButtonText` dot;
  - on: `Highlight` track, `HighlightText` dot.
- **Not changed:** the production CSS, the Clients component, the timing and the visuals. No generic timeout was added.
- **Repeat runs before Stage 1E work:**
  - 25 of 25 passed;
  - 30 of 30 passed under synthetic CPU load (load average 13).

  The old version also passed 30 of 30 under that load. The race is rare (it failed once in TM-3 correction 2's runs).
  The new test avoids it by design, because it never reads a moving frame.
- **Final build:** 25 repetitions, item 55.

## 4. Stage 1E implementation SHA

`d8af855d12176c65af251801251b9256ee2fc6cf` ("Build Capabilities & Machinery (Stage 1E): the six profile
machines in a Modern Commerce machinery console"). It sits on `86d80a1`.

## 5. Branch HEAD

The commit that adds this report and the CLAUDE.md update, on top of `d8af855`. Its hash is given in the hand-over
message, since a commit cannot contain its own hash.

## 6. Files changed

From `ca672d7` (the race fix included):

- **New page code** — `src/components/commerce/capabilities/`:
  - `CapabilitiesPage.tsx` — the page;
  - `data.ts` — the view, with `MACHINE_ORDER`;
  - `FleetPlate.tsx` — the hero plate;
  - `PowerChart.tsx`;
  - `MachineConsole.tsx` — client: the selector and the stage;
  - `MachinePhoto.tsx`;
  - `Schematic.tsx`;
  - `Register.tsx`;
  - `MachineAddressLink.tsx` — client: the language links;
  - `machine-address.ts`;
  - `capabilities.css`.
- **New content:** `src/content/capabilities.ts` (labels and notes only).
- **New tests:** `e2e/commerce-capabilities.spec.ts`.
- **Modified source:**
  - `src/app/(commerce)/[locale]/capabilities/page.tsx` — the route;
  - `src/components/commerce/shell/Header.tsx` — a given `sameAddressLink` reaches all three language switches;
  - `src/content/repository.ts` — `getCapabilitiesPageContent`;
  - `src/content/types.ts` — `CapabilitiesPageContent`, and an optional `hash` on `PageLink`;
  - `src/lib/inner-page.ts` — `capabilities` added to `InnerRoute`;
  - `src/lib/page-meta.ts` — `planned` → `review`.
- **Modified tests:**
  - `e2e/commerce-planned.spec.ts` — its Capabilities tests moved to the new spec (assertion map in item 54);
  - `e2e/commerce-services.spec.ts` — the D5 check now expects the built page;
  - `e2e/helpers.ts` — `INNER_PAGES` gains `capabilities`;
  - `e2e/site.spec.ts` — the route list;
  - `e2e/commerce-company.spec.ts` — the race fix, plus one test name and comment;
  - `e2e/commerce-home.spec.ts` and `e2e/commerce-inner.spec.ts` — comments.
- **Docs:** `CLAUDE.md`, `README.md`, `docs/ASSET_INVENTORY.md` (items 15, 17, 18) and this report.
- **Not touched:**
  - `machines.ts`, `services.ts` and the media;
  - `Machinery.tsx`, `MachineShowcase.tsx` and `system.css`;
  - the contact, projects, certificates and legal code;
  - `PlannedPage.tsx` and `planned.css`;
  - the theme lab.

## 7. Route architecture

- **Route.** `src/app/(commerce)/[locale]/capabilities/page.tsx` stays a static route, prerendered for `/en` and `/ar`.
  - Metadata comes from `innerPageMetadata("capabilities")`, like every built inner page.
  - The shell comes from `getShellView` with `route: "capabilities"`, so the header and footer mark the page.
  - `PageShell` receives `sameAddressLink={MachineAddressLink}`. Only this route passes it, so no other page loads that
    code.
- **Page.** `CapabilitiesPage` (server) builds the view with `getCapabilitiesView(locale)`. That function reads the
  machines and the page's copy through the content repository (`getCapabilitiesPageContent`) and the services through
  `getServices`.
- **Client code (two components):**
  - `MachineConsole` imports only a type from `data.ts`;
  - `MachineAddressLink` derives the other language's path from `usePathname`.

  Importing the routes module there re-split the shared JS chunks of the service and project pages (+552 bytes), so
  it is not imported.
- **Styles.** `capabilities.css` is imported by `CapabilitiesPage.tsx` only, like `services.css` and `projects.css`.
  The shared MC stylesheet gained one utility, `.max-w-[46rem]`, used by the section heads. No page's stylesheet list
  changed.

## 8. Removal of the Capabilities `PlannedPage`

- The route no longer imports `PlannedPage`, `routeStage`, `buildMetadata` or `isPublished`.
- `PlannedPage.tsx` and `planned.css` are unchanged and still serve the 34 project pages. Their 476 prerendered files
  are identical.
- No "In development · 1E" eyebrow and no pending note remain in the rendered page. Tests check both.

## 9. Publication status `planned` → `review`

`src/lib/page-meta.ts`: `capabilities: "review"`. Result:

- HTTP 200;
- the full page;
- `<meta name="robots" content="noindex, follow">`;
- absent from `/sitemap.xml`.

The homepage stays the only `published` page.

## 10. Page structure

| # | Part (brief §10) | Section |
| --- | --- | --- |
| 1 | Hero | split `PageHero`. Breadcrumb Home → Capabilities, eyebrow "Our machinery", the SEO title as h1, the SEO description as lead. Facts: Machines **06** · Laser cutting systems **04** · Peak laser power **12,000 W**. Actions: "Explore the machinery" (→ `#console`) and "Request a quote". Aside: the fleet plate. |
| 2 | Capability summary / machinery facts | the hero's facts and `#power`: "Laser power, as the profile states it" — four bars from one baseline, the two unrated machines listed in words under them |
| 3 | Interactive machinery console | `#console`: selector + equipment stage + data panel |
| 4 | Technical register | `#register`: table ≥ 64 rem, cards below |
| 5 | Capability / service relationship | `#service-lines`: Laser Cutting (4 machines), CNC Bending (1), Metal Fabrication (1) |
| 6 | Source / specification note | `#source` |
| 7 | Closing CTA | `ClosingCta`: request a quote (`/contact#quote`), services, projects |

## 11. Machine order and rationale

The homepage showcase's order, as the brief prefers:

1. Fiber Laser Combo 12 kW
2. Tube Cutting 12 kW
3. Fiber Laser 6 kW
4. Fiber Laser 3 kW
5. CNC Press Brake
6. Laser Welding

It is defined once as `MACHINE_ORDER` in `capabilities/data.ts`, identical in EN and AR, and stable.

- **Why:** a visitor arriving from the homepage showcase finds the same sequence. The lasers come first, by rating,
  then forming and joining.
- `machines.ts` keeps the profile's own order (tube first) and was not edited.
- Every list on the page uses this one order: hero plate, chart, selector, panels, register, service lines and
  JSON-LD.

## 12. Selector architecture

The selector is plain links with progressive enhancement, not an ARIA tabs widget.

- **Markup.** `nav[aria-label="Choose a machine" / "اختر المعدّة"]` holds an `ol` of `a.cm-pick[href="#<slug>"]`. Each
  card shows:
  - the photo (decorative: `alt=""`);
  - the index (01–06, hidden from assistive technology);
  - the short name;
  - the rated power where stated;
  - the service.
- **State.** The shown machine is marked `aria-current="true"`: an orange border and ring, a soft orange tint and an
  orange index; in forced colours a `Highlight` ring and an underlined name.
- **Layout:**
  - ≥ 80 rem: a vertical rail beside the stage;
  - 64–80 rem: a row across above the stage;
  - below 64 rem: a row that scrolls sideways inside itself (scroll snap), RTL-aware. The shown card is scrolled into
    view inside the row; the page itself never moves.
- **Choosing (primary click or Enter):**
  - `preventDefault`;
  - `history.replaceState(null, "", "#<slug>")`, so no new history entry and Back still leaves the page;
  - a `mc:machine` event;
  - a polite live-region announcement ("Showing: CNC Press Brake Machine" / "المعروضة الآن: …").

  Modified clicks (new tab, new window) are left to the browser.
- **One source of truth.** The console's state is the address, read with `useSyncExternalStore` over `location.hash`
  (hashchange, popstate, `mc:machine`). A fragment that names no machine (`#main`, `#register`) leaves the choice as it
  was. The address and the machine shown never disagree.
- **Hidden panels** are `inert`, so they are neither tabbable nor in the accessibility tree.
- **Other machine links on the page** (hero plate bays, chart rows, register names, service lines) are plain fragment
  links. Each adds a history entry, and Back / Forward step between machines.
- **No custom router**, no interval, no timers.

## 13. Direct-hash architecture

- **Panels.** All six panels are in the server HTML as `article#<slug>[data-machine]`. The ids are the raw slugs:
  unprefixed, unlocalized, unique, and the same in EN and AR.
- **Before hydration** the stylesheet shows the `:target` panel (or the first). After hydration `[data-active]` drives
  it. The handover has no transition, so nothing fades in twice.
- **The jump.** The browser makes the jump itself, under the TM-2.5 shared rules: no script scroll, and instant until
  `html[data-smooth-scroll]`. `scroll-padding-top` keeps it below the header.
- **Layout.** The panels share the console's grid tracks (subgrid), so a landing shows the selector and the stage
  together.
- **Two fixes found by the cold tests:**
  1. On phones the selector's first sideways scroll (bringing the address's card into view) waits for
     `html[data-smooth-scroll]`, watched by a MutationObserver (no timer). Any programmatic scroll during loading ends
     Chromium's fragment anchoring, and before the fix a late font moved the Arabic phone `#laser-welding` landing by
     2.16 px.
  2. `.cm-rail ol { overflow-anchor: none }`. With a sub-pixel landing, scroll anchoring could pick the centred
     thumbnail inside the selector and move the page by −8.58 px under CPU load. Reproduced deterministically: −24 px
     without the rule, 0 with it. Afterwards: 0 of 120 landings off under parallel load.
- **Tests:** item 37.

## 14. No-JS architecture

Without script (`html:not(.js)`) the console is a list.

- **Picks.** The selector shows all six picks as jump links.
- **Panels.** Every panel is displayed with its own graphite stage, which carries the grid, the floor axis, the photo,
  the readout, the source chip and the finished sketch. Every panel also shows its name, type, capability, power (or
  "not stated"), service and source, plus the quote and service buttons.
- **Static decoration.** The scan line and the sketch are static: the animations exist only under `.js` with motion
  allowed.
- **Everything else works:** the register (table and cards), the service lines, the chart and the hero plate links.
  Each `#slug` address lands on its panel, so service-page links land too.
- **Language links** are the plain page address; the fragment is a browser-only state.
- **Tests.** The page is complete without script and nothing waits on hydration. This is tested ("without
  JavaScript: every machine is on the page …") and pictured (evidence 18).

## 15. Six-machine source parity

Tested in EN and AR. Each of these parts shows exactly the six records, in `MACHINE_ORDER`, each with its record's
name, type, capability, service and source:

- the hero plate (6 bays);
- the chart (4 bars + 2 listed in words);
- the selector (6 cards);
- the panels (6);
- the register table rows (6);
- the register cards (6);
- the service lines (4 + 1 + 1);
- the JSON-LD `ItemList` (6).

There is no seventh machine and no merged machine. Names are the localized records', unchanged.

## 16. Machine source audit

Page 7 of the company profile ("Our Machinery") prints six labels — "12000W Tube Cutting Machine", "6000W Fiber Laser
Machine", "12000W Fiber Laser Combo Machine", "3000W Fiber Laser Machine", "CNC Press Brake Machine", "Laser Welding
Machine" — and six photos. Nothing else about the machines.

| Displayed field | Where | Record field | Source basis |
| --- | --- | --- | --- |
| Machine name | panel h3, register, chart, service lines, image alt, JSON-LD | `name` (EN/AR) | profile p.7: each machine's printed label (Arabic: the records' translation) |
| Short name | hero plate, selector | `shortName` | the p.7 label without its wattage and "Machine" (records since Stage 1A) |
| Rated power 12,000 / 12,000 / 6,000 / 3,000 W | hero plate, selector, readout, data list, chart, register | `powerWatts` | profile p.7: the wattage inside four of the labels |
| "Not stated in the company profile" | press brake and laser welding: readout, data list, chart, register | `powerWatts` absent | p.7 gives no power for these two |
| Machines 06 | hero fact | number of records | p.7 lists six machines |
| Laser cutting systems 04 | hero fact | records with service `laser-cutting` | p.7's four lasers; same figure and wording as the Laser Cutting service page and `metrics.ts` (source p.7) |
| Peak laser power 12,000 W | hero fact | highest `powerWatts` | the highest stated rating (p.7); the services overview's wording; never a sum |
| Type ("Fibre-laser tube cutting", "Enclosed high-power fibre laser", "Flatbed fibre-laser cutting", "CNC bending", "Laser welding") | data panel, register | `category` | the records' own description, written in Stage 1A from the p.7 labels and photos. **Not printed in the profile.** Shown on About and the service pages since 1C / 1D; the brief (§8) keeps it as the content baseline. RAWASY to confirm (item 59) |
| Capability sentence | data panel | `capability` | the records' own sentence (Stage 1A), from the labels and photos; on the homepage showcase and service pages already; brief §8 baseline. **Not printed in the profile.** RAWASY to confirm |
| Related service | selector, panel, register, service lines, service button | `service` (= the `machines` lists in `services.ts`) | the content layer's mapping (services from profile pp.3–6). Not on p.7 |
| Source "Company profile · p.7" | stage chip, data list, register | `source` `{ basis: "profile", pages: [7] }` | the record's citation |
| Photo | hero plate, selector, stage | `media` → media registry | the p.7 cut-outs, extracted by `scripts/extract-profile-assets.py` |
| Index 01–06 | plate, selector, stage chip, register, service lines | none | `MACHINE_ORDER` (presentation only) |
| Process sketch | stage | `SCHEMATIC` kind from the record's type | illustrative, `aria-hidden`, captioned "illustrative, not to scale", no figures |

- **Correction made before review.** Two sentences of my new copy presented the type and the service as the
  profile's. Both were reworded in EN and AR. No other displayed field is untraceable.
  - Register intro, before: "Every field comes from the company profile, page 7. Fields the profile does not give are
    left out."
  - Register intro, now: "Machine names and rated powers are as the company profile lists them, on page 7.
    Specifications it does not give are left out."
  - Source note, before: "…The page shows only what the profile states: each machine's name and type, the service it
    supports and, for the four laser cutting machines, the rated power…"
  - Source note, now: "The machinery on this page is listed in RAWASY's company profile, page 7, which names each
    machine and gives the rated power of the four laser cutting machines. The profile states no other specification
    for these machines, so this page shows none. To discuss a particular part, send your drawings with a quote
    request."
- **Proof of scope.** The final build differs from the build the QA ran on only in these sentences:
  - the visible markup is identical once they are swapped;
  - in the resolved page-data trees, only those `children` strings changed;
  - JS and CSS are identical.
- **New copy** (`src/content/capabilities.ts`) is neutral interface language or reused wording:
  - "Laser cutting systems" — the Laser Cutting page;
  - "Peak laser power" — the services overview;
  - "Rated power" — the service pages;
  - "Not stated in the company profile" — About;
  - the closing invitation's body — the services overview.

## 17. Power rules

- **Where power appears.** Only `powerWatts` from the four laser records, formatted `12,000` with "W" / "واط", the
  digits LTR. Places: the hero plate, the selector, the stage readout, the data list, the chart and the register.
- **The two unrated machines** say "Not stated in the company profile" / "غير مذكورة في الملف التعريفي" in every one of
  those places. Never 0 W, never N/A, never a dash, never an empty bar.
- **No totals.** The hero's "Peak laser power 12,000 W" is the highest stated rating, in the services overview's
  wording. No sum appears; the test rejects 33,000 and 45,000.
- **Tested** in EN and AR: the four values present, the two machines "not stated" everywhere.

## 18. Unsupported-spec guard

Test "no specification the profile does not give", EN and AR. It reads the text of every machine-facts part: the hero
plate, the chart, the console, the register table and cards. It rejects:

- **English:** mm, cm, ton(s), tonne(s), m/min, mm/min, mm/s, tolerance, accuracy, bed size, working / work area,
  table size, thickness, capacity/hour, per hour, rpm, model, manufacturer, brand, kN;
- **Arabic:** مم, ملم, سم, طن, ميكرون (as words), م/دقيقة, متر/دقيقة, في الساعة, التفاوت, دقة التشغيل, دقة القطع, مقاس
  السرير, مساحة العمل, سماكة, سُمك, الطراز, موديل, الشركة المصنعة, الصانع, العلامة التجارية, دورة في الدقيقة.

It also reads every figure, text node by text node. Each must be an index 01–06, the page number 7 or a stated rating.
Finally, the main text never contains the makers' names visible on some photos.

The guard is scoped to the machine UI, as the brief asks. The JSON-LD carries names and URLs only (item 47).

## 19. Media and source size

Only the six profile cut-outs (`machines/*`); no other image is used on the page.

- **Alt text.** The stage photo carries the localized machine name as alt. The plate and selector copies are
  decorative (`alt=""`).
- **One request per photo.** Every instance requests the same size (`sizes="(min-width: 48rem) 560px, 92vw"`), so the
  browser loads each photo once: 6 image requests (tested).
- **Never enlarged.** Width = min(box width, source width, box height × source ratio). Largest CSS size measured at
  nine sizes from 1920 to 320 px, EN and AR:

| Machine | Source px | Hero plate max | Selector max | Stage max | Stage ratio |
| --- | --- | --- | --- | --- | --- |
| Fiber Laser Combo 12 kW | 439 × 207 | 237.5 × 112 (0.541) | 62.4 × 29.4 (0.142) | 439 × 207 | 1.000 |
| Tube Cutting 12 kW | 359 × 206 | 195.2 × 112 (0.544) | 62.4 × 35.8 (0.174) | 359 × 206 | 1.000 |
| Fiber Laser 6 kW | 557 × 209 | 298.5 × 112 (0.536) | 62.4 × 23.4 (0.112) | 557 × 209 | 1.000 |
| Fiber Laser 3 kW | 386 × 213 | 203.0 × 112 (0.526) | 62.4 × 34.4 (0.162) | 386 × 213 | 1.000 |
| CNC Press Brake | 326 × 211 | 173.0 × 112 (0.531) | 62.4 × 40.4 (0.191) | 326 × 211 | 1.000 |
| Laser Welding | 181 × 177 | 114.5 × 112 (0.633) | 43.4 × 42.4 (0.240) | 181 × 177 | 1.000 |

- **Results:**
  - The maximum is 1.000: the stage shows a photo at exactly its own size, never above it. No sub-pixel enlargement
    occurs.
  - Every photo stays inside its box at the six tested widths and across the 48-state matrix.
  - No photo is mirrored in Arabic (tested).
- **Limitation.** The photos are small (181–557 px wide), so on high-density screens they look softer. Item 58.

## 20. Hero

- **Text.** `PageHero` (split), with the existing SEO title and description. The description already lists the
  machinery and its ratings.
- **Facts.** Six machines; four laser cutting systems (the brief's "four machines with stated laser power ratings", in
  the Laser Cutting page's wording); the highest stated rating, 12,000 W. No operational metric, no total.
- **The plate.** A technical composition, not one oversized machine: the six machines on one graphite plate, laid out
  like parts nested on a sheet. Two columns of bays divided by hairlines. Each bay shows:
  - its index (01–06);
  - the photo at 0.53–0.63 of its source size;
  - its floor line;
  - its short name;
  - its rated power where stated.

  Each bay is a link to its machine in the console. A local grid sits behind, and one orange scan pass plays as the
  page opens. There are no dimension labels and no
  figures other than the stated ratings.
- **For the reviewer.** The second fact, "04 laser cutting systems", is a count of the profile's records (the Laser
  Cutting service page shows the same fact). It can be removed if the reviewer prefers only the brief's listed facts.

## 21. Technical equipment stage

- **The bay.** Graphite (`#1e2935` → `#111820`) with a soft spotlight under the machine, the same in both themes. Its
  edge turns `#354353` on the dark page so the bay stays defined.
- **On the stage:**
  - the photo standing on the floor axis;
  - a short orange floor line under the shown machine;
  - an index chip ("01 / 06");
  - a readout: the rated power, or "Not stated in the company profile";
  - a source chip ("Company profile · p.7");
  - the process sketch with its caption;
  - the scan line.
- **Beside the stage, the data panel:**
  - the h3 name;
  - the type, with an icon;
  - the capability sentence;
  - a `dl` of rated power, related service and source;
  - "Request a quote" and "<service> service".
- No spec badge was invented to fill space.
- On narrow stages (a container query under 30 rem), the source chip leaves the stage. It stays in the data list.

## 22. Local grid / axis treatment

- **Grid.** Lines every 24 px with stronger ones every 96 px, faded towards the edges by a radial mask. It sits inside
  the hero plate and the stage bay only.
- **Floor axis.** One line with unnumbered ticks every 24 / 96 px.
- **No labels:** no numbers, no X / Y letters, no rulers, no registration marks.
- **Retired design.** Nothing of it is restored: no site-wide blueprint, `TechnicalFrame`, `ScanLine`, `PointerLight`,
  page wipe, loader or old shell.

## 23. Scanning animation

- **Construction.** `.cm-scan` is a clipping track inside the stage (and the hero plate). Its `::before` is a 2 px
  orange line; its `::after` is the light trailing behind it.
- **Motion.** Moved with the `translate` property and opacity only: no filter, no blur. Invisible at rest (opacity 0
  at both ends).
- **When it plays:**
  - the hero: one pass (2.2 s) as the page opens;
  - the stage: one pass (1.5 s) each time a machine is shown.
- **Off screen.** The stage's pass and sketch are paused while the console is off screen. `--cm-play` is `running`
  only under the motion controller's `[data-live]`.
- **Not drawn** with reduced motion, without script, or in forced colours.

## 24. Equipment schematic

`Schematic.tsx` has five kinds, chosen from each machine's own type:

- an enclosed laser (cabin, window, head path);
- tube cutting (a tube with a cut ring);
- flat sheet cutting (a sheet with nested parts and a path);
- bending (punch, die and a blank folding);
- welding (two plates and a bead along the seam).

- **Plainly illustrative.** It is captioned "Process concept · illustrative, not to scale" / "مفهوم العملية · رسم
  توضيحي بغير مقياس". It has no figures, angles or dimensions, and no machine geometry.
- **Hidden from assistive technology** (`aria-hidden`); its meaning is in the text.
- **Motion.** It plays once (3.2 s) each time its machine is shown, paused while off screen. It shows the finished work
  with reduced motion, without script, and in forced colours, where it is drawn in system colours.
- **Arabic.** Not mirrored, so no machinery appears reversed.

## 25. Machine transitions

- **Outgoing machine.** It fades out (`--dur-1`) and is `inert` at once. Its visibility switches off after the fade
  (about 170–180 ms during which it is transparent and inert).
- **Incoming machine:**
  - fades in after 0.08 s;
  - its photo rises 14 px onto its floor (`translate`);
  - its data rises 8 px (`translate`);
  - its orange floor line draws out from the centre (`scale` on the line only, an "active orange path").
- **Never used:** blur, 3D, WebGL, canvas, particles or animated filters. The machine image is never scaled.
- **Stress.** After 20 quick cycles (120 changes), no transform is left behind, no animation is still running and
  exactly one panel is opaque (tested; item 39 of the brief, see item 54).
- **The chart.** Its bars grow once from the baseline when it is revealed (`scale` on the bar, motion allowed only).

## 26. Technical register

- **From 64 rem — a real table:**
  - a caption, "Machinery listed in the company profile" (visually hidden);
  - `thead` with `th scope="col"`: No., Machine, Type, Rated power, Related service, Source;
  - each row a `th scope="row"` holding the machine name, a link to its panel.
- **Below 64 rem — one card per machine** (`ol` with an accessible name). Each value sits under its label in a `dl`, so
  no column is clipped and the page never scrolls sideways.
- **Only sourced fields.** No photo column and no empty spec columns (thickness, bed, tolerance, speed). The two
  unrated machines say "Not stated in the company profile".
- **Evidence:** 09 and 10.

## 27. Related-service integration

The current relationship only (the records' `service`, identical to the `machines` lists in `services.ts`):

- the four lasers → Laser Cutting;
- the press brake → CNC Bending;
- laser welding → Metal Fabrication.

- **Each panel** has a "<Service> service" button to `/<locale>/services/<slug>`.
- **`#service-lines`** shows the three services, each with its machines (links into the console) and "Explore the
  service".
- No other service is claimed: not Steel Structures, Scaffolding or Engraving.

## 28. Quote integration

- **Where.** Every panel's "Request a quote", the hero's quote button and the closing invitation all link to
  `/<locale>/contact#quote`.
- **Nothing added.** No query parameter, no machine context injected and no form change.
- **Contact unchanged.** Its files are untouched, its prerendered files identical, and its golden outputs pass
  (item 41).

## 29. EN/AR

- **Copy.** All page copy is in `capabilities.ts`, in both languages. Machine facts come from the localized records.
- **Same structure in both languages:** order, ids, links and structure.
- **Arabic copy** is written as professional Saudi business Arabic, not a literal translation. Examples: "ست معدات… اختر
  إحداها.", "القدرة المقننة", "غير مذكورة في الملف التعريفي".
- **Evidence:** 02, 10, 13 and 15.

## 30. RTL

- **Layout.** `dir="rtl"`; the selector's row flows right to left.
- **Mirrored composition.** The stage composition, the scan line (it travels right to left; `--cm-dir: -1` and a
  mirrored trail) and the chart's bars, which start at the right.
- **Not mirrored.** The photos (tested) and the sketches.
- **Figures.** Digits stay LTR (`dir="ltr"`); the unit is "واط".
- **Faces.** Tajawal for the h1, h2 and h3 and for the semibold labels. IBM Plex Sans Arabic 400/500 for text. Never
  letter-spaced. All tested.

## 31. Light / dark

- **Page.** Surfaces, cards, the register and the chart use the MC tokens in both themes.
- **Stage.** The graphite stage is the same in both themes, as an equipment bay, with a lighter edge on dark. Dark is
  not an inverted copy.
- **Results:** axe 0 violations and per-pixel contrast 0 failures in both themes (item 36). Evidence 02 and 11 show
  dark.

## 32. Forced colours

- **The chosen machine.** A 3 px `Highlight` ring on `::after` (with `forced-color-adjust: none`, since forced colours
  override `outline-color`) and an underlined name. It is never shown by orange, fill or shadow alone.
- **The chart.** Bars in `CanvasText`.
- **Light effects.** The scan line and the floor glow are hidden. The axis becomes a 1 px `CanvasText` line.
- **The sketch** is drawn in `Canvas` / `CanvasText` / `Highlight`.
- **Unchanged system drawing:** table borders, focus outlines, buttons and links.
- **Results:** axe 0 violations in forced colours; tested; evidence 17.

## 33. Reduced motion

- A machine change is immediate (no fade, no rise).
- The scan line is not drawn.
- The sketches show the finished work.
- The bars are at full length.
- No photo drift, no animated spotlight.
- Nothing waits behind a motion state: tested, "nothing in view stays hidden"; evidence 16.

## 34. Responsive matrix

The brief's 12 sizes (1920×1080, 1440×900, 1280×800, 1024×768, 834×1112, 430×932, 412×915, 393×852, 390×844, 375×812,
360×780, 320×700) were checked two ways.

- **e2e (EN and AR):** no sideways scroll and nothing outside the screen at all 12 sizes.
- **QA script (EN / AR × light / dark = 48 states),** each opened cold at one machine's address (the six in turn). It
  checks:
  - sideways scroll;
  - elements outside the screen;
  - text drawn outside its box, line by line: machine names (including the 12000W ones), the selector, the register,
    buttons, the source note;
  - clipped names;
  - photo scale and containment;
  - the landing (the machine shown, below the header);
  - console errors.

  Result: **48 of 48 states pass**. In every state: no sideways scroll, nothing outside the screen, no text outside its box, no clipped name, every photo at most 1.000 of its source and inside its box, the landing exactly at its place (0 px) with that machine shown, and no console error.
- **Layouts.** Selector + stage + data side by side from 80 rem. The selector row above the stage and data from 64 rem.
  Stacked below, with the selector scrolling sideways.

## 35. 320 reflow

- **Widths.** At 320 px, and at 200 % zoom of a 1280 × 720 window (640 × 360 CSS), EN and AR: no sideways scroll,
  nothing outside the screen. The selector scrolls inside itself, and the register is cards.
- **Evidence 19** shows the hero, the chart, the console and the register at 320 px.
- **Header boundary.** The header's known boundary below 320 CSS px was not touched.

## 36. Accessibility

- **axe-core 4.13.0** (WCAG 2.0/2.1/2.2 A and AA plus best practice; target size included) on the final build: **0 violations in all 10 states** (so 0 serious or critical). axe lists colour contrast as "needs review" for text on gradients and photos, which it cannot judge; the per-pixel check below covers those.
  States: EN light desktop, EN dark desktop, AR light desktop, AR dark desktop, EN phone, AR phone, forced colours, the
  selector changed (EN, CNC press brake), the selector changed (AR dark, laser welding) and a deep link (AR phone
  `#fiber-laser-6kw`).
- **Per-pixel contrast** of every text node, unrounded, with the ambient behind it: **0 text nodes below AA** (4.5 : 1, unrounded) in EN / AR × light / dark, at 1440 px (196 / 199 nodes) and at 390 px (180 / 186 nodes). On phones the sticky header is hidden for the measurement. A first phone probe took the header out of the page flow instead and so measured the breadcrumb under the header's place (1.0 : 1): a probe artefact, not a page finding.
- **Manual checks:**
  - **Keyboard:** from the skip link to the first machine card in 31 Tab presses (the hero plate's six links and the
    chart's rows come first). Tab moves along the cards, Enter shows one and keeps focus. The panel's links follow, and
    hidden panels are never reached (`inert`). No trap.
  - **Focus:** a 2 px solid ring, `rgb(44, 94, 134)`.
  - **Screen reader semantics (accessibility tree):**
    - one h1, with h2 per section and h3 per machine;
    - the breadcrumb;
    - `navigation "Choose a machine"` with links such as "Fiber Laser Combo 12,000 W Laser Cutting";
    - the shown machine an `article` named by its h3;
    - its power, service and source as a term / definition list;
    - "Request a quote" and "Metal Fabrication service" as links;
    - a polite status announcing each change;
    - the register a table with its caption and headers;
    - decoration hidden (grid, ticks, scan, sketch, indices).
  - **Target sizes:** axe's target-size rule passes.
  - **Reflow and 200 % zoom:** item 35.
  - **Reduced motion:** item 33.
  - **No JS:** item 14.
- **Finding, explained.** During a change, the outgoing panel is still `visibility: visible` (transparent and inert)
  for about 170 ms, then it is hidden. A probe right after a click therefore lists two visible panels. This is by
  design and causes no keyboard or reader exposure.

## 37. All 12 machine deep links

Test group "cold deep links with delayed fonts":

- **Cases:** each of the 12 addresses (EN / AR × six slugs) × a desktop (1440 × 900) and a phone (390 × 844) × fonts
  held back 300 and 1,200 ms, each in a fresh browser context.
- **Checks:** the right page and target; only that machine shown and marked; the address unchanged; landed within
  1 px of its place below the header at the load event, after the fonts and at rest; no console error.
- **Result:** all pass on the final build (part of item 54).
- **QA matrix.** The matrix landed 48 more cold addresses (item 34).
- **Evidence:** 14 and 15.

## 38. Language switching with the hash

- **The links.** `MachineAddressLink` is used in all three language switches: the desktop bar, the compact phone
  control and the menu sheet. Example: `/en/capabilities#fiber-laser-6kw` ↔ `/ar/capabilities#fiber-laser-6kw`.
- **They follow the address** after a selector choice (`mc:machine`), a hashchange and Back / Forward.
- **Other fragments.** One that names no machine (for example `#register`) gives the plain page address.
- **Language choice.** It is remembered (the `NEXT_LOCALE` cookie), like every language link.
- **Tested** EN → AR and AR → EN, in all three switches.
- **Header change.** `Header.tsx` now hands a given `sameAddressLink` to every switch. The 404, which passes
  `SamePageLink`, behaves as before; every other page passes none, and their HTML and payloads are identical.

## 39. Homepage machinery regression

- **Source.** `Machinery.tsx` and `MachineShowcase.tsx` are byte-identical to TM-3. A test pins their SHA-256:
  `434d1bc5…0eb32` and `d39c9a5d…d6a94`.
- **Build.** The homepage's prerendered HTML, RSC and segments are identical to the TM-3 build (12 of 12 files,
  normalized), and its JavaScript is identical (10 files, same contents). Its CSS: the shared sheet gained one rule
  (`.max-w-[46rem]`); the stylesheet list is unchanged.
- **Pixels** (reduced motion, animations held; TM-3 build vs this build):
  - the machinery section, EN / AR × light / dark: identical, 0 pixels;
  - the whole homepage at 390 px, EN / AR × light / dark: identical;
  - at 1440 px, EN light / dark: identical.
- **Arabic at 1440 px.** Full-page captures differed only in the 72 px header band, a scroll-state capture artefact:
  - viewport by viewport: light 9 of 9 identical; dark 8 of 9 identical, the first differing only in its header band;
  - a fresh load of the top screen: identical in both themes.
- **Behaviour.** The same order, images, selector, animation and links. All six machine title links now land on their
  machines, in EN and AR (12 tests; item 54). Evidence 20.

## 40. Service-page machine-link regression

- **Unchanged pages.** All 14 service pages (the overview and the six, EN / AR) have identical prerendered files and
  JavaScript. Laser Cutting's machinery section is pixel-identical, EN / AR × light / dark.
- **Every link lands.** Every machine link on the service pages was followed in EN and AR — Laser Cutting's four, CNC
  Bending's one, Fabrication's one: 12 tests. Each checks the path, the fragment, that the target exists, that the
  machine is shown and marked, the landing below the header and the name in view.
- **Evidence:** 21 and 22.

## 41. Contact regression

- Prerendered files identical (12), JavaScript identical. `QuoteForm` untouched.
- `commerce-contact.spec.ts` passes, including the golden email, WhatsApp and copy outputs and the no-JS mailto
  submission.

## 42. Projects regression

- The overview's files (12) and the 34 planned project pages' files (476) are identical; JavaScript is identical.
- `commerce-projects.spec.ts` passes: the 27 anchors, the filters, D4 on About and the service pages, and the homepage's
  `#gallery` links.
- `commerce-planned.spec.ts` passes for the project placeholders.

## 43. Certificate safety

- No certificate work.
- Prerendered files identical.
- `commerce-certificates.spec.ts` passes: the file hashes and the digit guard.

## 44. TM-3 regression

No TM-3 file changed. The checks:

- `commerce-polish.spec.ts` passes: the switches and logos in forced colours, the inner hero's first paint, the phone
  menu sheet's geometry, and the Industries cards at every width.
- `commerce-anchors.spec.ts` passes: the shared anchor behaviour.
- `site.spec.ts` passes: the fallback 404 and its logo, whose CSS and JS are identical.

## 45. Theme Lab regression

- **No change.** Every lab page (A, A V2, B, C and their system sheets, EN / AR: 96 prerendered files) is identical, and
  each page's JavaScript and CSS are byte-identical to TM-3.
- **Tests.** `theme-lab.spec.ts` and `theme-lab-a-v2.spec.ts` pass.
- Capabilities was not added to the lab.

## 46. SEO

- **Title** kept: "Capabilities & Machinery | RAWASY" / "القدرات والمعدات | رواسي".
- **Description** kept (it already lists the profile-backed machinery).
- **Kept tags:** canonical, `hreflang` en / ar / x-default, Open Graph and Twitter (`summary_large_image`).
- **Robots:** `noindex, follow`.
- **Tested** in EN and AR.

## 47. Structured data

Three JSON-LD blocks, factual only:

1. `CollectionPage`: url, name, description, `inLanguage`, `isPartOf` the site's `#website`, `about` its
   `#organization` (the existing graph).
2. `BreadcrumbList`: Home → Capabilities.
3. `ItemList`: the six machines, in the page's order. Each item has its localized name and URL
   (`…/capabilities#<slug>`).

No power, specification or maker is in the JSON-LD (tested).

## 48. noindex / sitemap

- `robots: noindex, follow` on both languages.
- `/sitemap.xml` lists neither page (tested).
- The homepage is still the only published page.

## 49. Performance

Headless Chromium, software compositing (the worst case), 1440 × 900, the mouse off the page. Stage 1E (final build)
against the placeholder it replaces (TM-3 build):

| | EN, Stage 1E | EN, placeholder | AR, Stage 1E | AR, placeholder |
| --- | --- | --- | --- | --- |
| Requests | 22 | 15 | 31 | 24 |
| Transferred (cold, compressed) | 343.7 KB | 271.7 KB | 490.8 KB | 418.2 KB |
| JavaScript | 9 files, 148.1 KB | 8 files, 144.6 KB | 9 files, 148.1 KB | 8 files, 144.6 KB |
| CSS | 2 files, 31.9 KB | 2 files, 26.7 KB | 2 files, 31.9 KB | 2 files, 26.7 KB |
| Images | 7, 47.7 KB | 1, 0.0 KB | 7, 47.7 KB | 1, 0.0 KB |
| Fonts | 3, 83.6 KB | 3, 83.6 KB | 12, 229.6 KB | 12, 229.6 KB |
| Document | 32.4 KB | 16.8 KB | 33.5 KB | 17.3 KB |
| LCP | 336 ms | 200 ms | 408 ms | 312 ms |
| CLS | 0 | 0 | 0.0046 | 0.003 |

- **Frame rate:** hero scan 59.5 / 58.6 fps (EN / AR); top-to-bottom scroll 60.1 / 60.1; switching (a new machine every 500 ms, two rounds, the console on screen) 59.0 / 59.7. All are at least 55. The 95th-percentile frame is 16.8 ms in every run. The worst single frames are 66.7 / 99.9 ms in the first frames of the page load (hero scan) and about 50 ms while switching.
- **The increase is expected.** The placeholder was a heading and a note. The page adds:
  - six photos, each loaded once (≈ 48 KB in all);
  - its own stylesheet (26.2 KB raw);
  - the console's and the language links' client code;
  - the document's six panels, register and chart.

  No WebGL, canvas, particles, animated filters, video, extra ambient layer or backdrop blur. The benchmark was not
  tuned.
- **CLS.** The Arabic CLS is the site-wide Arabic font swap (not preloaded; TM-3 open item, Stage 1J).

## 50. `npm ci`

- Exit 0: 374 packages added, 375 audited. One notice: the existing eslint 9.39.5 deprecation.
- **New since TM-3 correction 2: `npm audit` reports 5 high-severity vulnerabilities.** The lockfile is unchanged; a new
  advisory affects packages already installed:
  - `braces`, GHSA-vfj7-8cjw-p6xm, through `micromatch` → `fast-glob` → `@next/eslint-plugin-next` →
    `eslint-config-next`;
  - development tooling only (lint), never shipped to the site;
  - the fix offered (`npm audit fix --force`) would downgrade `eslint-config-next` to 14.2.35, a breaking change.

  It was not applied in Stage 1E (outside its scope; a dependency decision for the user).

## 51. `npm run lint`

Exit 0, no warnings.

## 52. `npm run typecheck`

Exit 0 (`next typegen && tsc --noEmit`).

## 53. `npm run build`

- From an empty `.next`: exit 0, compiled in 7.0 s, **125 static pages** (125 / 125), no warnings.
- `/en/capabilities` and `/ar/capabilities` are prerendered (SSG).

## 54. E2E result

- **Final build:** **490 tests: 490 passed, 0 failed, 0 skipped, 0 flaky; retries off (0)**. It took 14.5 min on 3 workers with nothing else running, and Playwright started its own server on the final build.
- **Two earlier runs on the final build had failures from the test server, not the site.** Both are reported here;
  neither is counted as the result.
  1. **The server was stopped mid-run.** It had been started in the background without a longer time limit, and the
     session stopped it at its 30-minute limit. Result: 424 passed, then 66 failed, every one with
     `ERR_CONNECTION_REFUSED` (65) or `ECONNREFUSED` (1). No assertion failed.
  2. **A stuck image request.** The server was restarted with a 2-hour limit. Result: **489 passed, 1 failed**:
     `theme-lab.spec.ts` "option C: no sideways scroll from phone to laptop widths" timed out after 60 s waiting for
     `networkidle`.
     - *The cause:* the server's image optimizer never answered one request, `/_next/image?url=/media/services/
       scaffolding-2.webp&w=828&q=75` (asked for at 834 px). curl got no reply in 15 s, and the test then failed 5 of
       5 against that server.
     - *A fresh server process on the same build and cache* answered the same request in 0.16 s, and the test passed
       3 of 3 against it (7.1–7.4 s each).
     - *Unrelated to Stage 1E:* the theme lab's files are byte-identical to TM-3. TM-3 correction 2's report records a
       timeout of the same lab C test.

  The clean run above let Playwright start its own server, so no long-running server was involved.
- **Before the copy correction**, on the QA build: 472 tests, 472 passed, 0 failed, 0 flaky (14.1 min).
- **Count:** TM-3: 421 tests in 14 files. Now: 490 tests in 15 files.
  - +72 `commerce-capabilities.spec.ts` (new);
  - −5 `commerce-planned.spec.ts`: its 7 Capabilities tests moved out. Two of them (reduced motion, no-JS) also covered
    project pages, so they stay as two project-page tests;
  - +2 `stage-1c.spec.ts` (`INNER_PAGES` gains Capabilities: routes / SEO and the no-JS check now cover it).
- **Capabilities tests moved from `commerce-planned.spec.ts`:**

| Removed (planned page) | Covered now by |
| --- | --- |
| this design, title, description, h1, robots, canonical, hreflang, OG, Twitter, sitemap, header + footer marks (EN, AR) | "the page" tests (EN, AR) + `stage-1c.spec.ts` routes / SEO |
| "In development · 1E", pending note, back / contact buttons, "nothing 1E builds" | inverted: the built page has no placeholder text (1E spec + `commerce-services.spec.ts` D5), and every part is tested |
| language switch + cookie + theme | "the language switch keeps the machine …" (EN, AR) + "the theme …" |
| Arabic Tajawal / Plex, no letter spacing, no Google fonts | "Arabic: Tajawal for the title and the semibold labels …" |
| phone: menu sheet marks Capabilities, no overflow at 390 / 320 | "phone: the selector scrolls sideways … the menu sheet's language switch …" + "twelve sizes" |
| reduced motion: nothing hidden | "reduced motion: nothing moves …" + `stage-1c.spec.ts` |
| no-JS complete, light theme | "without JavaScript: every machine is on the page …" + `stage-1c.spec.ts` |
| decoration hidden on Capabilities | "one h1, labelled regions and table, decoration hidden …" |

- **Added in the final checks:**
  - every machine link from the homepage showcase (6 × 2) and the service pages (6 × 2) is followed;
  - the 20-cycle stress test also compares the page's own event listeners by type and source (before / after), checks
    the console for warnings, and uses the keyboard after the cycles.
- **Why the stress test counts only the site's listeners.** It first counted every window listener and saw 13 more after
  the cycles in one run. They came from Playwright's own injected script: its hit-target listeners around each click.
  The site's listeners were unchanged. The test now counts only listeners whose script has a URL. A probe under the
  same and heavier parallel load showed no growth, and the test then passed 6 of 6 repeats on three workers.

## 55. Repeated Clients test

`npx playwright test e2e/commerce-company.spec.ts -g "in forced colours the switch still shows its state"
--repeat-each=25`, on the final build: **25 passed, 0 failed** (31.0 s).

## 56. Screenshots

22 images, all from the final build except 20. Number 20 compares the TM-3 build with this one; the homepage is
byte-identical between this build and the one it was taken on.

1. `01-en-light-desktop-top.png` — EN, light, 1440, page top
2. `02-ar-dark-desktop-top.png` — AR, dark, 1440, page top
3. `03-console-fiber-laser-combo-12kw.png`
4. `04-console-tube-cutting-12kw.png`
5. `05-console-fiber-laser-6kw.png`
6. `06-console-fiber-laser-3kw.png`
7. `07-console-cnc-press-brake.png`
8. `08-console-laser-welding.png`
9. `09-register-en.png`
10. `10-register-ar.png`
11. `11-dark-technical-stage-mid-scan.png` — dark, the scan line and the sketch caught mid-run
12. `12-selector-phone-en.png` — 390, EN
13. `13-selector-phone-ar.png` — 390, AR, dark
14. `14-direct-cnc-press-brake.png` — a cold load of `/en/capabilities#cnc-press-brake`
15. `15-direct-laser-welding-ar-phone.png` — a cold load of `/ar/capabilities#laser-welding` at 390
16. `16-reduced-motion.png`
17. `17-forced-colours.png`
18. `18-no-js.png`
19. `19-reflow-320.png` — four screens at 320 px
20. `20-homepage-machinery-regression.png` — TM-3 build vs this build, pixel-identical
21. `21-laser-cutting-to-machine.png` — Laser Cutting → its machine
22. `22-fabrication-to-laser-welding.png` — Fabrication → Laser Welding, phone

None of them is a judgement of visual quality; that is the reviewer's.

## 57. Known limitations

1. **The photos are small.** Each is shown at most at its own size: on large screens the machines read small on the
   stage, and on high-density screens they look soft. The composition carries the stage (item 58).
2. **Maker markings.** Some cut-outs show small maker markings on the machines. The page never names a maker or model;
   RAWASY should confirm the markings may stay visible.
3. **History.** The selector replaces the history entry: Back leaves the page rather than stepping through choices.
   This is deliberate ("without breaking browser history"). The page's other machine links add entries, and Back /
   Forward follow them.
4. **No-JS language links** drop the machine fragment (the server cannot know it).
5. **No-JS late fonts.** Without script, a web font that swaps in after the first layout can still move a cold
   landing. This is TM-3's open item 5, site-wide and unchanged.
6. **During a change** the outgoing machine stays visible and transparent for about 170 ms (item 36).
7. **Weight.** The page is heavier than the placeholder (item 49). The Arabic CLS is the site-wide font swap (Stage
   1J).
8. **`npm audit`** reports a new advisory in the lint toolchain (item 50).
9. **The descriptions.** The process sketches are illustrative only. The types, capability sentences and service links
   are the records' wording, not the profile's (item 59).
10. **Open items carried over:**
    - the header below 320 CSS px;
    - the OG images (Stage 1J);
    - the Arabic font preload (Stage 1J);
    - the unused dictionary keys.

## 58. Asset limitations / request for machine photography

The six cut-outs are low-resolution profile exports, 181–557 px wide. `docs/ASSET_INVENTORY.md` item 17 now asks
RAWASY for:

- original photographs of the six machines, ideally 2,000 px or wider, each machine whole, on a plain background or in
  the workshop;
- permission to show them;
- whether the maker markings may stay visible.

Item 16 (high-resolution photography in general) stays open. Until then the page keeps the never-enlarge rule.

## 59. Outstanding RAWASY confirmations

1. **The machine descriptions** (ASSET_INVENTORY item 18). They are the records' wording, not printed in the profile:
   - what "Combo" covers on the 12,000 W fibre laser (described as enclosed; "RAWASY's highest-rated laser cutting
     platform", although the tube cutter has the same rating);
   - "flatbed" for the 6,000 W and 3,000 W lasers;
   - "handheld" for the laser welding machine.
2. **Each machine's related service:** lasers → Laser Cutting, press brake → CNC Bending, laser welding → Metal
   Fabrication.
3. **Other machines.** Whether RAWASY operates machines beyond the six on page 7: the page says six, as the profile
   lists them.
4. **Machine photography and maker markings** (item 58).
5. **Any further specifications** (maker, model, bed, tonnage, thickness, tolerance, speed…). None is shown until
   RAWASY supplies and confirms it.
6. **Still open from earlier stages** (ASSET_INVENTORY):
   - the Google Maps place link;
   - image rights and AI-watermarked photos;
   - the licence renewal;
   - registration numbers;
   - the engraving photos.

---

## How to run

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:e2e        # starts next start on :3400 (or reuses it); E2E_BASE_URL for another server
npx playwright test e2e/commerce-capabilities.spec.ts
```

Pages: `/en/capabilities`, `/ar/capabilities`, and any machine address, for example `/en/capabilities#cnc-press-brake` or
`/ar/capabilities#laser-welding`.

## Next steps

- **Independent review** of Stage 1E.
- **Not started**, waiting for the user's word: Stage 1F, 1I and 1J, the theme lab's removal, OG regeneration and
  deployment.
