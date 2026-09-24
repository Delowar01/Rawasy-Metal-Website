import type { Machine } from "./types";

/**
 * Source: company profile p.7 ("Our Machinery").
 * Only the names and rated powers printed in the profile are used — no brands,
 * bed sizes, thickness, tolerance or speed figures (none are stated).
 */
export const machines: Machine[] = [
  {
    slug: "tube-cutting-12kw",
    name: { en: "12000W Tube Cutting Machine", ar: "ماكينة قص المواسير 12000 واط" },
    shortName: { en: "Tube Cutting", ar: "قص المواسير" },
    category: { en: "Fibre-laser tube cutting", ar: "قص المواسير بالليزر" },
    powerWatts: 12000,
    capability: {
      en: "Laser cutting of tubes, pipes and structural profiles.",
      ar: "قص المواسير والأنابيب والقطاعات الحديدية بالليزر.",
    },
    service: "laser-cutting",
    media: "machines/tube-cutting-12kw",
    source: { basis: "profile", pages: [7] },
  },
  {
    slug: "fiber-laser-combo-12kw",
    name: { en: "12000W Fiber Laser Combo Machine", ar: "ماكينة ليزر فايبر كومبو 12000 واط" },
    shortName: { en: "Fiber Laser Combo", ar: "ليزر فايبر كومبو" },
    category: { en: "Enclosed high-power fibre laser", ar: "ليزر فايبر عالي القدرة بكابينة مغلقة" },
    powerWatts: 12000,
    capability: {
      en: "RAWASY's highest-rated laser cutting platform, in a fully enclosed cabin.",
      ar: "أعلى منصات القص بالليزر قدرةً لدى رواسي، بكابينة مغلقة بالكامل.",
    },
    service: "laser-cutting",
    media: "machines/fiber-laser-combo-12kw",
    source: { basis: "profile", pages: [7] },
  },
  {
    slug: "fiber-laser-6kw",
    name: { en: "6000W Fiber Laser Machine", ar: "ماكينة ليزر فايبر 6000 واط" },
    shortName: { en: "Fiber Laser", ar: "ليزر فايبر" },
    category: { en: "Flatbed fibre-laser cutting", ar: "قص الصاج بالليزر على سرير مسطح" },
    powerWatts: 6000,
    capability: {
      en: "Flatbed fibre-laser cutting of sheet metal.",
      ar: "قص ألواح الصاج بالليزر على سرير مسطح.",
    },
    service: "laser-cutting",
    media: "machines/fiber-laser-6kw",
    source: { basis: "profile", pages: [7] },
  },
  {
    slug: "fiber-laser-3kw",
    name: { en: "3000W Fiber Laser Machine", ar: "ماكينة ليزر فايبر 3000 واط" },
    shortName: { en: "Fiber Laser", ar: "ليزر فايبر" },
    category: { en: "Flatbed fibre-laser cutting", ar: "قص الصاج بالليزر على سرير مسطح" },
    powerWatts: 3000,
    capability: {
      en: "Fibre-laser cutting of precise sheet-metal parts.",
      ar: "قص قطع الصاج الدقيقة بالليزر.",
    },
    service: "laser-cutting",
    media: "machines/fiber-laser-3kw",
    source: { basis: "profile", pages: [7] },
  },
  {
    slug: "cnc-press-brake",
    name: { en: "CNC Press Brake Machine", ar: "مكبس ثني CNC" },
    shortName: { en: "CNC Press Brake", ar: "مكبس ثني CNC" },
    category: { en: "CNC bending", ar: "الثني بتقنية CNC" },
    capability: {
      en: "CNC-controlled bending and forming of sheet metal and structural components.",
      ar: "ثني وتشكيل الصاج والمكوّنات الإنشائية بتحكم رقمي CNC.",
    },
    service: "cnc-bending",
    media: "machines/press-brake",
    source: { basis: "profile", pages: [7] },
  },
  {
    slug: "laser-welding",
    name: { en: "Laser Welding Machine", ar: "ماكينة لحام بالليزر" },
    shortName: { en: "Laser Welding", ar: "لحام بالليزر" },
    category: { en: "Laser welding", ar: "اللحام بالليزر" },
    capability: {
      en: "Handheld laser welding for clean, precise joints.",
      ar: "لحام يدوي بالليزر لوصلات نظيفة ودقيقة.",
    },
    service: "fabrication",
    media: "machines/laser-welding",
    source: { basis: "profile", pages: [7] },
  },
];
