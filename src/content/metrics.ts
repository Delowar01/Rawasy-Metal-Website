import type { Localized, Metric } from "./types";

/**
 * Only figures printed in the company profile. No project counts, years,
 * staff numbers or capacities — those need RAWASY's confirmation first.
 */
export const metrics: Metric[] = [
  {
    slug: "peak-laser-power",
    value: 12000,
    display: { en: "12,000", ar: "12,000" },
    unit: { en: "W", ar: "واط" },
    label: { en: "Peak fibre-laser power", ar: "أعلى قدرة لليزر الفايبر" },
    source: { basis: "profile", pages: [7] },
  },
  {
    slug: "bevel-cutting",
    value: 360,
    display: { en: "360", ar: "360" },
    unit: { en: "°", ar: "°" },
    label: { en: "Bevel laser cutting", ar: "قص مائل بالليزر" },
    source: { basis: "profile", pages: [3] },
  },
  {
    slug: "laser-systems",
    value: 4,
    display: { en: "04", ar: "04" },
    label: { en: "Laser cutting systems", ar: "أنظمة قص بالليزر" },
    source: { basis: "profile", pages: [7], note: "12 kW tube, 12 kW combo, 6 kW and 3 kW." },
  },
  {
    slug: "service-lines",
    value: 6,
    display: { en: "06", ar: "06" },
    label: { en: "Integrated service lines", ar: "خطوط خدمة متكاملة" },
    source: { basis: "profile", pages: [3, 6] },
  },
];

/** Semantic capability statements — used instead of unverified statistics. */
export const capabilityStatements: { title: Localized; body: Localized }[] = [
  {
    title: { en: "Advanced laser technology", ar: "تقنية ليزر متقدمة" },
    body: { en: "Fibre-laser sheet, tube and profile cutting.", ar: "قص الصاج والمواسير والقطاعات بليزر الفايبر." },
  },
  {
    title: { en: "Custom fabrication", ar: "تصنيع حسب الطلب" },
    body: { en: "From single pieces to structural packages.", ar: "من القطعة الواحدة إلى الحزم الإنشائية." },
  },
  {
    title: { en: "Multi-service capability", ar: "خدمات متعددة" },
    body: { en: "Cut, bend, weld, engrave, assemble, support.", ar: "قص، ثني، لحام، حفر، تجميع، ودعم ميداني." },
  },
  {
    title: { en: "Saudi-based operations", ar: "عمليات من داخل المملكة" },
    body: { en: "Workshop and team in Riyadh.", ar: "ورشتنا وفريقنا في الرياض." },
  },
];
