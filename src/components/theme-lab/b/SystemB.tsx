import type { LabData } from "../data";
import { Icon } from "../Icon";
import { SystemSheet, type SystemSpec } from "../SystemSheet";
import { statementIcon } from "../ui";
import { bFontClasses } from "./fonts";
import { FeatureServiceB, FooterB, HeaderB, MachineCardB, OverlayServiceB, ProjectTileB } from "./HomeB";
import "./b.css";

/** Option B — Bold Industrial Commerce: design-system sheet. */
export function SystemB({ data }: { data: LabData }) {
  const ar = data.locale === "ar";
  const spec: SystemSpec = {
    root: `lab-b ${bFontClasses}`,
    summary: {
      en: "High contrast and confident: graphite hero and bands, bright white product cards, bold Outfit headlines, orange and steel-blue accents, firmer radius and deeper shadows. Machine figures set in Geist Mono. A serious manufacturing supplier — never neon or gaming.",
      ar: "طابع قوي وعالي التباين: واجهة وأشرطة بلون الجرافيت، وبطاقات منتجات بيضاء مشرقة، وعناوين عريضة، ولمسات برتقالية وزرقاء فولاذية، وزوايا أكثر حدّة وظلال أعمق. أرقام المعدات بخط Geist Mono. مورّد صناعي جاد — بلا ألوان نيون أو طابع ألعاب.",
    },
    palette: [
      {
        group: ar ? "الأساسي والجرافيت" : "Brand and graphite",
        swatches: [
          { name: "RAWASY Orange", value: "#F15F22", role: ar ? "الإجراء الرئيسي وشريط الدعوة" : "Primary action, CTA band" },
          { name: "Graphite", value: "#14171B", role: ar ? "الواجهة والأشرطة الداكنة" : "Hero and dark bands" },
          { name: "Graphite panel", value: "#1C2025", role: ar ? "لوحات على الداكن" : "Panels on dark" },
          { name: "Ink", value: "#0D1014", role: ar ? "العناوين والنص على البرتقالي" : "Headings, text on orange" },
          { name: "Steel grey", value: "#EEF0F3", role: ar ? "خلفية الصفحة" : "Page background" },
          { name: "White", value: "#FFFFFF", role: ar ? "بطاقات المنتجات" : "Product cards" },
        ],
      },
      {
        group: ar ? "الألوان المساندة" : "Supporting colours",
        swatches: [
          { name: "Steel blue", value: "#2C6590", role: ar ? "المعدات والتصنيفات" : "Machinery, categories" },
          { name: "Steel light", value: "#7EAED3", role: ar ? "لمسات على الداكن" : "Accents on dark" },
          { name: "Teal", value: "#1D6F65", role: ar ? "الدعم الميداني" : "Site support" },
          { name: "Brass", value: "#7A5E28", role: ar ? "الحِرفية" : "Craft" },
          { name: "Slate text", value: "#3C4450", role: ar ? "نص الفقرات" : "Body text" },
          { name: "Orange tint", value: "#FFE8DC", role: ar ? "حالات نشطة فاتحة" : "Light active states" },
        ],
      },
    ],
    fonts: [
      { role: data.lab.sheet.display, family: "Outfit", detail: "800 · 44–80px · −3%", lang: "en", className: "t-display text-[3rem]", sample: "Engineering metal into possibility." },
      { role: data.lab.sheet.display, family: "Alexandria", detail: "800 · 38–64px · lh 1.3", lang: "ar", className: "t-display text-[2.6rem]", sample: "نُشكّل المعدن بدقّة هندسية ونصنع الممكن." },
      { role: data.lab.sheet.heading, family: "Outfit", detail: "750 · 32–48px / 700 · 22px", lang: "en", className: "t-h2", sample: "Six service lines. One accountable partner." },
      { role: data.lab.sheet.heading, family: "Alexandria", detail: "700 · 28–40px · lh 1.4", lang: "ar", className: "t-h2", sample: "ست خدمات متكاملة… وشريك واحد مسؤول." },
      {
        role: data.lab.sheet.body,
        family: "Inter + Geist Mono",
        detail: "400/600/700 · 16–20px · figures in mono",
        lang: "en",
        className: "t-lead",
        sample: "Fibre lasers up to 12,000 W, CNC press-brake forming and laser welding.",
      },
      {
        role: data.lab.sheet.body,
        family: "Noto Sans Arabic",
        detail: "400/600 · 16–20px · lh 1.85 · bold UI in Alexandria",
        lang: "ar",
        className: "t-lead",
        sample: "ليزر فايبر بقدرة تصل إلى 12,000 واط، وثني بمكابس CNC، ولحام بالليزر.",
      },
    ],
    radius: [
      { label: ar ? "الوسوم" : "Tags", value: "4px", token: "--r-xs" },
      { label: ar ? "الحقول" : "Fields", value: "6px", token: "--r-sm" },
      { label: ar ? "الأزرار" : "Buttons", value: "8px", token: "--r-btn" },
      { label: ar ? "البطاقات" : "Cards", value: "12px", token: "--r-card" },
      { label: ar ? "اللوحات" : "Panels", value: "16px", token: "--r-panel" },
      { label: ar ? "الشارات" : "Badges", value: "4px", token: "--r-xs" },
    ],
    borders: [
      { label: ar ? "خفيف" : "Subtle", value: "1px #DCE0E5", style: "1px solid #DCE0E5" },
      { label: ar ? "افتراضي" : "Default", value: "1px #C9CFD7", style: "1px solid #C9CFD7" },
      { label: ar ? "قوي" : "Strong", value: "1.5px #A6AFBA", style: "1.5px solid #A6AFBA" },
      { label: ar ? "نشط" : "Active", value: "3px #F15F22", style: "3px solid #F15F22" },
    ],
    shadows: [
      { label: ar ? "بطاقة" : "Card", token: "--sh-card", use: ar ? "البطاقات في وضعها العادي" : "Cards at rest" },
      { label: ar ? "بارز" : "Raised", token: "--sh-raised", use: ar ? "بلاطات الخدمات فوق الواجهة" : "Service tiles over the hero" },
      { label: ar ? "تمرير" : "Hover", token: "--sh-hover", use: ar ? "رفع 6px عند التمرير" : "6px lift on hover" },
      { label: ar ? "عائم" : "Floating", token: "--sh-float", use: ar ? "القوائم" : "Menus" },
      { label: ar ? "على الداكن" : "On dark", token: "--sh-dark", use: ar ? "صور على الجرافيت" : "Photos on graphite" },
      { label: ar ? "داخلي" : "Inset", token: "--sh-inset", use: ar ? "حقول الإدخال" : "Form fields" },
    ],
    buttons: [
      { label: ar ? "أساسي" : "Primary", className: "btn btn-primary", icon: true },
      { label: ar ? "ثانوي داكن" : "Secondary", className: "btn btn-secondary", icon: true },
      { label: ar ? "إطار" : "Outline", className: "btn btn-outline" },
      { label: ar ? "فولاذي" : "Steel", className: "btn btn-steel" },
      { label: ar ? "على الداكن" : "On dark", className: "btn btn-on-dark" },
    ],
    tones: ["brand", "steel", "steel", "brass", "brass", "teal"],
  };

  const by = (slug: string) => data.services.items.find((s) => s.slug === slug)!;
  const project = data.projects.items.find((p) => p.slug === "suspended-lantern")!;
  const machine = data.machinery.items.find((m) => m.slug === "fiber-laser-6kw")!;

  const cards = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <FeatureServiceB service={by("laser-cutting")} open={data.services.open} />
      </div>
      <div className="lg:col-span-5">
        <MachineCardB machine={machine} labels={data.machinery} />
      </div>
      <div className="lg:col-span-4">
        <OverlayServiceB service={by("scaffolding")} />
      </div>
      <div className="lg:col-span-4">
        <ProjectTileB project={project} />
      </div>
      <div className="grid grid-cols-1 content-start gap-4 lg:col-span-4">
        <a href={by("cnc-bending").href} className="b-tile">
          <span className="icon-chip shrink-0">
            <Icon name="cnc-bending" size={21} />
          </span>
          {by("cnc-bending").name}
          <Icon name="arrow" size={17} className="go" />
        </a>
        <div className="rounded-[var(--r-panel)] bg-dark p-6 text-on-dark">
          <p className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--r-sm)] bg-dark-3 text-white">
              <Icon name={statementIcon[0]} size={20} />
            </span>
            <span>
              <span className="t-h4 block text-white">{data.statements[0].title}</span>
              <span className="text-[0.9rem] text-on-dark-2">{data.statements[0].body}</span>
            </span>
          </p>
        </div>
        <div className="rounded-[var(--r-card)] bg-brand p-5 text-ink">
          <p className="t-h4">{data.cta.title}</p>
          <a href={data.links.quote} className="btn btn-secondary btn-sm mt-4">
            {data.cta.primary}
            <Icon name="arrow" size={15} />
          </a>
        </div>
      </div>
    </div>
  );

  return <SystemSheet data={data} spec={spec} header={<HeaderB data={data} />} footer={<FooterB data={data} />} cards={cards} />;
}
