import type { ProcessStep } from "./types";

/** "From flat sheet to finished structure" — built from the six service lines. */
export const processSteps: ProcessStep[] = [
  {
    slug: "cut",
    index: "01",
    verb: { en: "Cut", ar: "قص" },
    title: { en: "Laser cutting", ar: "القص بالليزر" },
    body: {
      en: "Sheet, tube, pipe and structural profiles — with 360° bevel capability.",
      ar: "صاج ومواسير وقطاعات حديدية، مع إمكانية القص المائل 360°.",
    },
    service: "laser-cutting",
  },
  {
    slug: "bend",
    index: "02",
    verb: { en: "Bend", ar: "ثني" },
    title: { en: "CNC bending", ar: "الثني بتقنية CNC" },
    body: {
      en: "Press-brake forming with accurate, repeatable angles.",
      ar: "تشكيل بمكابس الثني بزوايا دقيقة ومتكررة.",
    },
    service: "cnc-bending",
  },
  {
    slug: "weld",
    index: "03",
    verb: { en: "Weld", ar: "لحام" },
    title: { en: "Welding", ar: "اللحام" },
    body: {
      en: "Conventional and laser welding for strong, clean joints.",
      ar: "لحام تقليدي ولحام بالليزر لوصلات قوية ونظيفة.",
    },
    service: "fabrication",
  },
  {
    slug: "assemble",
    index: "04",
    verb: { en: "Assemble", ar: "تجميع" },
    title: { en: "Fabrication", ar: "التصنيع" },
    body: {
      en: "Components assembled into complete structures and custom pieces.",
      ar: "تجميع المكوّنات في منشآت متكاملة وقطع حسب الطلب.",
    },
    service: "fabrication",
  },
  {
    slug: "finish",
    index: "05",
    verb: { en: "Engrave", ar: "حفر" },
    title: { en: "Engraving & finishing", ar: "الحفر والتشطيب" },
    body: {
      en: "Laser engraving, identification plates and decorative detail.",
      ar: "حفر بالليزر ولوحات تعريفية وتفاصيل زخرفية.",
    },
    service: "laser-engraving",
  },
  {
    slug: "install",
    index: "06",
    verb: { en: "Erect", ar: "تركيب" },
    title: { en: "Structures & site support", ar: "الهياكل ودعم المواقع" },
    body: {
      en: "Steel structure assembly, scaffolding and formwork, transport and installation.",
      ar: "تركيب الهياكل الحديدية، والسقالات والشدّات، والنقل والتركيب.",
    },
    service: "steel-structures",
  },
];
