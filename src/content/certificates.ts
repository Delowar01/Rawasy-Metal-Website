import type { Certificate } from "./types";

/**
 * Source: company profile p.13–15. Registration numbers, QR codes and personal
 * names are redacted in every preview and deliberately absent from this data
 * until RAWASY approves them for public display.
 */
export const certificates: Certificate[] = [
  {
    slug: "commercial-registration",
    title: { en: "Commercial Registration", ar: "السجل التجاري" },
    issuer: { en: "Ministry of Commerce", ar: "وزارة التجارة" },
    facts: [
      {
        label: { en: "Entity type", ar: "نوع الكيان" },
        value: { en: "Limited liability company", ar: "شركة ذات مسؤولية محدودة" },
      },
      { label: { en: "Issued", ar: "تاريخ الإصدار" }, value: { en: "28 Oct 2024", ar: "28/10/2024" } },
      { label: { en: "Status", ar: "حالة السجل" }, value: { en: "Active", ar: "نشط" } },
    ],
    previews: ["certificates/commercial-registration-en", "certificates/commercial-registration-ar"],
    thumb: "certificates/commercial-registration-ar-thumb",
    source: { basis: "profile", pages: [13] },
  },
  {
    slug: "vat-registration",
    title: { en: "VAT Registration", ar: "شهادة التسجيل في ضريبة القيمة المضافة" },
    issuer: { en: "Zakat, Tax and Customs Authority", ar: "هيئة الزكاة والضريبة والجمارك" },
    facts: [
      { label: { en: "Registered from", ar: "تاريخ نفاذ التسجيل" }, value: { en: "1 Nov 2024", ar: "01/11/2024" } },
      { label: { en: "Tax period", ar: "الفترة الضريبية" }, value: { en: "Quarterly", ar: "ربع سنوية" } },
    ],
    previews: ["certificates/vat-registration"],
    thumb: "certificates/vat-registration-thumb",
    source: { basis: "profile", pages: [14] },
  },
  {
    slug: "commercial-activity-licence",
    title: { en: "Commercial Activity Licence", ar: "رخصة نشاط تجاري" },
    issuer: { en: "Balady · Riyadh Region Municipality", ar: "بلدي · أمانة منطقة الرياض" },
    facts: [
      { label: { en: "Activity", ar: "النشاط" }, value: { en: "Metalworking workshop", ar: "ورش الحدادة" } },
      { label: { en: "Sub-municipality", ar: "البلدية" }, value: { en: "Al Sulay", ar: "بلدية السلي" } },
    ],
    previews: ["certificates/commercial-activity-licence"],
    thumb: "certificates/commercial-activity-licence-thumb",
    source: {
      basis: "profile",
      pages: [15],
      note: "Licence in the profile shows expiry 1447/04/04 AH — renewed copy requested.",
    },
  },
];
