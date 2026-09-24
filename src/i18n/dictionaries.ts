import type { Locale } from "./config";

/** Interface strings (chrome, controls, accessibility). Page copy lives in src/content. */
const en = {
  a11y: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainNav: "Main navigation",
    mobileNav: "Site menu",
    footerNav: "Footer navigation",
    breadcrumb: "Breadcrumb",
    homeLink: "RAWASY — home",
    switchToDark: "Switch to dark theme",
    switchToLight: "Switch to light theme",
    languageSwitch: "اقرأ هذه الصفحة بالعربية",
    whatsapp: "Chat with RAWASY on WhatsApp",
    previous: "Previous",
    next: "Next",
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
    menu: "Menu",
    close: "Close",
  },
  cursor: { view: "View", explore: "Explore", drag: "Drag" },
  loader: { words: ["Precision", "Steel", "Engineering"], skip: "Skip intro" },
  common: {
    home: "Home",
    backToTop: "Back to top",
    viewAll: "View all",
    call: "Call",
    email: "Email",
    whatsapp: "WhatsApp",
    address: "Address",
    phone: "Phone",
  },
  footer: {
    statement: "Shaping metal. Building possibilities.",
    services: "Services",
    contact: "Contact",
    legal: "Legal",
    preferences: "Preferences",
    rights: "All rights reserved.",
  },
  placeholder: {
    badge: "In development",
    title: "This page is being engineered.",
    body: "Its full design follows the homepage approval, as part of build stage",
    back: "Back to homepage",
    contact: "Talk to RAWASY",
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
    closeMenu: "إغلاق القائمة",
    mainNav: "القائمة الرئيسية",
    mobileNav: "قائمة الموقع",
    footerNav: "روابط التذييل",
    breadcrumb: "مسار التنقل",
    homeLink: "رواسي — الصفحة الرئيسية",
    switchToDark: "التبديل إلى الوضع الداكن",
    switchToLight: "التبديل إلى الوضع الفاتح",
    languageSwitch: "Read this page in English",
    whatsapp: "تواصل مع رواسي عبر واتساب",
    previous: "السابق",
    next: "التالي",
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
    menu: "القائمة",
    close: "إغلاق",
  },
  cursor: { view: "عرض", explore: "استكشف", drag: "اسحب" },
  loader: { words: ["دقّة", "حديد", "هندسة"], skip: "تخطي المقدمة" },
  common: {
    home: "الرئيسية",
    backToTop: "العودة للأعلى",
    viewAll: "عرض الكل",
    call: "اتصال",
    email: "البريد الإلكتروني",
    whatsapp: "واتساب",
    address: "العنوان",
    phone: "الهاتف",
  },
  footer: {
    statement: "نُشكّل المعدن… ونبني الممكن.",
    services: "الخدمات",
    contact: "تواصل معنا",
    legal: "قانوني",
    preferences: "التفضيلات",
    rights: "جميع الحقوق محفوظة.",
  },
  placeholder: {
    badge: "قيد التطوير",
    title: "نعمل على هندسة هذه الصفحة.",
    body: "يكتمل تصميمها بعد اعتماد الصفحة الرئيسية، ضمن مرحلة البناء",
    back: "العودة للرئيسية",
    contact: "تواصل مع رواسي",
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
