import type { LabData } from "../data";
import { Icon } from "../Icon";
import { SystemSheet, type SystemSpec } from "../SystemSheet";
import { cFontClasses } from "./fonts";
import { FooterC, HeaderC, MachineCardC, ProjectTileC, ServiceTileC } from "./HomeC";
import "./c.css";

/** Option C — Minimal Luxury Commerce: design-system sheet. */
export function SystemC({ data }: { data: LabData }) {
  const ar = data.locale === "ar";
  const spec: SystemSpec = {
    root: `lab-c ${cFontClasses}`,
    summary: {
      en: "Premium and restrained: near-white and stone surfaces, generous whitespace, large refined Urbanist headlines, borderless product tiles with framed photography, hairline borders and soft diffuse shadows. Orange appears only where a decision is made; motion is slow and minimal.",
      ar: "طابع فاخر ومتزن: أسطح بيضاء وحجرية فاتحة، ومساحات واسعة، وعناوين كبيرة راقية، وبطاقات منتجات بلا حدود مع صور مؤطرة، وخطوط حدود رفيعة وظلال ناعمة منتشرة. يظهر البرتقالي عند اتخاذ القرار فقط، والحركة هادئة ومحدودة.",
    },
    palette: [
      {
        group: ar ? "الأساسي والمحايد" : "Brand and neutrals",
        swatches: [
          { name: "RAWASY Orange", value: "#F15F22", role: ar ? "زر الإجراء فقط" : "Primary action only" },
          { name: "Charcoal", value: "#1A1B1D", role: ar ? "العناوين والزر الداكن" : "Headings, dark button" },
          { name: "Graphite text", value: "#4F5358", role: ar ? "نص الفقرات" : "Body text" },
          { name: "Porcelain", value: "#FAFAF8", role: ar ? "خلفية الصفحة" : "Page background" },
          { name: "Stone", value: "#F2F1ED", role: ar ? "أقسام متبادلة والتذييل" : "Alternate sections, footer" },
          { name: "White", value: "#FFFFFF", role: ar ? "الأقسام البيضاء والبطاقات" : "White sections, cards" },
        ],
      },
      {
        group: ar ? "الألوان المساندة" : "Supporting colours",
        swatches: [
          { name: "Muted steel", value: "#4A6275", role: ar ? "المعدات والمعلومات" : "Machinery, information" },
          { name: "Sand", value: "#B59A6C", role: ar ? "خطوط ولمسات دقيقة" : "Hairlines, fine accents" },
          { name: "Deep teal", value: "#3B6B64", role: ar ? "الدعم الميداني" : "Site support" },
          { name: "Hairline", value: "#DFDDD8", role: ar ? "الحدود الافتراضية" : "Default borders" },
          { name: "Sand tint", value: "#F4EEE4", role: ar ? "لوحة الحفر" : "Engraving panel" },
          { name: "Steel tint", value: "#EDF1F4", role: ar ? "حالات هادئة" : "Quiet states" },
        ],
      },
    ],
    fonts: [
      { role: data.lab.sheet.display, family: "Urbanist", detail: "500 · 45–90px · −4%", lang: "en", className: "t-display text-[3.2rem]", sample: "Engineering metal into possibility." },
      { role: data.lab.sheet.display, family: "Readex Pro", detail: "500 · 38–69px · lh 1.32", lang: "ar", className: "t-display text-[2.6rem]", sample: "نُشكّل المعدن بدقّة هندسية ونصنع الممكن." },
      { role: data.lab.sheet.heading, family: "Urbanist", detail: "500 · 32–50px / 600 · 23px", lang: "en", className: "t-h2", sample: "Six service lines. One accountable partner." },
      { role: data.lab.sheet.heading, family: "Readex Pro", detail: "500 · 29–42px · lh 1.45", lang: "ar", className: "t-h2", sample: "ست خدمات متكاملة… وشريك واحد مسؤول." },
      {
        role: data.lab.sheet.body,
        family: "DM Sans",
        detail: "400/500 · 17–20px · lh 1.7",
        lang: "en",
        className: "t-lead",
        sample: "Advanced metal fabrication, laser cutting, CNC bending, steel structures and custom industrial solutions in Saudi Arabia.",
      },
      {
        role: data.lab.sheet.body,
        family: "Readex Pro",
        detail: "400 · 17–20px · lh 1.9",
        lang: "ar",
        className: "t-lead",
        sample: "حلول متقدمة في التصنيع المعدني والقص بالليزر والثني بتقنية CNC والهياكل الحديدية، وحلول صناعية حسب الطلب في المملكة العربية السعودية.",
      },
    ],
    radius: [
      { label: ar ? "الحقول" : "Fields", value: "10px", token: "--r-sm" },
      { label: ar ? "الأزرار" : "Buttons", value: "12px", token: "--r-btn" },
      { label: ar ? "البطاقات" : "Cards", value: "16px", token: "--r-card" },
      { label: ar ? "الصور" : "Images", value: "20px", token: "--r-img" },
      { label: ar ? "اللوحات" : "Panels", value: "24px", token: "--r-panel" },
      { label: ar ? "الوسوم" : "Tags", value: "999px", token: "--r-pill" },
    ],
    borders: [
      { label: ar ? "خفيف" : "Subtle", value: "1px #EBEAE6", style: "1px solid #EBEAE6" },
      { label: ar ? "افتراضي" : "Default", value: "1px #DFDDD8", style: "1px solid #DFDDD8" },
      { label: ar ? "قوي" : "Strong", value: "1px #C7C4BD", style: "1px solid #C7C4BD" },
      { label: ar ? "نشط" : "Active", value: "1px #1A1B1D", style: "1px solid #1A1B1D" },
    ],
    shadows: [
      { label: ar ? "بطاقة" : "Card", token: "--sh-card", use: ar ? "البطاقات في وضعها العادي" : "Cards at rest" },
      { label: ar ? "بارز" : "Raised", token: "--sh-raised", use: ar ? "لوحة المعدات" : "Machine spotlight" },
      { label: ar ? "تمرير" : "Hover", token: "--sh-hover", use: ar ? "رفع 3px هادئ" : "Quiet 3px lift" },
      { label: ar ? "عائم" : "Floating", token: "--sh-float", use: ar ? "القوائم" : "Menus" },
      { label: ar ? "صورة" : "Image", token: "--sh-image", use: ar ? "الصور المؤطرة" : "Framed photos" },
      { label: ar ? "داخلي" : "Inset", token: "--sh-inset", use: ar ? "حقول الإدخال" : "Form fields" },
    ],
    buttons: [
      { label: ar ? "أساسي" : "Primary", className: "btn btn-primary", icon: true },
      { label: ar ? "ثانوي" : "Secondary", className: "btn btn-secondary" },
      { label: ar ? "داكن" : "Dark", className: "btn btn-dark", icon: true },
      { label: ar ? "فولاذي" : "Steel", className: "btn btn-steel" },
    ],
    tones: ["brand", "steel", "steel", "brass", "brass", "teal"],
  };

  const by = (slug: string) => data.services.items.find((s) => s.slug === slug)!;
  const project = data.projects.items.find((p) => p.slug === "palm-leaf-shade-canopies")!;

  const cards = (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
      <ServiceTileC service={by("fabrication")} open={data.services.open} />
      <ServiceTileC service={by("laser-engraving")} open={data.services.open} />
      <ProjectTileC project={project} />
      <div className="grid grid-cols-1 content-start gap-4">
        <MachineCardC machine={data.machinery.items.find((m) => m.slug === "cnc-press-brake")!} />
        <div className="card p-6">
          <p className="t-stat text-[3rem] leading-none" dir="ltr">
            {data.metrics[1].value}
            <span className="text-[0.5em] text-ink-2">{data.metrics[1].unit}</span>
          </p>
          <p className="mt-3 text-[0.92rem] text-ink-2">{data.metrics[1].label}</p>
        </div>
        <a href={data.links.quote} className="card card-link flex items-center justify-between gap-4 p-6">
          <span className="t-h4">{data.cta.primary}</span>
          <Icon name="arrow" size={18} />
        </a>
      </div>
    </div>
  );

  return <SystemSheet data={data} spec={spec} header={<HeaderC data={data} />} footer={<FooterC data={data} />} cards={cards} />;
}
