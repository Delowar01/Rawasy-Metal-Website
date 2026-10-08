import type { Locale } from "./config";

/** Interface strings (chrome, controls, accessibility). Page copy lives in src/content. */
const en = {
  a11y: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    mainNav: "Main navigation",
    mobileNav: "Site menu",
    footerNav: "Footer navigation",
    breadcrumb: "Breadcrumb",
    homeLink: "RAWASY — home",
    languageSwitch: "اقرأ هذه الصفحة بالعربية",
    close: "Close",
    externalLink: "opens in a new tab",
  },
  controls: {
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    language: "Language",
    getQuote: "Get a Quote",
    requestQuote: "Request a Quote",
  },
  common: {
    home: "Home",
    backToTop: "Back to top",
    call: "Call",
    email: "Email",
    whatsapp: "WhatsApp",
    address: "Address",
    phone: "Phone",
  },
  footer: {
    services: "Services",
    contact: "Contact",
    legal: "Legal",
    rights: "All rights reserved.",
  },
  notFound: {
    code: "404",
    title: "Outside the blueprint",
    body: "The page you're looking for isn't part of this structure.",
    home: "Back to homepage",
    contact: "Contact RAWASY",
    note: "Ref. — not found in drawing set",
    metaTitle: "Page not found",
  },
};

export type Dictionary = typeof en;

const ar: Dictionary = {
  a11y: {
    skipToContent: "انتقل إلى المحتوى",
    openMenu: "فتح القائمة",
    mainNav: "القائمة الرئيسية",
    mobileNav: "قائمة الموقع",
    footerNav: "روابط التذييل",
    breadcrumb: "مسار التنقل",
    homeLink: "رواسي — الصفحة الرئيسية",
    languageSwitch: "Read this page in English",
    close: "إغلاق",
    externalLink: "يفتح في نافذة جديدة",
  },
  controls: {
    theme: "المظهر",
    light: "فاتح",
    dark: "داكن",
    language: "اللغة",
    getQuote: "اطلب عرض سعر",
    requestQuote: "اطلب عرض سعر",
  },
  common: {
    home: "الرئيسية",
    backToTop: "العودة للأعلى",
    call: "اتصال",
    email: "البريد الإلكتروني",
    whatsapp: "واتساب",
    address: "العنوان",
    phone: "الهاتف",
  },
  footer: {
    services: "الخدمات",
    contact: "تواصل معنا",
    legal: "قانوني",
    rights: "جميع الحقوق محفوظة.",
  },
  notFound: {
    code: "404",
    title: "خارج المخطط",
    body: "يبدو أن الصفحة التي تبحث عنها ليست ضمن هذا المخطط.",
    home: "العودة للرئيسية",
    contact: "تواصل مع رواسي",
    note: "مرجع — غير موجودة في مجموعة المخططات",
    metaTitle: "الصفحة غير موجودة",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
