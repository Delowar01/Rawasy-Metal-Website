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
      en: "RAWASY United International is a Riyadh-based metal and construction solutions company: laser cutting, CNC bending, steel structures, fabrication, laser engraving and scaffolding.",
      ar: "رواسي المتحدة العالمية شركة سعودية للحلول المعدنية والإنشائية في الرياض: قص بالليزر وثني CNC وهياكل حديدية وتصنيع معدني وحفر بالليزر وسقالات.",
    },
  },
  services: {
    title: { en: "Services — Laser Cutting, CNC Bending & Steel Structures", ar: "الخدمات — القص بالليزر والثني CNC والهياكل الحديدية" },
    description: {
      en: "Six service lines from RAWASY in Riyadh: laser cutting up to 12,000 W, CNC bending, steel structures, metal fabrication, laser engraving and scaffolding.",
      ar: "ستة خطوط خدمة من رواسي في الرياض: قص بالليزر حتى 12,000 واط، وثني CNC، وهياكل حديدية، وتصنيع معدني، وحفر بالليزر، وسقالات.",
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
      en: "Where RAWASY's metalwork applies: construction, infrastructure, industrial and commercial projects, plus architectural, public-realm, street-furniture and signage work.",
      ar: "مجالات تطبيق أعمال رواسي المعدنية: البناء والبنية التحتية والصناعة والمشاريع التجارية، إضافة إلى العمارة والأماكن العامة وأثاث الشوارع واللوحات.",
    },
  },
  clients: {
    title: { en: "Our Clients", ar: "عملاؤنا" },
    description: {
      en: "Manufacturers, contractors and specialist fabricators that have worked with RAWASY United International in Saudi Arabia.",
      ar: "مصانع ومقاولون وشركات تصنيع متخصصة تعاملت مع رواسي المتحدة العالمية في المملكة العربية السعودية.",
    },
  },
  certificates: {
    title: { en: "Certificates & Compliance", ar: "الشهادات والامتثال" },
    description: {
      en: "RAWASY's commercial registration, VAT registration and municipal commercial activity licence, shown as redacted previews.",
      ar: "السجل التجاري لرواسي، وشهادة التسجيل في ضريبة القيمة المضافة، ورخصة النشاط التجاري البلدية، كنسخ معاينة مع إخفاء البيانات الحساسة.",
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
    description: {
      en: "How RAWASY handles the information you share through this website: quote requests, files, preferences and contact.",
      ar: "كيف تتعامل رواسي مع المعلومات التي تشاركها عبر هذا الموقع: طلبات عروض الأسعار والملفات والتفضيلات والتواصل.",
    },
  },
  terms: {
    title: { en: "Website Terms", ar: "شروط استخدام الموقع" },
    description: {
      en: "Terms for using the RAWASY website: acceptable use, intellectual property, content accuracy and quotations.",
      ar: "شروط استخدام موقع رواسي: الاستخدام المقبول والملكية الفكرية ودقة المحتوى وعروض الأسعار.",
    },
  },
};
