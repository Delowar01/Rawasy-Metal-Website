import type { LabData } from "../data";
import { Icon } from "../Icon";
import { Block, Meta, SystemSheet, type SystemSpec } from "../SystemSheet";
import { LaserCut } from "../signature/LaserCut";
import { LaserEngrave } from "../signature/LaserEngrave";
import { Logo, Photo, delay, statementIcon } from "../ui";
import { aFontClasses } from "../a/fonts";
import { ContactRowsA2, FooterA2, HeaderA2, ProjectCardA2, ServiceCardA2, ServiceFeatureA2 } from "./HomeA2";
import { CursorA2 } from "./Cursor";
import { HeroPlateA2 } from "./HeroPlate";
import { MachineShowcase } from "./MachineShowcase";
import { PhonePreview, ReplayReveal, ReplaySignature } from "./SheetControls";
import { themeBoot } from "./theme-boot";
import "./a2.css";

/** Moments of each signature's intro shown as still frames. */
const STILLS = ["initial", "active", "finished"] as const;

/** Option A V2 — Clean Premium Commerce, refined: design-system sheet. */
export function SystemA2({ data }: { data: LabData }) {
  const ar = data.locale === "ar";
  const t = data.lab.sheetA2;
  const spec: SystemSpec = {
    root: `lab-a2 ${aFontClasses}`,
    summary: {
      en: "Option A's bright commercial system, refined twice: off-white raised cards on a soft warm mist (blue-charcoal in the dark theme), visible borders, layered shadows with a lit edge, section sheets and orange actions — with the website's laser-cut plate as the hero, two signature laser illustrations, a precision pointer and one quiet motion system. Light and dark themes share every token.",
      ar: "نظام الخيار A التجاري المشرق بنسخة مطوّرة مرتين: بطاقات بيضاء مكسورة بارزة على ضباب دافئ ناعم (ورمادي فحمي مائل إلى الأزرق في الوضع الداكن)، وحدود ظاهرة، وظلال متدرجة بحافة مضيئة، وأقسام على هيئة ألواح، وأزرار إجراء برتقالية — مع لوح الموقع المقصوص بالليزر في الواجهة، ورسمين توقيعيين لليزر، ومؤشر دقيق، ونظام حركة هادئ واحد. ويشترك الوضعان الفاتح والداكن في كل الرموز.",
    },
    palette: [
      {
        group: ar ? "الأساسي والمحايد · الفاتح" : "Brand and neutrals · light",
        swatches: [
          { name: "RAWASY Orange", value: "#F15F22", role: ar ? "الإجراء الرئيسي والحالة النشطة" : "Primary action, active state" },
          { name: "Charcoal ink", value: "#15171A", role: ar ? "العناوين والنص على البرتقالي" : "Headings, text on orange" },
          { name: "Slate text", value: "#454A50", role: ar ? "نص الفقرات" : "Body text" },
          { name: "Warm mist", value: "#F4F4F1", role: ar ? "خلفية الصفحة" : "Page background" },
          { name: "Section grey", value: "#ECECE8", role: ar ? "ألواح الأقسام" : "Section sheets" },
          { name: "Off-white", value: "#FDFDFB", role: ar ? "البطاقات واللوحات" : "Cards and panels" },
        ],
      },
      {
        group: ar ? "الألوان المساندة" : "Supporting colours",
        swatches: [
          { name: "Commercial navy", value: "#132039", role: ar ? "لوحات داكنة وتذييل" : "Dark panels, footer" },
          { name: "Steel blue", value: "#2C5E86", role: ar ? "المعدات والمعلومات" : "Machinery, information" },
          { name: "Teal", value: "#1B6F65", role: ar ? "العمليات والدعم الميداني" : "Process, site support" },
          { name: "Brass", value: "#7B5C24", role: ar ? "الحِرفية والامتثال" : "Craft, compliance" },
          { name: "Orange tint", value: "#FDEFE6", role: ar ? "سطح التمييز" : "Accent surface" },
          { name: "Steel tint", value: "#E9F0F5", role: ar ? "مسرح عرض المعدات" : "Machine stage" },
        ],
      },
      {
        group: ar ? "الوضع الداكن" : "Dark theme",
        swatches: [
          { name: "Blue-charcoal", value: "#131820", role: ar ? "خلفية الصفحة" : "Page background" },
          { name: "Section", value: "#171D26", role: ar ? "ألواح الأقسام" : "Section sheets" },
          { name: "Surface", value: "#1C232D", role: ar ? "البطاقات واللوحات" : "Cards and panels" },
          { name: "Lifted orange", value: "#F26A2E", role: ar ? "الإجراء الرئيسي" : "Primary action" },
          { name: "Light steel", value: "#7FB0D8", role: ar ? "المعدات والمعلومات" : "Machinery, information" },
          { name: "Light brass", value: "#D7B273", role: ar ? "الحِرفية والامتثال" : "Craft, compliance" },
        ],
      },
      {
        group: ar ? "أسطح التوقيع البصري" : "Signature surfaces",
        swatches: [
          { name: "Hero plate", value: "linear-gradient(135deg, #d9dcd9, #f6f7f5 42%, #d9dcd9 68%, #c3c7c4)", role: ar ? "لوح الواجهة الفولاذي المصقول" : "Brushed steel hero plate" },
          { name: "Hero stage", value: "radial-gradient(60% 52% at 50% 44%, #ffffff, transparent), linear-gradient(180deg, #fcfcfa, #eeefeb)", role: ar ? "منصة اللوح مع شبكة القياس" : "Plate stage, measuring grid" },
          { name: "Laser stage", value: "radial-gradient(70% 90% at 50% 40%, #243452, #121d31 62%, #0d1626)", role: ar ? "مسرح القص بالليزر" : "Laser-cutting stage" },
          { name: "Cut path · hot points", value: "#F15F22", role: ar ? "مسار القص ونقاط الثقب والقياس" : "Cut path, pierce and measuring points" },
          { name: "Brass plate", value: "linear-gradient(118deg, #c9ae76, #e6d4a8 40%, #b99a5f 72%, #e6d4a8)", role: ar ? "لوح الحفر" : "Engraving plate" },
          { name: "Groove", value: "rgb(72 52 18 / 0.8)", role: ar ? "الأخاديد المحفورة بحافة مضيئة" : "Engraved grooves, with a light edge" },
        ],
      },
    ],
    fonts: [
      { role: data.lab.sheet.display, family: "Plus Jakarta Sans", detail: "800 · 39–64px · −2.8%", lang: "en", className: "t-display text-[2.6rem]", sample: "Engineering metal into possibility." },
      { role: data.lab.sheet.display, family: "Tajawal", detail: "800 · 36–58px · lh 1.32", lang: "ar", className: "t-display text-[2.4rem]", sample: "نُشكّل المعدن بدقّة هندسية ونصنع الممكن." },
      { role: data.lab.sheet.heading, family: "Plus Jakarta Sans", detail: "760 · 28–39px / 700 · 19px", lang: "en", className: "t-h2", sample: "Six service lines. One accountable partner." },
      { role: data.lab.sheet.heading, family: "Tajawal", detail: "800 · 26–37px · lh 1.45", lang: "ar", className: "t-h2", sample: "ست خدمات متكاملة… وشريك واحد مسؤول." },
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
      { label: ar ? "خفيف" : "Subtle", value: "1px #E4E4DF", style: "1px solid #E4E4DF" },
      { label: ar ? "افتراضي" : "Default", value: "1px #D6D6D0", style: "1px solid #D6D6D0" },
      { label: ar ? "قوي" : "Strong", value: "1px #BAB9B2", style: "1px solid #BAB9B2" },
      { label: ar ? "الحقول (3:1)" : "Fields (3:1)", value: "1px #87877F", style: "1px solid #87877F" },
      { label: ar ? "نشط" : "Active", value: "2px #F15F22", style: "2px solid #F15F22" },
    ],
    shadows: [
      { label: ar ? "بطاقة" : "Card", token: "--sh-card", use: ar ? "البطاقات في وضعها العادي" : "Cards at rest" },
      { label: ar ? "بارز" : "Raised", token: "--sh-raised", use: ar ? "اللوحات وشريط الخدمات" : "Panels, service strip" },
      { label: ar ? "تمرير" : "Hover", token: "--sh-hover", use: ar ? "رفع البطاقة عند التمرير" : "Card lift on hover" },
      { label: ar ? "عائم" : "Floating", token: "--sh-float", use: ar ? "البطاقات العائمة والقوائم" : "Floating cards, menus" },
      { label: ar ? "صورة" : "Image", token: "--sh-image", use: ar ? "الصور الكبيرة" : "Large photos" },
      { label: ar ? "داخلي" : "Inset", token: "--sh-inset", use: ar ? "حقول الإدخال" : "Form fields" },
      { label: ar ? "برتقالي" : "Brand", token: "--sh-brand", use: ar ? "الأزرار الرئيسية" : "Primary buttons" },
    ],
    buttons: [
      { label: ar ? "أساسي" : "Primary", className: "btn btn-primary", icon: true },
      { label: ar ? "ثانوي" : "Secondary", className: "btn btn-secondary" },
      { label: ar ? "داكن" : "Dark", className: "btn btn-dark", icon: true },
      { label: ar ? "فولاذي" : "Steel", className: "btn btn-steel" },
      { label: ar ? "على الداكن" : "On dark", className: "btn btn-on-dark" },
    ],
    tones: ["brand", "steel", "steel", "brass", "brass", "teal"],
  };

  const find = <T extends { slug: string }>(items: T[], slug: string) => items.find((i) => i.slug === slug)!;
  const services = data.services.items;
  const project = find(data.projects.items, "clock-tower-landmark");
  const machines = ["fiber-laser-combo-12kw", "cnc-press-brake", "laser-welding"].map((slug) => find(data.machinery.items, slug));

  const cards = (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <ServiceFeatureA2 service={find(services, "laser-cutting")} data={data} />
      </div>
      <div className="lg:col-span-5">
        <ServiceFeatureA2 service={find(services, "laser-engraving")} data={data} />
      </div>
      <div className="grid grid-cols-2 items-start gap-3 sm:gap-5 lg:col-span-5">
        <div>
          <ServiceCardA2 service={find(services, "cnc-bending")} open={data.services.open} />
        </div>
        <div>
          <ServiceCardA2 service={find(services, "steel-structures")} open={data.services.open} />
        </div>
      </div>
      <div className="h-[24rem] lg:col-span-7 lg:h-auto lg:min-h-[24rem]">
        <ProjectCardA2 project={project} view={data.projects.view} sizes="(min-width: 1024px) 680px, 92vw" />
      </div>
      <div className="lg:col-span-12">
        <MachineShowcase
          items={machines}
          quote={data.links.quote}
          labels={{ power: data.machinery.power, service: data.machinery.service, list: data.machinery.label, quote: data.ui.requestQuote }}
        />
      </div>
    </div>
  );

  // The two signatures lead the sheet: a live demo with a replay, then still frames of the intro.
  const lead = (
    <>
      <Block title={t.plate} note={t.plateNote}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          {/* As in the hero: its hot points breathe while on screen (data-ambient). */}
          <div id="demo-plate" className="lg:col-span-7" data-ambient>
            <HeroPlateA2 photo={data.hero.image} labels={data.hero.plate} />
          </div>
          <div className="lg:col-span-5">
            <ol className="a2-steps grid gap-2.5">
              {t.plateSteps.map((step) => (
                <li key={step} className="flex items-center text-[0.94rem] font-medium">
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <ReplaySignature target="demo-plate" label={t.replay} />
            </div>
            <div className="mt-4">
              <Meta>0–760 ms rise · 0.2–1.05 s dimensions · 1.15–2.0 s bolt holes · 2.0–3.0 s star · 3.3–3.75 s slot · 3.9–4.4 s perforation · 4.5–5.2 s nodes · 5.2 s</Meta>
            </div>
          </div>
        </div>
        <div className="mt-8" data-js-only>
          <h3 className="t-h4">{t.stills}</h3>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STILLS.map((k) => (
              <li key={k}>
                <HeroPlateA2 photo={data.hero.image} labels={data.hero.plate} freeze={k} className="a2-plate-still" />
                <p className="mt-2.5 text-[0.86rem] font-medium text-ink-2">{t.plateStates[k]}</p>
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block title={t.cut} note={t.cutNote}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div id="demo-cut" className="a2-stage a2-stage-sig a2-stage-plain a2-stage-dark rounded-[var(--r-card)] border border-line lg:col-span-7" data-sig-host>
            <LaserCut />
          </div>
          <div className="lg:col-span-5">
            <ol className="a2-steps grid gap-2.5">
              {t.cutSteps.map((step) => (
                <li key={step} className="flex items-center text-[0.94rem] font-medium">
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <ReplaySignature target="demo-cut" label={t.replay} />
            </div>
            <div className="mt-4">
              <Meta>0–560 ms sheet · 200–1080 scan · 340–1180 nested parts · 760–1040 head on · 1.4–4.3 s holes, slot · 4.6–6.6 s outer contour · 7.6 s (replay 7.1 s)</Meta>
            </div>
          </div>
        </div>
        <div className="mt-8" data-js-only>
          <h3 className="t-h4">{t.stills}</h3>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STILLS.map((k) => (
              <li key={k}>
                <div className="a2-stage a2-sig-frame a2-stage-dark rounded-[var(--r-card)] border border-line">
                  <LaserCut freeze={k} />
                </div>
                <p className="mt-2.5 text-[0.86rem] font-medium text-ink-2">{t.cutStates[k]}</p>
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block title={t.engrave} note={t.engraveNote}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div id="demo-engrave" className="a2-stage a2-stage-sig a2-stage-plain a2-stage-brass rounded-[var(--r-card)] border border-line lg:col-span-7" data-sig-host>
            <LaserEngrave />
          </div>
          <div className="lg:col-span-5">
            <ol className="a2-steps grid gap-2.5">
              {t.engraveSteps.map((step) => (
                <li key={step} className="flex items-center text-[0.94rem] font-medium">
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <ReplaySignature target="demo-engrave" label={t.replay} />
            </div>
            <div className="mt-4">
              <Meta>0–460 ms plate · 120–1100 reflection · 650–900 crosshair · 1.2–2.2 s border · 2.3–3.7 s lines · 3.8–5.0 s rosette · 5.0–5.7 s ring · 5.9–6.8 s light · 6.8 s (replay 6.3 s)</Meta>
            </div>
          </div>
        </div>
        <div className="mt-8" data-js-only>
          <h3 className="t-h4">{t.stills}</h3>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STILLS.map((k) => (
              <li key={k}>
                <div className="a2-stage a2-sig-frame a2-stage-brass rounded-[var(--r-card)] border border-line">
                  <LaserEngrave freeze={k} />
                </div>
                <p className="mt-2.5 text-[0.86rem] font-medium text-ink-2">{t.engraveStates[k]}</p>
              </li>
            ))}
          </ul>
        </div>
      </Block>
    </>
  );

  const tokens: [string, string, string, string, string][] = [
    ["--bg / --bg-alt / --bg-deep", "#F4F4F1 / #ECECE8 / #E5E5E0", "#131820 / #171D26 / #0F141B", "Page, section sheets, recessed", "الصفحة، ألواح الأقسام، الشريط الغائر"],
    ["--surface / -2 / -3", "#FDFDFB / #F7F7F4 / #F0F0EC", "#1C232D / #222A35 / #283140", "Cards, inner panels, muted", "البطاقات واللوحات الداخلية والأسطح الهادئة"],
    ["--ink / --ink-2 / --ink-3", "#15171A / #454A50 / #5C6168", "#EEF1F4 / #B8C0CA / #9AA3AE", "Headings / body / secondary", "العناوين / الفقرات / النص الثانوي"],
    ["--line-subtle / --line / --line-strong / --line-ink", "#E4E4DF / #D6D6D0 / #BAB9B2 / #87877F", "#232B35 / #2D3642 / #3F4A57 / #66727F", "Borders, fields (3:1)", "الحدود والحقول (3:1)"],
    ["--brand / --brand-ink / --brand-soft", "#F15F22 / #B3410D / #FDEFE6", "#F26A2E / #FF9466 / #2E211B", "Primary action, orange text, tint", "الإجراء الرئيسي والنص البرتقالي والتدرّج"],
    ["--steel / --teal / --brass", "#2C5E86 / #1B6F65 / #7B5C24", "#7FB0D8 / #5CC0B0 / #D7B273", "Supporting tones", "الألوان المساندة"],
    ["--navy / --dark", "#132039 / #111C30", "#17243B / #0C1016", "Dark panels, footer", "اللوحات الداكنة والتذييل"],
    ["--focus", "#2C5E86", "#8EBCDF", "Focus ring, field focus", "حلقة التركيز وتركيز الحقول"],
    ["--hs-* / --plate-*", "#FCFCFA → #EEEFEB · steel #D9DCD9–#F6F7F5", "#1F2733 → #161C25 · steel #434C57–#64707E", "Hero stage and plate", "منصة الواجهة واللوح"],
    ["--pattern-dot / --pattern-line", "rgb(40 38 30 / 8.5 % · 5 %)", "rgb(200 215 235 / 7.5 % · 4.5 %)", "Dot matrix, measuring grid", "مصفوفة النقاط وشبكة القياس"],
    ["--glow-warm / --glow-cool / --band-glow", "orange 13 % / steel 10 % / orange 24 %", "orange 13 % / steel 15 % / orange 28 %", "Hero glows, dark bands", "توهج الواجهة والأشرطة الداكنة"],
    ["--sh-card / --sh-raised / --sh-hover", "lit top edge + warm soft shadow", "faint top edge + deep shadow", "Depth", "العمق"],
  ];

  /* Background roles: token, light, dark (the swatches render the live tokens of each theme). */
  const backgrounds: [string, string, string][] = [
    ["--bg", "#F4F4F1", "#131820"],
    ["--bg-alt", "#ECECE8", "#171D26"],
    ["--bg-deep", "#E5E5E0", "#0F141B"],
    ["--surface", "#FDFDFB", "#1C232D"],
    ["--surface-2", "#F7F7F4 · #F0F0EC", "#222A35 · #283140"],
    ["--brand-soft", "#FDEFE6", "#2E211B"],
    ["--hero-top", "#FBFBF9 + grid + glows", "#171D27 + grid + glows"],
    ["--dark", "#111C30 + band glow", "#0C1016 + band glow"],
  ];

  /* Measured contrast (light, dark) for t.contrastRows, in order. */
  const contrast: [number, number][] = [
    [16.3, 15.71],
    [8.11, 9.69],
    [8.78, 8.61],
    [5.27, 5.13],
    [4.82, 6.67],
    [5.07, 6.58],
    [5.47, 6.05],
    [9.46, 10.59],
    [3.55, 3.22],
    [6.24, 8.83],
    [3.32, 5.1],
    [5.4, 5.89],
  ];

  /* Content width and side margin, before this pass and now. */
  const layout: [string, string, string][] = [
    ["1280 px", "1200 / 40", "1178 / 51"],
    ["1440 px", "1240 / 100", "1325 / 58"],
    ["1920 px", "1240 / 340", "1400 / 260"],
    ["2560 px", "1240 / 660", "1400 / 580"],
  ];

  const cursorStates: { state: string; press?: boolean; dark?: boolean; backdrop: string }[] = [
    { state: "idle", backdrop: "" },
    { state: "active", backdrop: "button" },
    { state: "plate", backdrop: "plate" },
    { state: "active", press: true, backdrop: "button" },
    { state: "idle", dark: true, backdrop: "dark" },
  ];

  const toneName = ar
    ? { brand: "البرتقالي", steel: "الفولاذي", teal: "الفيروزي", brass: "النحاسي" }
    : { brand: "Orange", steel: "Steel", teal: "Teal", brass: "Brass" };
  const themeSample = (theme: "light" | "dark") => (
    <div className={`a2-theme-${theme} a2-tone-sample rounded-[var(--r-panel)] border border-line p-5 sm:p-6`}>
      <p className="eyebrow">{theme === "light" ? t.light : t.dark}</p>
      <p className="t-h3 mt-4">{data.services.title}</p>
      <p className="t-small mt-2 max-w-[34em]">{data.services.intro}</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <span className="btn btn-primary btn-sm">
          {data.ui.requestQuote}
          <Icon name="arrow" size={15} />
        </span>
        <span className="btn btn-secondary btn-sm">{data.services.all}</span>
      </div>
      <div className="card mt-5 flex items-start gap-3.5 p-4" data-tone="steel">
        <span className="icon-chip shrink-0">
          <Icon name="cnc-bending" size={20} />
        </span>
        <span className="min-w-0">
          <span className="t-h4 block">{services[1].name}</span>
          <span className="t-small mt-1 block">{services[1].tagline}</span>
          <span className="tag tag-tone mt-3">{services[1].highlights[0]}</span>
        </span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {(["brand", "steel", "teal", "brass"] as const).map((tone) => (
          <li key={tone} className="tag tag-tone" data-tone={tone}>
            {toneName[tone]}
          </li>
        ))}
      </ul>
    </div>
  );

  const extra = (
    <>
      <Block title={t.backgrounds} note={t.backgroundsNote}>
        <div className="overflow-x-auto" role="region" aria-label={t.backgrounds} tabIndex={0}>
          <table className="w-full min-w-[40rem] text-start text-[0.88rem]">
            <thead>
              <tr className="border-b border-line text-[0.78rem] text-ink-2">
                {t.bgHead.map((h) => (
                  <th key={h} className="py-2 pe-4 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backgrounds.map(([token, light, dark], i) => (
                <tr key={token} className="border-b border-line-subtle">
                  <th scope="row" className="py-2.5 pe-4 text-start font-semibold">
                    {t.bgRoles[i]}
                  </th>
                  <td className="py-2.5 pe-4">
                    <Meta>{token}</Meta>
                  </td>
                  {([["light", light], ["dark", dark]] as const).map(([theme, value]) => (
                    <td key={theme} className="py-2.5 pe-4">
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className={`a2-theme-${theme} a2-bg-chip ${i === 6 ? "a2-bg-chip-hero" : ""} ${i === 7 ? "a2-bg-chip-dark" : ""}`}
                          style={i < 6 ? { background: `var(${token})` } : undefined}
                        />
                        <Meta>{value}</Meta>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title={t.themes} note={t.themesNote}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {themeSample("light")}
          {themeSample("dark")}
        </div>
      </Block>

      <Block title={t.contrast} note={t.contrastNote}>
        <div className="overflow-x-auto" role="region" aria-label={t.contrast} tabIndex={0}>
          <table className="w-full min-w-[34rem] text-start text-[0.88rem]">
            <thead>
              <tr className="border-b border-line text-[0.78rem] text-ink-2">
                {t.contrastHead.map((h) => (
                  <th key={h} className="py-2 pe-4 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.contrastRows.map((row, i) => (
                <tr key={row} className="border-b border-line-subtle">
                  <th scope="row" className="py-2.5 pe-4 text-start font-semibold">
                    {row}
                  </th>
                  {contrast[i].map((ratio, k) => (
                    <td key={k} className="py-2.5 pe-4">
                      <span className="inline-flex items-center gap-2">
                        <Icon name="check" size={15} className="text-teal" />
                        <Meta>{ratio.toFixed(2)}:1</Meta>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title={t.cursor} note={t.cursorNote}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cursorStates.map((c, i) => (
            <li key={i}>
              <div className={`a2-cursor-tile ${c.backdrop ? `a2-cursor-tile-${c.backdrop}` : ""}`}>
                {c.backdrop === "button" && (
                  <span className="btn btn-primary btn-sm" aria-hidden>
                    {data.ui.getQuote}
                  </span>
                )}
                <span className="a2-cursor a2-cursor-spec" data-state={c.state} data-press={c.press ? "" : undefined} data-dark={c.dark ? "" : undefined} aria-hidden>
                  <span className="a2-cursor-ring" />
                  <span className="a2-cursor-dot" />
                </span>
              </div>
              <p className="mt-2 text-[0.84rem] font-medium text-ink-2">{t.cursorStates[i]}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {t.cursorRules.map((rule) => (
            <li key={rule} className="flex items-center gap-2.5 text-[0.92rem] font-medium">
              <Icon name="check" size={16} className="shrink-0 text-teal" />
              {rule}
            </li>
          ))}
        </ul>
      </Block>

      <Block title={t.ambient} note={t.ambientNote}>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {t.ambientSamples.map((label, i) => (
            <li key={label}>
              <div className={`a2-amb-sample ${["a2-amb-dots", "a2-amb-hero", "a2-amb-dark a2-dark-amb"][i]}`} aria-hidden>
                {i === 1 && (
                  <span className="a2-hero-ambient">
                    <span className="a2-glow" />
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-[0.86rem] font-medium text-ink-2">{label}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title={t.layout} note={t.layoutNote}>
        <div className="overflow-x-auto" role="region" aria-label={t.layout} tabIndex={0}>
          <table className="w-full min-w-[30rem] text-start text-[0.88rem]">
            <thead>
              <tr className="border-b border-line text-[0.78rem] text-ink-2">
                {t.layoutHead.map((h) => (
                  <th key={h} className="py-2 pe-4 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layout.map(([screen, before, now]) => (
                <tr key={screen} className="border-b border-line-subtle">
                  <th scope="row" className="py-2.5 pe-4 text-start font-semibold">
                    <span dir="ltr">{screen}</span>
                  </th>
                  <td className="py-2.5 pe-4">
                    <Meta>{before}</Meta>
                  </td>
                  <td className="py-2.5 pe-4">
                    <Meta>{now}</Meta>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title={t.clients} note={t.clientsNote}>
        <div className="flex justify-end">
          <button type="button" className="a2-toggle" data-toggle="colour" aria-pressed="false" aria-controls="sheet-wall" data-js-only>
            <span className="knob" aria-hidden />
            <Icon name="colour" size={16} className="text-teal" />
            {data.clients.colours}
          </button>
        </div>
        <ul id="sheet-wall" aria-label={data.clients.listLabel} className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
          {data.clients.items.slice(0, 7).map((c) => (
            <li key={c.slug}>
              <div className="logo-tile">
                <Logo image={c.logo} />
              </div>
            </li>
          ))}
        </ul>
      </Block>

      <Block title={t.contact}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="grid grid-cols-1 content-start gap-2.5 sm:grid-cols-2 lg:col-span-8">
            <ContactRowsA2 data={data} />
          </div>
          <div className="a2-cta-dark flex flex-col justify-between gap-5 rounded-[var(--r-card)] p-6 lg:col-span-4">
            <Photo image={data.cta.image} alt="" sizes="360px" className="-z-[2] object-cover" />
            <p className="t-h4 text-white">{data.cta.title}</p>
            <div className="flex flex-wrap gap-2">
              <a href={data.links.quote} className="btn btn-primary btn-sm">
                {data.ui.requestQuote}
                <Icon name="arrow" size={15} />
              </a>
              <a href={data.contact.whatsappHref} className="btn btn-on-dark btn-sm">
                <Icon name="chat" size={16} />
                {data.ui.whatsapp}
              </a>
            </div>
          </div>
        </div>
      </Block>

      <Block title={t.motion} note={t.motionNote}>
        <div className="overflow-x-auto" role="region" aria-label={t.motion} tabIndex={0}>
          <table className="w-full min-w-[34rem] text-start text-[0.88rem]">
            <thead>
              <tr className="border-b border-line text-[0.78rem] text-ink-2">
                {t.motionHead.map((h) => (
                  <th key={h} className="py-2 pe-4 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.motionRows.map(([name, value, use]) => (
                <tr key={name} className="border-b border-line-subtle">
                  <th scope="row" className="py-2.5 pe-4 text-start font-semibold">
                    {name}
                  </th>
                  <td className="py-2.5 pe-4">
                    <Meta>{value}</Meta>
                  </td>
                  <td className="py-2.5 text-ink-2">{use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title={t.reveal} note={t.revealNote}>
        <div id="demo-reveal" className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
          <div className="a2-photo aspect-[4/3]" data-reveal="clip">
            <Photo image={data.services.items[1].image!} sizes="(min-width: 640px) 30vw, 92vw" />
          </div>
          {data.statements.slice(0, 2).map((s, i) => (
            <div key={s.title} className="card flex items-start gap-3.5 p-5" data-tone={i ? "teal" : "steel"} data-reveal style={delay(90 + i * 90)}>
              <span className="icon-chip shrink-0">
                <Icon name={statementIcon[i]} size={20} />
              </span>
              <span>
                <span className="t-h4 block">{s.title}</span>
                <span className="t-small mt-1 block">{s.body}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <ReplayReveal target="demo-reveal" label={t.replayReveal} />
        </div>
      </Block>

      <Block title={t.mobile} note={t.mobileNote}>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex justify-center lg:col-span-6">
            <PhonePreview src={data.lab.homeHref} title={t.mobileFrame} />
          </div>
          <ul className="grid gap-3 lg:col-span-6">
            {t.mobileRules.map((rule) => (
              <li key={rule} className="card flex items-center gap-3 p-4" data-tone="teal">
                <span className="icon-chip size-9 shrink-0">
                  <Icon name="check" size={17} />
                </span>
                <span className="text-[0.94rem] font-medium">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block title={t.tokens} note={t.tokensNote}>
        <div className="overflow-x-auto" role="region" aria-label={t.tokens} tabIndex={0}>
          <table className="w-full min-w-[52rem] text-start text-[0.88rem]">
            <thead>
              <tr className="border-b border-line text-[0.78rem] text-ink-2">
                {t.tokenHead.map((h) => (
                  <th key={h} className="py-2 pe-4 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokens.map(([token, light, dark, en, arRole]) => (
                <tr key={token} className="border-b border-line-subtle">
                  <th scope="row" className="py-2.5 pe-4 text-start">
                    <Meta>{token}</Meta>
                  </th>
                  <td className="py-2.5 pe-4">
                    <Meta>{light}</Meta>
                  </td>
                  <td className="py-2.5 pe-4">
                    <Meta>{dark}</Meta>
                  </td>
                  <td className="py-2.5 text-ink-2">{ar ? arRole : en}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </>
  );

  // The theme is applied before the sheet paints (see theme-boot).
  const header = (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      <HeaderA2 data={data} view="system" />
      <CursorA2 />
      </>
  );
  return <SystemSheet data={data} spec={spec} header={header} footer={<FooterA2 data={data} />} cards={cards} lead={lead} extra={extra} />;
}
