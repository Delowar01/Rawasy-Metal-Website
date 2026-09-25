# RAWASY — Asset Inventory (Phase 1A)

Source material supplied for Phase 1:

| File | Notes |
| --- | --- |
| `Logo_.pdf` (A4, vector, Illustrator 29.8) | Master logo. Mark + Arabic wordmark are vector paths; the Latin "RAWASY" wordmark is set in the *Sanidana* typeface and was converted to outlines for the web. |
| `Logo_.eps` (682×235 pt) | Same artwork as the PDF (not needed for web output). |
| `1.jpg`, `2.webp` | Raster lockups: grey `#404241` and black `#1D1E1E` versions. |
| `LOW SIZE PDF File RAWASY COMPANY PROFILE.pdf` (16 pp.) | All copy is outlined (not selectable); text was read visually. Embedded photos are ~100 ppi exports (see *Image resolution* below). |

Every web asset below was produced by [`scripts/extract-profile-assets.py`](../scripts/extract-profile-assets.py).
Sizes and blur placeholders are registered in [`src/content/media.generated.ts`](../src/content/media.generated.ts).

---

## 1. Brand / logo

| Asset | Path | Notes |
| --- | --- | --- |
| Full lockup (mark + رواسي + RAWASY) | `public/brand/rawasy-logo.svg` | Charcoal `#404241` + orange `#F15F22`. |
| Lockup for dark surfaces | `public/brand/rawasy-logo-on-dark.svg` | Warm off-white `#ECEAE5` + orange. |
| Mark only | `public/brand/rawasy-mark.svg` | Two angular elements — used for favicon, loader and motion. |
| Inline React versions | `src/components/brand/Logo.tsx` | `currentColor` for the charcoal parts, so the logo follows the active theme. The two mark elements stay separate paths so they can "lock into position" in the loader — the artwork itself is never distorted. |

Brand colours measured from the vector file: **Orange `#F15F22`**, **Charcoal `#404241`** (grey lockup) / **`#1D1E1E`** (black lockup).

## 2. Machinery (profile p.7) — transparent cut-outs

| Machine (as named in profile) | Path | px |
| --- | --- | --- |
| 12000W Tube Cutting Machine | `public/media/machines/tube-cutting-12kw.webp` | 359×206 |
| 6000W Fiber Laser Machine | `public/media/machines/fiber-laser-6kw.webp` | 557×209 |
| 12000W Fiber Laser Combo Machine | `public/media/machines/fiber-laser-combo-12kw.webp` | 439×207 |
| 3000W Fiber Laser Machine | `public/media/machines/fiber-laser-3kw.webp` | 386×213 |
| CNC Press Brake Machine | `public/media/machines/press-brake.webp` | 326×211 |
| Laser Welding Machine | `public/media/machines/laser-welding.webp` | 181×177 |

Only the machine names and power ratings above are used. **No** brands, bed sizes, thickness, tolerance, speed or output figures are shown — none are stated in the source.

## 3. Services (profile p.3–6)

| Service | Media | Likely source |
| --- | --- | --- |
| Laser Cutting | `site/laser-sparks`, `site/laser-head` + project photos (tree, lantern, clock tower, tower replica) | Cover photos look like stock; project photos are RAWASY work (confirm). |
| CNC Bending | `services/cnc-bending-1…3` | Look like stock photography — confirm licence. |
| Steel Structures | `services/steel-structures-1…4`, `site/steel-beams-hall`, `site/steel-frame-dusk` | Look like stock — confirm. |
| Fabrication | `services/fabrication-workshop` (real workshop), `fabrication-cut-sheets`, `fabrication-perforated-beams` (real), `fabrication-grinding`, `fabrication-welding`, `fabrication-laser-welding` (stock-like) | Mixed. |
| Laser Engraving | `services/engraving-nameplates` (real; third-party branding and serial numbers — kept off the 1D page), `engraving-wood`, `engraving-rotary` (render) | See item 12. |
| Scaffolding | `services/scaffolding-1…5`, `scaffolding-props`, `site/scaffold-silhouettes`, `site/site-engineers` | Look like stock / supplier imagery — confirm. |

## 4. Projects — Work Gallery (profile p.3, p.8–11)

Profile gallery numbers are preserved in `src/content/projects.ts` (`galleryRef`). Titles are descriptive (what is visible); **no** client, location, year, value or scope has been added.

| # | Slug | Media | Categories (from what is visible) |
| --- | --- | --- | --- |
| 01 | `tiered-chandelier` | `projects/chandelier-1` | Decorative metal, laser cutting |
| 02 | `illuminated-lattice-cubes` | `projects/lattice-cubes-1` | Public realm, laser cutting |
| 03 | `colour-lighting-tree` | `projects/lighting-tree-1` | Public realm, custom |
| 04 | `tulip-roundabout-sculpture` | `projects/tulip-roundabout-1…2` | Public realm, architectural metal |
| 05 | `clock-tower-landmark` | `projects/clock-tower-1…3` | Structures, public realm |
| 06 | `wave-form-sculpture` | `projects/wave-sculpture-1…3` | Public realm, fabrication |
| 07 + 08 | `wheat-stalks-monument` | `projects/wheat-monument-1…3` | Public realm, fabrication (08 shows the same piece in the workshop) |
| 09 | `dome-finial-and-crescent` | `projects/dome-finial-1…2` | Decorative metal |
| 10 | `gateway-welcome-signs` | `projects/gateway-signs-1…3` | Structures, public realm |
| 11 | `heritage-cannon-replicas` | `projects/heritage-cannons-1…4` | Decorative metal, laser cutting |
| 12 | `laser-cut-bench` | `projects/laser-cut-bench-1` (3D render) | Public realm |
| 13 | `calligraphic-sculptures` | `projects/calligraphy-sculptures-1` | Decorative metal |
| 14 | `stainless-landmark-sculpture` | `projects/stainless-landmark-1` | Public realm |
| 15 | `laser-cut-components` | `projects/laser-cut-components-1` | Laser cutting, industrial |
| 16 | `perforated-canopy-screen` | `projects/perforated-canopy-1` | Architectural metal |
| 17 | `perforated-seed-sculpture` | `projects/seed-sculpture-1` | Public realm, laser cutting |
| 18 | `palm-leaf-shade-canopies` | `projects/palm-canopies-1` | Structures, public realm |
| 19 | `car-park-shade-structures` | `projects/car-park-shades-1…2` | Structures |
| 20 | `illuminated-leaf-sculpture` | `projects/leaf-sculpture-1…2` | Public realm |
| 21 | `billboard-support-structure` | `projects/billboard-structure-1` | Structures, industrial |
| 22 | `perforated-metal-seating` | `projects/perforated-seating-1…2` | Public realm, fabrication |
| 23 | `geometric-lanterns` | `projects/geometric-lanterns-1` | Decorative metal, laser cutting |
| 24 | `laser-cut-tree-grate` | `projects/tree-grate-1` | Public realm, laser cutting |
| 25 | `perforated-screen-enclosures` | `projects/screen-enclosures-1…2` | Architectural metal |
| 26 | `national-emblem-sculptures` | `projects/emblem-sculptures-1…2` | Decorative metal |
| 27 | `globe-and-ring-sculptures` | `projects/vision-globe-1…2` | Public realm |
| 28 | `street-litter-bins` | `projects/litter-bins-1…3` | Public realm |
| 29 | `sculpture-fabrication` | `projects/sculpture-fabrication-1…2` | Fabrication |
| 30 | `perforated-beams-and-pergola` | `projects/perforated-beams-1…2` | Structures, laser cutting |
| 31 | `stainless-steel-handrails` | `projects/stainless-handrails-1` | Architectural metal |
| 32 | `curved-steel-frames` | `projects/curved-frames-1` | Structures, fabrication |
| p.3 | `canopy-tree-sculpture` | `projects/canopy-tree-1` | Public realm |
| p.3 | `suspended-lantern` | `projects/suspended-lantern-1` | Decorative metal |
| p.3 | `lattice-tower-replica` | `projects/tower-replica-1`, `services/fabrication-workshop` | Structures, fabrication |

## 5. Clients (profile p.12)

21 logos with the background removed (`public/media/clients/<slug>.webp`), plus a monochrome
silhouette of each (`<slug>-mono.webp`, alpha normalised so pale logos read as strongly as dark ones). The site
shows the silhouettes and loads a logo's original colours only when it is hovered. alfanar Steel Structures · Alkharayef Industries · ARCOMA · Obeikan Tensile Structures · Rakayiz Iron Co. · Lamsat Injaz Contracting Co. · BTT Furniture · Manar Alomran Formwork & Scaffolding · AITCO · Raqyah Metal Industries · Sahar Al-Riyadh Aluminium Factory · Atlas Elevators · Al-Bereik Tents · Metal Details Company for Industry · STECO · Trolley Carriage & Iron Works Factory · TBK Metal Saudi · LEDCO · Arabian Metal Industries (AMI) · ISF Industrial Steps Factory · SSF.

## 6. Certificates (profile p.13–15)

| Document | Public preview | Redacted |
| --- | --- | --- |
| Commercial Registration (Ministry of Commerce) — Arabic + English | `certificates/commercial-registration-ar`, `-en` | CR / national number, QR codes |
| VAT Registration (ZATCA) | `certificates/vat-registration` | TIN, certificate no., barcode, VAT number, address line, CR/ID no., QR |
| Commercial Activity Licence (Balady — Riyadh Region Municipality) | `certificates/commercial-activity-licence` | Workshop name (contains a personal name), licence number, expiry date, owner ID, QR codes |

Redaction is a solid hatched block (nothing of the original survives). Thumbnails are additionally blurred.

## 7. Contact (profile p.16)

- Address: Al Mashael, Sulay, Riyadh 14325
- Phone / WhatsApp: +966 53 736 8310, +966 55 261 6189
- Email: rawasymetal@gmail.com
- Facebook: facebook.com/Lasercuttinganddesign
- Website: www.rawasymetal.com

---

## Items that need RAWASY's confirmation before launch

1. **High-resolution photography.** The supplied profile is a "low size" export: photos are 100 ppi, mostly 150–770 px wide (only the Riyadh skyline cover is 2029 px). The site presents them at close to native size, but the original photo files are needed for a premium result — drop them into `public/media` with the same names.
2. **Image rights.** The cover, CNC-bending, steel-structure, welding and scaffolding photos look like stock/supplier imagery. Please confirm licences or supply RAWASY's own photography.
3. **Portfolio authenticity.** Please confirm every work-gallery item was produced by RAWASY. A few pieces (canopy tree sculpture p.3, illuminated cubes #02, seed sculpture #17) resemble published international artworks.
   - **AI-image watermark:** the finished-installation photos of **#07 wheat monument**, **#14 stainless landmark** and **#21 billboard structure** carry the "✦" sparkle mark that Google Gemini adds to AI-generated or AI-edited images. They may be visualisations rather than photographs. They are kept in the data but excluded from every featured placement until RAWASY confirms them (the #08 workshop photos of the wheat monument look genuine).
   - #25: a camera GPS/time stamp was cropped off the second photo; #18: a near-duplicate photo was dropped.
4. **Product renders.** #12 (bench) and #28 (bins) are catalogue renders; one #28 image carries a supplier model label and has been excluded. Confirm these are RAWASY products.
5. **Commercial Activity Licence expiry** shows 1447/04/04 AH (≈ late September 2025). Please provide the renewed licence. The date is hidden on the site.
6. **Registration numbers.** CR and VAT numbers are withheld pending approval for public display.
7. **"New Struck(s)"** (About / Scaffolding text) is unclear and has been omitted until clarified.
8. **Metrics.** Only source-backed figures are shown (12,000 W peak laser power, 360° bevel cutting, six service lines). The licence lists a 935 m² shop area — not used until approved. No project counts, years or team sizes are shown.
9. **WhatsApp number.** Both numbers carry a WhatsApp icon; +966 53 736 8310 is used as the primary chat link.
10. **Email.** A domain address (e.g. info@rawasymetal.com) would suit the new brand better than Gmail.
11. **Vision 2030 mark** appears on the profile cover. It is a government mark and has not been used.
12. **Laser engraving photography (Stage 1D).** The engraving service page shows no photographs. The
    only engraving photo, `services/engraving-nameplates`, shows third-party (HITACHI) branding with
    legible part and serial numbers, and `engraving-wood` / `engraving-rotary` are renders; the page uses
    a drawn, engraved brass plate and material swatches instead. Please supply photos of RAWASY's own
    engraved work (no third-party brands or data) or confirm permission for the nameplates photo. The
    services overview (approved in V2) still uses the nameplates photo as the engraving cover and the
    wood render as its second image.
13. **Service page imagery (Stage 1D).** The service pages add `site/welder-sparks` (fabrication hero),
    which looks like stock, to the photos listed in section 3 — please confirm its licence. Gallery
    captions describe only what is visible in each photo.
14. **Which services each project used.** Service pages link only projects whose record lists that
    service. So the stainless handrails (#31) are not linked to CNC bending, and the calligraphic
    sculptures (#13) and cannon replicas (#11) are not linked to laser engraving. RAWASY can confirm
    the services behind each project to enrich these links.
15. **Machine anchors.** Machine cards on the service pages link to `/capabilities#<machine>`; the
    Capabilities & Machinery page (Stage 1E) is still in development.
