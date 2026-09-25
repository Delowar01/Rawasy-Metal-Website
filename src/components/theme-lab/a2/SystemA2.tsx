import type { LabData } from "../data";
import { Icon } from "../Icon";
import { Block, Meta, SystemSheet, type SystemSpec } from "../SystemSheet";
import { LaserCut } from "../signature/LaserCut";
import { LaserEngrave } from "../signature/LaserEngrave";
import { Logo, Photo, delay, statementIcon } from "../ui";
import { aFontClasses } from "../a/fonts";
import { ContactRowsA2, FooterA2, HeaderA2, ProjectCardA2, ServiceCardA2, ServiceFeatureA2 } from "./HomeA2";
import { MachineShowcase } from "./MachineShowcase";
import { PhonePreview, ReplayReveal, ReplaySignature } from "./SheetControls";
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
      en: "Option A's bright commercial system, refined: white raised cards on cool grey, visible borders, soft layered shadows and orange actions, with a fuller header, a composed hero, two signature laser illustrations and one motion system. Light theme; every colour is a token ready for the dark theme.",
      ar: "نظام الخيار A التجاري المشرق بنسخة مطوّرة: بطاقات بيضاء بارزة على رمادي بارد، وحدود ظاهرة، وظلال ناعمة متدرجة، وأزرار إجراء برتقالية، مع ترويسة أشمل، وواجهة متكاملة التكوين، ورسمين توقيعيين لليزر، ونظام حركة واحد. بالوضع الفاتح، وكل لون رمز جاهز للوضع الداكن.",
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
      {
        group: ar ? "أسطح التوقيع البصري" : "Signature surfaces",
        swatches: [
          { name: "Laser stage", value: "radial-gradient(70% 90% at 50% 40%, #243452, #121d31 62%, #0d1626)", role: ar ? "مسرح القص بالليزر" : "Laser-cutting stage" },
          { name: "Nesting sheet", value: "linear-gradient(115deg, #e9edf1, #f7f9fa 42%, #e5e9ed 72%, #f2f5f7)", role: ar ? "لوح القص مع الشبكة الدقيقة" : "Cut sheet, fine grid" },
          { name: "Cut path", value: "#F15F22", role: ar ? "مسار القص ونقاط الثقب والرأس" : "Cut path, pierce points, head" },
          { name: "Nested parts", value: "#2C5E86", role: ar ? "القطع الفولاذية المرتّبة على اللوح" : "Nested steel parts" },
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
      { label: ar ? "خفيف" : "Subtle", value: "1px #E5E9EF", style: "1px solid #E5E9EF" },
      { label: ar ? "افتراضي" : "Default", value: "1px #D5DBE3", style: "1px solid #D5DBE3" },
      { label: ar ? "قوي" : "Strong", value: "1px #B9C3CF", style: "1px solid #B9C3CF" },
      { label: ar ? "نشط" : "Active", value: "2px #F15F22", style: "2px solid #F15F22" },
    ],
    shadows: [
      { label: ar ? "بطاقة" : "Card", token: "--sh-card", use: ar ? "البطاقات في وضعها العادي" : "Cards at rest" },
      { label: ar ? "بارز" : "Raised", token: "--sh-raised", use: ar ? "اللوحات وشريط الخدمات" : "Panels, service strip" },
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

  const tokens: [string, string, string, string][] = [
    ["--bg", "#F4F6F9", "Page background", "خلفية الصفحة"],
    ["--bg-alt", "#EBEFF4", "Alternate sections", "أقسام متبادلة"],
    ["--surface", "#FFFFFF", "Cards, panels", "البطاقات واللوحات"],
    ["--surface-2", "#F8FAFC", "Inner panels, tags", "لوحات داخلية ووسوم"],
    ["--ink / --ink-2", "#111827 / #454E5C", "Headings / body text", "العناوين / نص الفقرات"],
    ["--line", "#D5DBE3", "Card borders", "حدود البطاقات"],
    ["--brand", "#F15F22", "Primary action, active", "الإجراء الرئيسي والحالة النشطة"],
    ["--steel / --teal / --brass", "#2C5E86 / #1B6F65 / #83642B", "Supporting tones", "الألوان المساندة"],
    ["--navy", "#132039", "Dark panels, footer", "اللوحات الداكنة والتذييل"],
    ["--header-bg-scrolled", "rgb(255 255 255 / 0.84)", "Header after scrolling", "الترويسة بعد التمرير"],
    ["--glass", "rgb(255 255 255 / 0.95)", "Floating cards", "البطاقات العائمة"],
    ["--shadow-rgb / --scrim-rgb", "17 24 39 / 9 15 27", "Shadows, photo scrims", "الظلال وتظليل الصور"],
  ];

  const extra = (
    <>
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
          <table className="w-full min-w-[40rem] text-start text-[0.88rem]">
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
              {tokens.map(([token, value, en, arRole]) => (
                <tr key={token} className="border-b border-line-subtle">
                  <th scope="row" className="py-2.5 pe-4 text-start">
                    <Meta>{token}</Meta>
                  </th>
                  <td className="py-2.5 pe-4">
                    <Meta>{value}</Meta>
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

  return <SystemSheet data={data} spec={spec} header={<HeaderA2 data={data} view="system" />} footer={<FooterA2 data={data} />} cards={cards} lead={lead} extra={extra} />;
}
