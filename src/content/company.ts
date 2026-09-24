import type { CompanyInfo } from "./types";

/** Company facts — source: company profile p.1, p.2 and p.16. */
export const company: CompanyInfo = {
  legalName: {
    en: "RAWASY UNITED INTERNATIONAL CO. LTD.",
    ar: "شركة رواسي المتحدة العالمية المحدودة",
  },
  brandName: { en: "RAWASY", ar: "رواسي" },
  statement: {
    en: "Laser cutting, CNC bending, steel structures, fabrication, laser engraving and scaffolding — engineered in Riyadh for projects across Saudi Arabia.",
    ar: "قص بالليزر، ثني CNC، هياكل حديدية، تصنيع معدني، حفر بالليزر وسقالات — بخبرة هندسية من الرياض لمشاريع المملكة.",
  },
  address: {
    en: { lines: ["Al Mashael, Sulay", "Riyadh 14325", "Saudi Arabia"], full: "Al Mashael, Sulay, Riyadh 14325, Saudi Arabia" },
    ar: { lines: ["حي المشاعل، السلي", "الرياض 14325", "المملكة العربية السعودية"], full: "حي المشاعل، السلي، الرياض 14325، المملكة العربية السعودية" },
  },
  city: { en: "Riyadh", ar: "الرياض" },
  country: { en: "Saudi Arabia", ar: "المملكة العربية السعودية" },
  postalCode: "14325",
  // Approximate (district level) — used only for decorative coordinates.
  geo: { lat: 24.6, lng: 46.8, approximate: true },
  phones: [
    { display: "+966 53 736 8310", e164: "+966537368310", whatsapp: true },
    { display: "+966 55 261 6189", e164: "+966552616189", whatsapp: true },
  ],
  email: "rawasymetal@gmail.com",
  website: "https://www.rawasymetal.com",
  social: { facebook: "https://www.facebook.com/Lasercuttinganddesign" },
  vision: {
    statement: {
      en: "To be a leading force in the metal and construction solutions industry — recognised for innovation, trust and sustainable growth.",
      ar: "أن نكون قوة رائدة في قطاع الحلول المعدنية والإنشائية، معروفين بالابتكار والثقة والنمو المستدام.",
    },
    aims: {
      en: [
        "Deliver cutting-edge metal solutions that empower industries and infrastructure.",
        "Provide safe, reliable and cost-effective scaffolding and formwork systems.",
        "Build lasting partnerships based on integrity, excellence and customer satisfaction.",
        "Continuously invest in technology and talent to shape a stronger, smarter future.",
      ],
      ar: [
        "تقديم حلول معدنية متقدمة تدعم الصناعة ومشاريع البنية التحتية.",
        "توفير أنظمة سقالات وشدّات آمنة وموثوقة وبتكلفة مناسبة.",
        "بناء شراكات طويلة المدى قائمة على النزاهة والتميّز ورضا العملاء.",
        "الاستثمار المستمر في التقنية والكفاءات لبناء مستقبل أقوى وأذكى.",
      ],
    },
    closing: {
      en: "We are not just building structures — we are building foundations for progress.",
      ar: "لا نبني هياكل فقط… بل نبني أساسًا للتقدّم.",
    },
  },
};

export const primaryWhatsApp = company.phones.find((p) => p.whatsapp) ?? company.phones[0];

export function whatsappUrl(message?: string) {
  const number = primaryWhatsApp.e164.replace("+", "");
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
