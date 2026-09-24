import type { RouteKey } from "@/i18n/routes";
import type { Localized, ServiceSlug } from "./types";

export interface NavItem {
  route: RouteKey;
  label: Localized;
  slug?: string;
}

export const headerNav: NavItem[] = [
  { route: "home", label: { en: "Home", ar: "الرئيسية" } },
  { route: "about", label: { en: "About", ar: "من نحن" } },
  { route: "services", label: { en: "Services", ar: "خدماتنا" } },
  { route: "capabilities", label: { en: "Capabilities", ar: "القدرات" } },
  { route: "projects", label: { en: "Projects", ar: "المشاريع" } },
  { route: "industries", label: { en: "Industries", ar: "القطاعات" } },
  { route: "clients", label: { en: "Clients", ar: "عملاؤنا" } },
  { route: "contact", label: { en: "Contact", ar: "تواصل معنا" } },
];

export const footerNav: { title: Localized; items: NavItem[] }[] = [
  {
    title: { en: "Company", ar: "الشركة" },
    items: [
      { route: "about", label: { en: "About RAWASY", ar: "عن رواسي" } },
      { route: "projects", label: { en: "Projects", ar: "المشاريع" } },
      { route: "clients", label: { en: "Clients", ar: "عملاؤنا" } },
      { route: "industries", label: { en: "Industries", ar: "القطاعات" } },
      { route: "capabilities", label: { en: "Machinery", ar: "المعدات" } },
      { route: "certificates", label: { en: "Certificates", ar: "الشهادات" } },
    ],
  },
];

export const footerServices: ServiceSlug[] = [
  "laser-cutting",
  "cnc-bending",
  "steel-structures",
  "fabrication",
  "laser-engraving",
  "scaffolding",
];

export const legalNav: NavItem[] = [
  { route: "privacy", label: { en: "Privacy Policy", ar: "سياسة الخصوصية" } },
  { route: "terms", label: { en: "Website Terms", ar: "شروط الاستخدام" } },
];
