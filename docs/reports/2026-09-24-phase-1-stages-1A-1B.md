# RAWASY Metal Website — Phase 1 Progress Report
## Stages 1A (Foundation & Design System) and 1B (Homepage)

- Date: 24 September 2026
- Repository: github.com/Delowar01/Rawasy-Metal-Website
- Branch: claude/new-session-5eijs6 (build commit 37ada0e)
- Status: Stages 1A and 1B are complete. The homepage is at the approval gate: inner pages will not be designed until the homepage direction is approved.

---

## 1. Summary

- A new bilingual corporate website for RAWASY UNITED INTERNATIONAL CO. LTD. (شركة رواسي المتحدة العالمية المحدودة): English (left-to-right) and Saudi business Arabic (right-to-left).
- The whole foundation is finished: asset extraction, route architecture, content models, language system, light/dark theme system, typography, shared site shell and motion system. The full homepage is built on top of it.
- All 14 Phase 1 pages exist in both languages. The inner pages show an "in development" page and are hidden from search engines until their designs are approved.
- Checks passed: the production build, lint and type checks, and 31 of 31 automated browser checks. There are no console errors and no sideways overflow on desktop, tablet or mobile, in English and Arabic, in light and dark themes.

## 2. Source material used

- RAWASY company profile PDF: 16 pages, a "low size" export. Its text is outlined, so it was read visually.
- Logo files: Logo_.pdf (vector master), Logo_.eps, and grey and black raster lockups.
- The Phase 1 master brief.
- Brand colours measured from the vector master: orange #F15F22, charcoal #404241 (grey lockup) and #1D1E1E (black lockup).

## 3. Stage 1A — Foundation & design system

**Technology**
- Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript, Tailwind CSS v4.
- GSAP 3.15 with ScrollTrigger, used only for the hero and scroll-driven scenes. Simple reveals use CSS with IntersectionObserver.
- 109 pages are generated at build time: every route in both languages, including 6 service pages and 34 project pages per language.

**Asset pipeline and inventory**
- Logo: rebuilt from the vector master as clean SVGs (full lockup, lockup for dark backgrounds, mark only) plus a theme-aware React component. The logo artwork is never distorted.
- 93 photographs extracted from the profile at their native resolution, saved as WebP with blur placeholders.
  - White letterbox bars trimmed.
  - Baked-in grey shadows removed from the machine cut-outs.
  - A camera GPS/time stamp cropped off one photo, and one near-duplicate dropped.
- 21 client logos cut from the profile with their white backgrounds removed, each with a monochrome version.
- 3 registration documents turned into public previews. Registration numbers, barcodes, QR codes and a personal name are covered with solid blocks, so nothing of the original survives.
- Share images (English and Arabic, 1200×630), a favicon and an Apple touch icon.
- The extraction is scripted so it can be re-run: scripts/extract-profile-assets.py and scripts/generate-og.mjs.
- Full provenance, redactions and open questions are in docs/ASSET_INVENTORY.md.

**Route architecture** (the same paths exist under /en and /ar)
- Home
- About
- Services, plus 6 service detail pages
- Capabilities & Machinery
- Projects, plus a project detail template (34 projects)
- Industries
- Clients
- Certificates & Compliance
- Contact / Request a Quote
- Privacy Policy
- Website Terms
- 404

**Language system**
- A visit to "/" goes to /en or /ar based on the remembered choice (cookie), then the browser language, then English.
- The EN | عربي switcher keeps visitors on the equivalent page and remembers their choice.
- Arabic sets dir="rtl" and lang="ar-SA". Layouts use direction-neutral CSS, and every direction-sensitive animation mirrors.
- Arabic copy is written in professional Saudi business Arabic, not translated line by line.

**Content models, ready for the Phase 2 admin panel**
- All content lives in src/content as typed data with English and Arabic fields: company, 6 services, 6 machines, 34 projects, 8 industries, 21 clients, 3 certificates, 6 "Why RAWASY" pillars, 4 metrics, 6 process steps, navigation, SEO and homepage copy.
- Pages read content only through one async repository, so the admin panel can take over storage without changing any components.
- Unknown facts (client, year, location, materials and so on) are optional fields that stay empty. Nothing has been made up to fill them.
- Each item records its source (profile, licence or inferred). Projects carry review flags (AI watermark, authorship to confirm, render).

**Theme system**
- The same set of named colour tokens is defined once for light and once for dark. Components never duplicate styles per theme.
- Light: warm off-white #F3F1ED, stone surfaces, soft charcoal text #1E2021.
- Dark: graphite #17191A, #1E2021, #252728 and #313334. Pure black is never used.
- Orange #F15F22 is used sparingly. Darker or lighter orange variants are used for orange text so it stays readable.
- Theme behaviour:
  - It follows the system setting until the visitor picks one, then remembers the choice.
  - There is no flash of the wrong theme when a page loads.
  - Where the browser supports it, switching themes reveals the new theme with a circular wipe.

**Typography**
- Archivo, a variable-width grotesque, for English headings and text.
- IBM Plex Sans Arabic for Arabic.
- Geist Mono for technical labels.
- Arabic is never letter-spaced and gets more generous line heights.

**Industrial material language** (subtle)
- Brushed-metal gradients, fine structural grids, perforated dot patterns, crop marks and measurement rulers.
- Very light film grain.
- Buttons with a cut corner that echoes laser-cut plate and the angles in the logo.

**Shared shell**
- Floating header that turns to frosted glass on scroll and hides while scrolling down. The navigation highlight slides between links.
- Full-screen mobile menu with numbered links, language and theme controls, a quote button and contact details. It keeps keyboard focus inside and closes with Escape.
- Footer with statement, company, services, contact, preferences, legal links, copyright and an oversized outlined wordmark.
- Small, quiet floating WhatsApp button.
- Skip-to-content link.

**Motion system**
- First-visit intro (about 1.3 seconds): the two logo pieces lock together and the words PRECISION / STEEL / ENGINEERING appear. It can be skipped, plays once per session, and never plays with reduced motion or without JavaScript.
- Section reveals, headline line masks and curtain image reveals.
- Page transition (about 600 ms): a graphite panel with an orange cut edge sweeps in the reading direction.
- Custom cursor that shows VIEW, EXPLORE or DRAG where relevant. It only appears with a mouse and never with reduced motion, and the normal cursor always stays visible.
- With reduced motion, the intro, parallax, cursor tracking, page transitions and continuous motion are turned off, leaving simple fades.
- Without JavaScript, all content is visible.

## 4. Stage 1B — Homepage (13 sections plus footer)

1. **Hero** (who is RAWASY?)
   - Headline: "Engineering metal into possibility." / «نُشكّل المعدن بدقة هندسية ونصنع الممكن.»
   - Buttons: "Explore Our Capabilities" and "Start a Project".
   - A brushed steel plate is cut in sequence: bolt holes, an eight-point star, a slot and a field of perforations. The cuts throw sparks, and the cut pieces fall away.
   - Engineering dimension lines, a crosshair that follows the cursor with a live X/Y readout, a reflection that follows the cursor, and a slight parallax on scroll.
   - A bottom rail shows the location and the six services.
2. **Introduction**
   - Headline statement, the About text from the profile, "Beyond metalwork" tags for scaffolding, formwork, props, rental and transport, and the vision quote.
   - A nameplate with the registered English and Arabic names.
   - A steel I-beam drawing that draws itself in.
3. **Key capabilities** ("From flat sheet to finished structure."): Cut → Bend → Weld → Assemble → Engrave → Erect on a production-line rail. Scrolling lights each station and draws its icon. The rail runs right-to-left in Arabic.
4. **Services** ("Six service lines. One accountable partner.")
   - Desktop: an interactive list. Hovering or focusing a service wipes in its photo, shows the summary and tags, and moves a thin technical line to the selection.
   - Mobile: swipeable cards.
5. **Precision statement** (the signature metal cut, used once): as you scroll, a laser line cuts through "Precision in every cut. Strength in every structure." with sparks, and the lettering splits along the cut. It is mirrored in Arabic.
6. **Machinery** ("The equipment behind the precision.")
   - Six machines as keyboard-accessible tabs: 12,000 W tube cutting, 12,000 W fiber laser combo, 6,000 W fiber laser, 3,000 W fiber laser, CNC press brake and laser welding.
   - A grid stage with axis marks, a scan line on every change, the rated power and the related service.
   - Only the names and powers printed in the profile are shown.
7. **Featured projects** ("Built in metal. Made to be seen."): 6 projects in a staggered editorial layout with curtain reveals and profile gallery numbers. They are the Tulip Roundabout, Clock Tower, Geometric Lanterns, Palm-Leaf Shade Canopies, Wave-Form Sculpture and Suspended Lantern.
8. **Industries** ("Where our metal works."): 8 sectors. On desktop a photo preview follows the cursor; on mobile each row has a thumbnail. Four sectors come from the profile and four are proposed website categories.
9. **Why RAWASY**: six pillars with line-drawn icons: Precision, Technology, Craftsmanship, Reliability, Custom Solutions and Project Execution.
10. **Metrics** ("Capability you can measure.")
    - Four figures that count up: 12,000 W peak laser power, 360° bevel cutting, 04 laser systems and 06 service lines.
    - Four capability statements. Every figure comes from the profile.
11. **Clients**
    - 21 logos in two slow rows moving in opposite directions, shown in monochrome.
    - In the light theme a logo shows its original colours on hover, and the colour file is only downloaded then.
    - The rows pause on hover and become a still grid with reduced motion.
12. **Certificates** ("Registered. Licensed. Accountable.")
    - Commercial Registration, VAT Registration and Commercial Activity Licence, each shown with a few non-sensitive facts.
    - "View certificate" opens a pop-up with the redacted previews.
13. **Call to action** ("Have a drawing, a concept or a challenge? Let's shape it in metal."): three steps, "Start a Project" and "Chat on WhatsApp" buttons, and the phone number and email over a night photo of Riyadh.

**Also built**
- The shared footer.
- A localized 404 page ("Outside the blueprint" / «خارج المخطط») plus a bilingual fallback 404.
- Interim pages for every inner route that already show real content: the service list, the project list, contact details, service highlights and project cover photos with breadcrumbs.

## 5. SEO

- Every page has a localized title and description, a canonical URL, language alternates (en, ar and x-default), Open Graph and Twitter tags, and English and Arabic share images.
- Structured data:
  - Homepage: Organization, LocalBusiness and WebSite.
  - Detail pages: Service and BreadcrumbList.
- sitemap.xml includes language alternates, and robots.txt, the web manifest and the icons are in place.
- src/lib/page-meta.ts controls which pages are published. Today only the homepage is published; interim pages are served as noindex.
- Canonical domain: https://www.rawasymetal.com (from the profile). It can be changed with NEXT_PUBLIC_SITE_URL.

## 6. Accessibility

- Semantic landmarks, a skip link, visible focus styles, and keyboard support throughout. This includes the menu's focus handling, arrow keys on the machinery tabs, and closing the certificate pop-up with Escape.
- Every image has alt text in its own language.
- Correct lang attributes on mixed-language text.
- Reduced-motion support, and all content is visible without JavaScript.

## 7. Performance

Measured on a local production server without throttling, so treat these as indicative:
- Initial page transfer: about 609 KB on desktop and 525 KB on mobile.
- LCP (when the largest element appears): about 0.39 s on desktop and 0.25 s on mobile.
- Homepage HTML: about 62 KB gzipped.
- Images are optimized and lazy-loaded, with blur placeholders.
- Fonts are self-hosted through next/font.
- Heavy animation code only runs where it is needed, and all listeners are cleaned up.

## 8. Quality assurance

- Production build, lint and TypeScript: all pass.
- Automated browser checks, 31 of 31 passing:
  - Intro: shows on the first visit, clears in under 2 s, is skipped on repeat visits.
  - Theme: follows the system setting, toggle persists, no flash on reload.
  - Language: lands on the equivalent page, sets RTL direction, remembers the choice.
  - Mobile menu: opens, keeps focus inside, locks scrolling, closes with Escape and returns focus.
  - Service explorer on hover, machinery tabs with arrow keys, certificate pop-up open and close.
  - Page transition, reduced motion, no-JavaScript rendering.
  - All 46 internal links resolve.
  - No console errors in any scenario.
- Visual review: desktop (1440 and 1280 px), tablet (834 px) and mobile (390 px), in English and Arabic, light and dark. No sideways overflow.
- Routing:
  - "/" redirects to /en or /ar with a 307 as described above.
  - Real pages return 200.
  - Unknown URLs return a real 404 with the localized page.
  - Every asset, the sitemap and robots.txt return 200.
- The repo contains no registration numbers or personal names.

## 9. Items that need RAWASY's confirmation

1. **Original high-resolution photos.** The profile is a low-size export, and most photos are only 150–770 px wide.
2. **Image rights.** The cover, CNC bending, steel structure, welding and scaffolding photos look like stock or supplier images.
3. **Portfolio authenticity.**
   - The canopy tree sculpture (p.3), illuminated cubes (#02) and seed sculpture (#17) resemble published artworks by others.
   - The finished photos of the wheat monument (#07), stainless landmark (#14) and billboard structure (#21) carry the ✦ watermark that Google Gemini adds to AI-generated images. They are kept off the homepage until RAWASY confirms they are real.
4. **Product renders.** The bench (#12) and litter bins (#28) are catalogue renders; one supplier-labelled bin image was left out.
5. **Commercial Activity Licence.** It shows an expiry of 1447/04/04 AH (about September 2025). A renewed copy is needed; the date is hidden on the site.
6. **Registration numbers.** The CR and VAT numbers are withheld until RAWASY approves showing them.
7. **"New Struck(s)".** This service name in the profile is unclear and has been left out.
8. **Metrics.** Only figures printed in the profile are used. The 935 m² shop area and any project counts, years or team size need approval first.
9. **WhatsApp.** +966 53 736 8310 is used as the main number; please confirm.
10. **Email.** A company-domain address (for example info@rawasymetal.com) is recommended instead of Gmail.
11. **Vision 2030 logo.** It is a government mark and is not used.
12. **Location.** The gateway signs project shows "Badr Governorate". No location is published until confirmed.

## 10. Notes and known limitations

- Inner pages are interim pages by design, because of the approval gate.
- The quote request form is part of stage 1G. The contact details are already live.
- Photo sharpness is limited by the low-size PDF source.
- A mistyped service or project link returns a real 404. Next.js 16 builds that page in the browser, so its content appears once JavaScript loads.
- The plate dimensions and part number in the hero are decorative drawing labels, not RAWASY specifications. The hero coordinates are approximate for Riyadh.
- All browser testing so far used Chromium. Safari, Firefox, real devices and full Lighthouse and screen-reader audits are planned for stage 1J.

## 11. How to run

- Install and start: npm install, then npm run dev. Open http://localhost:3000, which redirects to /en or /ar.
- Production: npm run build, then npm start.
- Checks: npm run lint and npm run typecheck.
- Regenerate media: npm run assets:extract -- <company-profile.pdf>. This needs Python with pymupdf, pillow and numpy.
- Regenerate share images: npm run assets:og. This needs Playwright with Chromium; behind a proxy, start the command with NODE_USE_ENV_PROXY=1.
- Key documents:
  - README.md: architecture.
  - docs/ASSET_INVENTORY.md: asset sources, redactions and open questions.
  - src/content: all website text in English and Arabic.

## 12. Next steps

1. Approve the homepage design direction, or send feedback.
2. RAWASY supplies the original photos and answers the confirmation list in section 9.
3. Stage 1C: About, Services overview, Industries, Clients, Certificates, Contact, legal pages.
4. Then:
   - 1D: service detail pages.
   - 1E: machinery page.
   - 1F: projects gallery and detail pages.
   - 1G: clients, certificates, quote form and contact.
   - 1H: Arabic completion.
   - 1I: animation polish.
   - 1J: SEO, performance, QA and release.
5. Phase 2 (the admin panel) starts only after Phase 1 is approved.
