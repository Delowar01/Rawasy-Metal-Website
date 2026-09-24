import type { Industry } from "./types";

/**
 * Sectors. `basis: "profile"` = named in the company profile;
 * `basis: "inferred"` = proposed website classification drawn from the work
 * gallery, not an official company claim.
 */
export const industries: Industry[] = [
  {
    slug: "construction",
    name: { en: "Construction", ar: "المقاولات والبناء" },
    description: {
      en: "Steel frameworks, fabricated components and scaffolding support for building contractors.",
      ar: "هياكل حديدية ومكوّنات مصنّعة ودعم بالسقالات لمقاولي البناء.",
    },
    media: "site/site-engineers",
    source: { basis: "profile", pages: [2, 5] },
  },
  {
    slug: "infrastructure",
    name: { en: "Infrastructure", ar: "البنية التحتية" },
    description: {
      en: "Metal solutions and site support for infrastructure works.",
      ar: "حلول معدنية ودعم ميداني لأعمال البنية التحتية.",
    },
    media: "projects/gateway-signs-3",
    source: { basis: "profile", pages: [2] },
  },
  {
    slug: "industrial",
    name: { en: "Industrial & Manufacturing", ar: "الصناعة والتصنيع" },
    description: {
      en: "Cut, formed and welded parts, and steel structures for industrial facilities.",
      ar: "قطع مقصوصة ومشكّلة وملحومة، وهياكل حديدية للمنشآت الصناعية.",
    },
    media: "site/steel-beams-hall",
    source: { basis: "profile", pages: [3, 5] },
  },
  {
    slug: "commercial",
    name: { en: "Commercial Projects", ar: "المشاريع التجارية" },
    description: {
      en: "Steel frameworks and custom metalwork for commercial buildings.",
      ar: "هياكل حديدية وأعمال معدنية خاصة للمباني التجارية.",
    },
    media: "services/steel-structures-1",
    source: { basis: "profile", pages: [3, 4] },
  },
  {
    slug: "architecture",
    name: { en: "Architecture & Façades", ar: "العمارة والواجهات" },
    description: {
      en: "Laser-cut screens, canopies, perforated panels and handrails.",
      ar: "سواتر مقصوصة بالليزر، ومظلات، وألواح مثقّبة، ودرابزين.",
    },
    media: "projects/perforated-canopy-1",
    source: { basis: "inferred", note: "From work gallery #16, #25, #30, #31." },
  },
  {
    slug: "public-realm",
    name: { en: "Public Realm & Landmarks", ar: "الأماكن العامة والمعالم" },
    description: {
      en: "Roundabout sculptures, towers and illuminated landmarks.",
      ar: "مجسمات الدوارات والأبراج والمعالم المضيئة.",
    },
    media: "projects/tulip-roundabout-1",
    source: { basis: "inferred", note: "From work gallery #04, #05, #06, #20." },
  },
  {
    slug: "street-furniture",
    name: { en: "Street Furniture & Shade", ar: "أثاث الشوارع والمظلات" },
    description: {
      en: "Shade structures, seating, tree grates and amenities.",
      ar: "مظلات ومقاعد وشبكات حماية الأشجار وخدمات الأماكن العامة.",
    },
    media: "projects/palm-canopies-1",
    source: { basis: "inferred", note: "From work gallery #18, #19, #22, #24." },
  },
  {
    slug: "signage",
    name: { en: "Signage & Gateways", ar: "اللوحات والبوابات" },
    description: {
      en: "Gateway signs, sign frames and their steel supports.",
      ar: "لوحات المداخل وهياكل اللوحات ودعاماتها الحديدية.",
    },
    media: "projects/gateway-signs-1",
    source: { basis: "inferred", note: "From work gallery #10." },
  },
];
