import type { RouteKey } from "@/i18n/routes";
import type { SeoEntry } from "./types";

export const siteName = { en: "RAWASY", ar: "رواسي" };

/** Localized titles/descriptions per route. Detail routes derive theirs from content. */
export const seo: Record<Exclude<RouteKey, "service" | "project">, SeoEntry> = {
  home: {
    title: {
      en: "RAWASY — Laser Cutting, CNC Bending & Steel Structures in Saudi Arabia",
      ar: "رواسي — قص بالليزر وثني CNC وهياكل حديدية في المملكة العربية السعودية",
    },
    description: {
      en: "RAWASY United International is a Riyadh-based metal fabrication company: fibre-laser cutting up to 12,000 W, CNC bending, steel structures, custom fabrication, laser engraving and scaffolding.",
      ar: "رواسي المتحدة العالمية شركة تصنيع معدني في الرياض: قص بالليزر حتى 12,000 واط، وثني CNC، وهياكل حديدية، وتصنيع حسب الطلب، وحفر بالليزر، وسقالات.",
    },
  },
  about: {
    title: { en: "About RAWASY", ar: "عن رواسي" },
    description: {
      en: "Who we are: a Saudi metal and construction solutions company combining advanced technology with skilled craftsmanship.",
      ar: "تعرّف على رواسي: شركة سعودية للحلول المعدنية والإنشائية تجمع بين التقنية المتقدمة والحِرفية العالية.",
    },
  },
  services: {
    title: { en: "Services", ar: "خدماتنا" },
    description: {
      en: "Laser cutting, CNC bending, steel structures, metal fabrication, laser engraving and scaffolding from RAWASY in Riyadh.",
      ar: "القص بالليزر، والثني بتقنية CNC، والهياكل الحديدية، والتصنيع المعدني، والحفر بالليزر، والسقالات من رواسي في الرياض.",
    },
  },
  capabilities: {
    title: { en: "Capabilities & Machinery", ar: "القدرات والمعدات" },
    description: {
      en: "RAWASY's machinery: 12,000 W tube and combo fibre lasers, 6,000 W and 3,000 W fibre lasers, a CNC press brake and laser welding.",
      ar: "معدات رواسي: ليزر فايبر للمواسير وكومبو بقدرة 12,000 واط، وليزر فايبر 6,000 و3,000 واط، ومكبس ثني CNC، ولحام بالليزر.",
    },
  },
  projects: {
    title: { en: "Projects", ar: "المشاريع" },
    description: {
      en: "Selected RAWASY work: architectural metal, landmark sculptures, shade structures, laser-cut screens and custom fabrication.",
      ar: "مختارات من أعمال رواسي: أعمال معدنية معمارية، ومجسمات ومعالم، ومظلات، وسواتر مقصوصة بالليزر، وتصنيع حسب الطلب.",
    },
  },
  industries: {
    title: { en: "Industries We Serve", ar: "القطاعات التي نخدمها" },
    description: {
      en: "Construction, infrastructure, industrial, commercial, architecture and public-realm projects across Saudi Arabia.",
      ar: "مشاريع المقاولات والبنية التحتية والصناعة والقطاع التجاري والعمارة والأماكن العامة في المملكة.",
    },
  },
  clients: {
    title: { en: "Clients", ar: "عملاؤنا" },
    description: {
      en: "Organisations that have worked with RAWASY.",
      ar: "جهات وشركات تعاملت مع رواسي.",
    },
  },
  certificates: {
    title: { en: "Certificates & Compliance", ar: "الشهادات والامتثال" },
    description: {
      en: "RAWASY's commercial registration, VAT registration and commercial activity licence.",
      ar: "السجل التجاري لرواسي، وشهادة التسجيل في ضريبة القيمة المضافة، ورخصة النشاط التجاري.",
    },
  },
  contact: {
    title: { en: "Contact & Request a Quote", ar: "تواصل معنا واطلب عرض سعر" },
    description: {
      en: "Start a project with RAWASY: send your drawings and requirements for laser cutting, bending, steel structures or fabrication.",
      ar: "ابدأ مشروعك مع رواسي: أرسل مخططاتك ومتطلباتك للقص بالليزر أو الثني أو الهياكل الحديدية أو التصنيع.",
    },
  },
  privacy: {
    title: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
    description: { en: "How RAWASY handles information you share with us.", ar: "كيف تتعامل رواسي مع المعلومات التي تشاركها معنا." },
  },
  terms: {
    title: { en: "Website Terms", ar: "شروط استخدام الموقع" },
    description: { en: "Terms of use for the RAWASY website.", ar: "شروط استخدام موقع رواسي الإلكتروني." },
  },
};
