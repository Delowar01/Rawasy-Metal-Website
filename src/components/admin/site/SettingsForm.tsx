"use client";
/**
 * The company & website settings form (A6.1): general facts (website, email, phones and WhatsApp, Facebook, the map, the
 * default share image), then the English and the Arabic texts (site name, names, statement, address, vision, the default
 * SEO description), each language in its own card, Arabic right to left, with A3's "<language> is complete" box and,
 * once, "This change does not affect the other language" (the server plans each language's status from them and what
 * changed). One save sends the whole form with the version it was opened on; the server checks everything again.
 * Leaving with unsaved changes asks first.
 */
import { useState } from "react";
import { MediaSlotField } from "@/components/admin/media/MediaFields";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import type { MediaCardModel } from "@/server/admin/actions/media-model";
import { saveSettingsAction } from "@/server/admin/actions/site";
import type { LocaleKey, PhoneFormModel, SettingsFormModel, SettingsTextsModel } from "@/server/admin/actions/site-model";
import { SaveAlert, useSiteSave } from "./useSiteSave";

const LOCALES: { code: LocaleKey; heading: string }[] = [
  { code: "en", heading: "English" },
  { code: "ar", heading: "العربية" },
];

type TextKey = Exclude<keyof SettingsTextsModel, "addressLines" | "visionAims">;
type Draft = Omit<SettingsFormModel, "texts" | "needsReview"> & { texts: Record<LocaleKey, Omit<SettingsTextsModel, "addressLines" | "visionAims"> & { addressLines: string; visionAims: string }> };

const toDraft = (full: SettingsFormModel): Draft => {
  const { needsReview, ...model } = full;
  void needsReview;
  return draftOf(model);
};

const draftOf = (model: Omit<SettingsFormModel, "needsReview">): Draft => ({
  ...model,
  complete: { ...model.complete },
  phones: model.phones.map((p) => ({ ...p })),
  texts: {
    en: { ...model.texts.en, addressLines: model.texts.en.addressLines.join("\n"), visionAims: model.texts.en.visionAims.join("\n") },
    ar: { ...model.texts.ar, addressLines: model.texts.ar.addressLines.join("\n"), visionAims: model.texts.ar.visionAims.join("\n") },
  },
});

const TEXTS: { key: TextKey; label: string; long?: boolean; max: number; hint?: string }[] = [
  { key: "siteName", label: "Site name", max: 80, hint: "Browser titles and share cards." },
  { key: "brandName", label: "Brand name", max: 80 },
  { key: "legalName", label: "Legal name", max: 200 },
  { key: "statement", label: "Company statement", long: true, max: 600, hint: "Under the logo in the footer, and the company's description." },
  { key: "addressFull", label: "Full address (one line)", max: 300 },
  { key: "streetAddress", label: "Street address (structured data)", max: 200 },
  { key: "city", label: "City", max: 80 },
  { key: "country", label: "Country", max: 80 },
  { key: "visionStatement", label: "Vision statement", long: true, max: 600 },
  { key: "visionClosing", label: "Vision closing line", max: 300 },
  { key: "defaultSeoDescription", label: "Default SEO description (optional)", long: true, max: 320, hint: "Used where a page has no description of its own. Empty today: every page has its own." },
];

export function SettingsForm({
  model,
  cards: initialCards,
  canEdit,
  canUpload,
}: {
  model: SettingsFormModel;
  cards: Record<string, MediaCardModel>;
  canEdit: boolean;
  canUpload: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(model));
  const [cards, setCards] = useState(initialCards);
  const [otherUnaffected, setOtherUnaffected] = useState(false);
  const { pending, state, submit, reload, issue } = useSiteSave(saveSettingsAction, "/admin/settings?saved=1");
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(model));
  useUnsavedChanges(canEdit && dirty);
  const disabled = !canEdit || pending;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setText = (locale: LocaleKey, key: keyof Draft["texts"]["en"], value: string) => setDraft((d) => ({ ...d, texts: { ...d.texts, [locale]: { ...d.texts[locale], [key]: value } } }));
  const setPhone = (index: number, change: Partial<PhoneFormModel>) => setDraft((d) => ({ ...d, phones: d.phones.map((p, i) => (i === index ? { ...p, ...change } : p)) }));
  const movePhone = (index: number, by: -1 | 1) =>
    setDraft((d) => {
      const phones = [...d.phones];
      const [item] = phones.splice(index, 1);
      phones.splice(index + by, 0, item);
      return { ...d, phones };
    });

  const save = () =>
    submit({
      expectedVersion: draft.lockVersion,
      websiteUrl: draft.websiteUrl,
      email: draft.email,
      postalCode: draft.postalCode,
      geoLat: draft.geoLat,
      geoLng: draft.geoLng,
      geoIsApproximate: draft.geoIsApproximate,
      facebookUrl: draft.facebookUrl,
      mapsPlaceUrl: draft.mapsPlaceUrl,
      mapsQuery: draft.mapsQuery,
      defaultOgImageMediaId: draft.defaultOgImageMediaId,
      phones: draft.phones,
      texts: {
        en: { ...draft.texts.en, addressLines: draft.texts.en.addressLines.split("\n"), visionAims: draft.texts.en.visionAims.split("\n") },
        ar: { ...draft.texts.ar, addressLines: draft.texts.ar.addressLines.split("\n"), visionAims: draft.texts.ar.visionAims.split("\n") },
      },
      complete: draft.complete,
      otherUnaffected,
    });

  const field = (path: string, label: string, value: string, onChange: (v: string) => void, options: { hint?: string; type?: string; dir?: "ltr" | "rtl"; lang?: string; long?: boolean; autoComplete?: string } = {}) => {
    const id = `f-${path.replace(/\./g, "-")}`;
    const error = issue(path);
    const describedBy = [options.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
    const common = {
      id,
      className: options.long ? "adm-input adm-textarea" : "adm-input",
      value,
      disabled,
      dir: options.dir,
      lang: options.lang,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
    };
    return (
      <div className="adm-field" key={path}>
        <label className="adm-label" htmlFor={id}>
          {label}
        </label>
        {options.long ? (
          <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...common} type={options.type ?? "text"} autoComplete={options.autoComplete ?? "off"} onChange={(e) => onChange(e.target.value)} />
        )}
        {options.hint ? (
          <p className="adm-hint" id={`${id}-hint`}>
            {options.hint}
          </p>
        ) : null}
        {error ? (
          <p className="adm-hint adm-error" id={`${id}-error`}>
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form
      className="adm-editor adm-site-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (canEdit) save();
      }}
    >
      <SaveAlert state={state} onReload={reload} />

      <section className="adm-card" aria-labelledby="settings-contact-title">
        <div className="adm-card-head">
          <h2 id="settings-contact-title">Contact and website</h2>
        </div>
        {field("websiteUrl", "Website address", draft.websiteUrl, (v) => set("websiteUrl", v), { type: "url", dir: "ltr" })}
        {field("email", "Email", draft.email, (v) => set("email", v), { type: "email", dir: "ltr" })}
        <fieldset className="adm-subset" aria-describedby={issue("phones") ? "f-phones-error" : undefined}>
          <legend className="adm-label">Phone numbers</legend>
          <p className="adm-hint">In order. The website&apos;s WhatsApp links use the first shown number that has WhatsApp.</p>
          {issue("phones") ? (
            <p className="adm-hint adm-error" id="f-phones-error">
              {issue("phones")}
            </p>
          ) : null}
          <ol className="adm-site-rows">
            {draft.phones.map((phone, i) => (
              <li key={phone.id || `new-${i}`} className="adm-site-row">
                <div className="adm-site-pair">
                  {field(`phones.${i}.display`, `Number ${i + 1} as shown`, phone.display, (v) => setPhone(i, { display: v }), { dir: "ltr" })}
                  {field(`phones.${i}.e164`, `Number ${i + 1} for links (+966…)`, phone.e164, (v) => setPhone(i, { e164: v }), { dir: "ltr", hint: "International form, used for call and WhatsApp links." })}
                </div>
                <div className="adm-site-checks">
                  <label className="adm-check">
                    <input type="checkbox" checked={phone.hasWhatsapp} disabled={disabled} onChange={(e) => setPhone(i, { hasWhatsapp: e.target.checked })} />
                    Has WhatsApp
                  </label>
                  <label className="adm-check">
                    <input type="checkbox" checked={phone.isVisible} disabled={disabled} onChange={(e) => setPhone(i, { isVisible: e.target.checked })} />
                    Shown on the website
                  </label>
                </div>
                {canEdit ? (
                  <div className="adm-actions adm-site-actions">
                    <button type="button" className="adm-btn is-small" disabled={disabled || i === 0} onClick={() => movePhone(i, -1)}>
                      Move up<span className="adm-sr-only"> number {i + 1}</span>
                    </button>
                    <button type="button" className="adm-btn is-small" disabled={disabled || i === draft.phones.length - 1} onClick={() => movePhone(i, 1)}>
                      Move down<span className="adm-sr-only"> number {i + 1}</span>
                    </button>
                    <button type="button" className="adm-btn is-small is-danger" disabled={disabled || draft.phones.length <= 1} onClick={() => set("phones", draft.phones.filter((_, n) => n !== i))}>
                      Remove<span className="adm-sr-only"> number {i + 1}</span>
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {canEdit && draft.phones.length < 4 ? (
            <div className="adm-actions">
              <button type="button" className="adm-btn" disabled={disabled} onClick={() => set("phones", [...draft.phones, { id: "", display: "", e164: "", hasWhatsapp: false, isVisible: true }])}>
                Add a phone number
              </button>
            </div>
          ) : null}
        </fieldset>
        {field("facebookUrl", "Facebook page (optional)", draft.facebookUrl, (v) => set("facebookUrl", v), { type: "url", dir: "ltr", hint: "An https address on facebook.com." })}
      </section>

      <section className="adm-card" aria-labelledby="settings-map-title">
        <div className="adm-card-head">
          <h2 id="settings-map-title">Address details and map</h2>
        </div>
        {field("postalCode", "Postal code (optional)", draft.postalCode, (v) => set("postalCode", v), { dir: "ltr" })}
        <p className="adm-hint">Country: {draft.countryCode} (fixed).</p>
        <div className="adm-site-pair">
          {field("geoLat", "Latitude (approximate, optional)", draft.geoLat, (v) => set("geoLat", v), { dir: "ltr" })}
          {field("geoLng", "Longitude (approximate, optional)", draft.geoLng, (v) => set("geoLng", v), { dir: "ltr" })}
        </div>
        <label className="adm-check">
          <input type="checkbox" checked={draft.geoIsApproximate} disabled={disabled} onChange={(e) => set("geoIsApproximate", e.target.checked)} />
          The coordinates are approximate (district level)
        </label>
        {field("mapsQuery", "Map search (the address Google Maps looks up)", draft.mapsQuery, (v) => set("mapsQuery", v), { dir: "ltr" })}
        {field("mapsPlaceUrl", "RAWASY's own Google Maps place link (optional)", draft.mapsPlaceUrl, (v) => set("mapsPlaceUrl", v), {
          type: "url",
          dir: "ltr",
          hint: "Pending RAWASY's confirmation: leave it empty until RAWASY confirms its own place link. Never enter a guessed link.",
        })}
      </section>

      <section className="adm-card" aria-labelledby="settings-seo-title">
        <div className="adm-card-head">
          <h2 id="settings-seo-title">Global SEO defaults</h2>
        </div>
        <p className="adm-hint">The site name and the default description are set per language below.</p>
        <MediaSlotField
          model={{ key: "defaultOgImage", label: "Default share image", kinds: ["image"], hint: "An approved public image from the media library. The public share images stay as they are until A9." }}
          value={draft.defaultOgImageMediaId}
          cards={cards}
          onChange={(id) => set("defaultOgImageMediaId", id)}
          onCard={(card) => setCards((c) => ({ ...c, [card.id]: card }))}
          canUpload={canUpload}
          disabled={disabled}
          error={issue("defaultOgImageMediaId")}
        />
      </section>

      {LOCALES.map((locale) => {
        const dir = locale.code === "ar" ? "rtl" : "ltr";
        return (
          <section key={locale.code} className="adm-card" aria-labelledby={`settings-${locale.code}-title`}>
            <div className="adm-card-head">
              <h2 id={`settings-${locale.code}-title`} lang={locale.code}>
                {locale.heading}
              </h2>
            </div>
            {TEXTS.slice(0, 4).map((t) => field(`texts.${locale.code}.${t.key}`, t.label, draft.texts[locale.code][t.key], (v) => setText(locale.code, t.key, v), { dir, lang: locale.code, long: t.long, hint: t.hint }))}
            {field(`texts.${locale.code}.addressLines`, "Address lines (one per line, at most 4)", draft.texts[locale.code].addressLines, (v) => setText(locale.code, "addressLines", v), {
              dir,
              lang: locale.code,
              long: true,
              hint: "As the footer and the contact page show them.",
            })}
            {TEXTS.slice(4, 8).map((t) => field(`texts.${locale.code}.${t.key}`, t.label, draft.texts[locale.code][t.key], (v) => setText(locale.code, t.key, v), { dir, lang: locale.code, long: t.long, hint: t.hint }))}
            {field(`texts.${locale.code}.visionStatement`, "Vision statement", draft.texts[locale.code].visionStatement, (v) => setText(locale.code, "visionStatement", v), { dir, lang: locale.code, long: true })}
            {field(`texts.${locale.code}.visionAims`, "Vision aims (one per line)", draft.texts[locale.code].visionAims, (v) => setText(locale.code, "visionAims", v), { dir, lang: locale.code, long: true })}
            {TEXTS.slice(9).map((t) => field(`texts.${locale.code}.${t.key}`, t.label, draft.texts[locale.code][t.key], (v) => setText(locale.code, t.key, v), { dir, lang: locale.code, long: t.long, hint: t.hint }))}
            <div className="adm-field">
              <label className="adm-check" htmlFor={`f-complete-${locale.code}`}>
                <input
                  type="checkbox"
                  id={`f-complete-${locale.code}`}
                  checked={draft.complete[locale.code]}
                  disabled={disabled}
                  aria-describedby={`f-complete-${locale.code}-hint`}
                  onChange={(e) => set("complete", { ...draft.complete, [locale.code]: e.target.checked })}
                />
                <span>{locale.code === "en" ? "English" : "Arabic"} is complete</span>
              </label>
              <p className="adm-hint" id={`f-complete-${locale.code}-hint`}>
                {model.needsReview[locale.code]
                  ? "Needs review: the other language changed after this one was confirmed. Check it, then tick this box and save."
                  : "Every field of this language is required; untick it to keep the language as a draft."}
              </p>
            </div>
          </section>
        );
      })}

      {canEdit ? (
        <div className="adm-card adm-editor-review">
          <label className="adm-check" htmlFor="f-otherUnaffected">
            <input type="checkbox" id="f-otherUnaffected" checked={otherUnaffected} disabled={disabled} onChange={(e) => setOtherUnaffected(e.target.checked)} />
            <span>This change does not affect the other language (for example, a typo fix)</span>
          </label>
          <p className="adm-hint">Otherwise, changing one language while the other is complete marks the other “Needs review”.</p>
        </div>
      ) : null}

      {canEdit ? (
        <div className="adm-savebar">
          <span className="adm-savebar-status" role="status">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>
          <div className="adm-actions">
            <button type="submit" className="adm-btn is-primary" disabled={pending} aria-disabled={pending}>
              {pending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
