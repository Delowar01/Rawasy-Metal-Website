import type { LabData } from "../data";
import { Icon } from "../Icon";
import { SystemSheet, type SystemSpec } from "../SystemSheet";
import { metricIcon, statementIcon } from "../ui";
import { aFontClasses } from "./fonts";
import { FooterA, HeaderA, MachineRowA, ProjectCardA, ServiceCardA } from "./HomeA";
import "./a.css";

/** Option A — Clean Premium Commerce: design-system sheet. */
export function SystemA({ data }: { data: LabData }) {
  const ar = data.locale === "ar";
  const spec: SystemSpec = {
    root: `lab-a ${aFontClasses}`,
    summary: {
      en: "Bright, crisp and commercial: white raised cards on a cool light grey, visible borders, soft layered shadows, moderate radius and clear orange calls to action. Steel blue, teal and brass colour the icons, tags and panels.",
      ar: "طابع مشرق وواضح وتجاري: بطاقات بيضاء بارزة على رمادي فاتح بارد، وحدود ظاهرة، وظلال ناعمة متدرجة، وزوايا معتدلة الاستدارة، وأزرار إجراء برتقالية واضحة. الأزرق الفولاذي والأخضر المزرق والنحاسي للأيقونات والوسوم واللوحات.",
    },
    palette: [
      {
        group: ar ? "الأساسي والمحايد" : "Brand and neutrals",
        swatches: [
          { name: "RAWASY Orange", value: "#F15F22", role: ar ? "الإجراء الرئيسي والحالة النشطة" : "Primary action, active state" },
          { name: "Charcoal", value: "#111827", role: ar ? "العناوين والنص على البرتقالي" : "Headings, text on orange" },
          { name: "Slate text", value: "#454E5C", role: ar ? "نص الفقرات" : "Body text" },
          { name: "Page grey", value: "#F4F6F9", role: ar ? "خلفية الصفحة" : "Page background" },
          { name: "Blue-grey", value: "#EBEFF4", role: ar ? "أقسام متبادلة" : "Alternate sections" },
          { name: "White", value: "#FFFFFF", role: ar ? "البطاقات واللوحات" : "Cards and panels" },
        ],
      },
      {
        group: ar ? "الألوان المساندة" : "Supporting colours",
        swatches: [
          { name: "Commercial navy", value: "#132039", role: ar ? "لوحات داكنة وتذييل" : "Dark panels, footer" },
          { name: "Steel blue", value: "#2C5E86", role: ar ? "المعدات والمعلومات" : "Machinery, information" },
          { name: "Teal", value: "#1B6F65", role: ar ? "العمليات والدعم الميداني" : "Process, site support" },
          { name: "Brass", value: "#83642B", role: ar ? "الحِرفية والامتثال" : "Craft, compliance" },
          { name: "Orange tint", value: "#FFF1E9", role: ar ? "خلفية نشطة" : "Active background" },
          { name: "Steel tint", value: "#EAF1F7", role: ar ? "مسرح عرض المعدات" : "Machine stage" },
        ],
      },
    ],
    fonts: [
      {
        role: data.lab.sheet.display,
        family: "Plus Jakarta Sans",
        detail: "800 · 40–66px · −3.5%",
        lang: "en",
        className: "t-display text-[2.6rem]",
        sample: "Engineering metal into possibility.",
      },
      {
        role: data.lab.sheet.display,
        family: "Tajawal",
        detail: "800 · 37–60px · lh 1.32",
        lang: "ar",
        className: "t-display text-[2.4rem]",
        sample: "نُشكّل المعدن بدقّة هندسية ونصنع الممكن.",
      },
      {
        role: data.lab.sheet.heading,
        family: "Plus Jakarta Sans",
        detail: "760 · 29–41px / 700 · 19px",
        lang: "en",
        className: "t-h2",
        sample: "Six service lines. One accountable partner.",
      },
      {
        role: data.lab.sheet.heading,
        family: "Tajawal",
        detail: "800 · 27–38px · lh 1.45",
        lang: "ar",
        className: "t-h2",
        sample: "ست خدمات متكاملة… وشريك واحد مسؤول.",
      },
      {
        role: data.lab.sheet.body,
        family: "Inter",
        detail: "400/500/600 · 16–19px · lh 1.6",
        lang: "en",
        className: "t-lead",
        sample: "Advanced metal fabrication, laser cutting, CNC bending, steel structures and custom industrial solutions in Saudi Arabia.",
      },
      {
        role: data.lab.sheet.body,
        family: "IBM Plex Sans Arabic",
        detail: "400/500 · 16–19px · lh 1.85 · semibold UI in Tajawal",
        lang: "ar",
        className: "t-lead",
        sample: "حلول متقدمة في التصنيع المعدني والقص بالليزر والثني بتقنية CNC والهياكل الحديدية، وحلول صناعية حسب الطلب في المملكة العربية السعودية.",
      },
    ],
    radius: [
      { label: ar ? "الوسوم" : "Tags", value: "6px", token: "--r-xs" },
      { label: ar ? "الحقول" : "Fields", value: "8px", token: "--r-sm" },
      { label: ar ? "الأزرار" : "Buttons", value: "10px", token: "--r-btn" },
      { label: ar ? "البطاقات" : "Cards", value: "16px", token: "--r-card" },
      { label: ar ? "اللوحات" : "Panels", value: "24px", token: "--r-panel" },
      { label: ar ? "الشارات" : "Badges", value: "999px", token: "--r-pill" },
    ],
    borders: [
      { label: ar ? "خفيف" : "Subtle", value: "1px #E5E9EF", style: "1px solid #E5E9EF" },
      { label: ar ? "افتراضي" : "Default", value: "1px #D5DBE3", style: "1px solid #D5DBE3" },
      { label: ar ? "قوي" : "Strong", value: "1px #B9C3CF", style: "1px solid #B9C3CF" },
      { label: ar ? "نشط" : "Active", value: "2px #F15F22", style: "2px solid #F15F22" },
    ],
    shadows: [
      { label: ar ? "بطاقة" : "Card", token: "--sh-card", use: ar ? "البطاقات في وضعها العادي" : "Cards at rest" },
      { label: ar ? "بارز" : "Raised", token: "--sh-raised", use: ar ? "اللوحات وشريط الخدمات" : "Panels, service bar" },
      { label: ar ? "تمرير" : "Hover", token: "--sh-hover", use: ar ? "رفع البطاقة عند التمرير" : "Card lift on hover" },
      { label: ar ? "عائم" : "Floating", token: "--sh-float", use: ar ? "البطاقات العائمة والقوائم" : "Floating cards, menus" },
      { label: ar ? "صورة" : "Image", token: "--sh-image", use: ar ? "الصور الكبيرة" : "Large photos" },
      { label: ar ? "داخلي" : "Inset", token: "--sh-inset", use: ar ? "حقول الإدخال" : "Form fields" },
    ],
    buttons: [
      { label: ar ? "أساسي" : "Primary", className: "btn btn-primary", icon: true },
      { label: ar ? "ثانوي" : "Secondary", className: "btn btn-secondary" },
      { label: ar ? "داكن" : "Dark", className: "btn btn-dark", icon: true },
      { label: ar ? "فولاذي" : "Steel", className: "btn btn-steel" },
      { label: ar ? "أخضر مزرق" : "Teal", className: "btn btn-teal" },
    ],
    tones: ["brand", "steel", "steel", "brass", "brass", "teal"],
  };

  const service = data.services.items[0];
  const project = data.projects.items.find((p) => p.slug === "clock-tower-landmark")!;
  const machine = data.machinery.items.find((m) => m.slug === "tube-cutting-12kw")!;
  const metric = data.metrics[0];

  const cards = (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div>
        <ServiceCardA service={service} open={data.services.open} />
      </div>
      <div className="h-[26rem]">
        <ProjectCardA project={project} />
      </div>
      <div className="grid grid-cols-1 content-start gap-4">
        <MachineRowA machine={machine} />
        <div className="card flex items-start gap-3.5 p-4" data-tone="teal">
          <span className="icon-chip shrink-0">
            <Icon name={statementIcon[2]} size={20} />
          </span>
          <span>
            <span className="t-h4 block">{data.statements[2].title}</span>
            <span className="t-small mt-0.5 block">{data.statements[2].body}</span>
          </span>
        </div>
        <div className="card p-4" data-tone="steel">
          <span className="text-[var(--tone)]">
            <Icon name={metricIcon[metric.slug]} size={20} />
          </span>
          <p className="t-stat mt-2 text-[1.6rem] leading-none">
            {metric.value}
            <span className="ms-0.5 text-[1rem] text-ink-2">{metric.unit}</span>
          </p>
          <p className="mt-1.5 text-[0.82rem] text-ink-2">{metric.label}</p>
        </div>
        <div className="a-cta-dark overflow-hidden rounded-[var(--r-card)] p-5">
          <p className="t-h4 text-white">{data.cta.title}</p>
          <a href={data.links.quote} className="btn btn-primary btn-sm mt-4">
            {data.cta.primary}
            <Icon name="arrow" size={15} />
          </a>
        </div>
      </div>
    </div>
  );

  return <SystemSheet data={data} spec={spec} header={<HeaderA data={data} />} footer={<FooterA data={data} />} cards={cards} />;
}
