import type { Pillar } from "./types";

/** "Why RAWASY" — distilled from "Why Choose Us" and "What sets us apart" (profile p.16). */
export const pillars: Pillar[] = [
  {
    slug: "precision",
    icon: "precision",
    title: { en: "Precision", ar: "الدقة" },
    body: {
      en: "Accurate cuts, exact angles and consistent results — precision is built into every stage of our process.",
      ar: "قصّ دقيق وزوايا مضبوطة ونتائج ثابتة، فالدقة جزء أصيل من كل مرحلة في عملنا.",
    },
  },
  {
    slug: "technology",
    icon: "technology",
    title: { en: "Technology", ar: "التقنية" },
    body: {
      en: "High-power fibre lasers, 360° bevel cutting, CNC bending and laser welding in one integrated operation.",
      ar: "ليزر فايبر عالي القدرة، وقص مائل 360°، وثني CNC، ولحام بالليزر ضمن منظومة عمل واحدة.",
    },
  },
  {
    slug: "craftsmanship",
    icon: "craft",
    title: { en: "Craftsmanship", ar: "الحِرفية" },
    body: {
      en: "Advanced technology combined with skilled craftsmanship, for finishes that hold up to close inspection.",
      ar: "تقنية متقدمة مع حِرفية عالية، لتشطيب يصمد أمام أدق فحص.",
    },
  },
  {
    slug: "reliability",
    icon: "reliability",
    title: { en: "Reliability", ar: "الموثوقية" },
    body: {
      en: "Delivery on time, strict quality control and transparent communication from start to finish.",
      ar: "التزام بالمواعيد، ورقابة صارمة على الجودة، وتواصل واضح من البداية حتى التسليم.",
    },
  },
  {
    slug: "custom-solutions",
    icon: "custom",
    title: { en: "Custom Solutions", ar: "حلول حسب الطلب" },
    body: {
      en: "We anticipate challenges and tailor each solution to your drawings, requirements and budget.",
      ar: "نستبق التحديات ونفصّل الحل على مخططاتك ومتطلباتك وميزانيتك.",
    },
  },
  {
    slug: "project-execution",
    icon: "execution",
    title: { en: "Project Execution", ar: "تنفيذ متكامل" },
    body: {
      en: "One partner from consultation to completion — cutting, bending and fabrication, with logistics and transport support.",
      ar: "شريك واحد من الاستشارة حتى التسليم — قص وثني وتصنيع، مع دعم لوجستي ونقل.",
    },
  },
];
