import type { getContactContent, getServices } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import type { QuoteFormText } from "./QuoteForm";

/**
 * The quotation form's words in one language, from the content layer: its fields, groups, service and project-type
 * choices, file rules, error and ready messages and the privacy line. The Contact page and the page builder's preview
 * (A5: the quote form as it works today) both read them here.
 */
export function quoteFormText(
  locale: Locale,
  page: Awaited<ReturnType<typeof getContactContent>>,
  services: Awaited<ReturnType<typeof getServices>>,
): QuoteFormText {
  const { form } = page;
  return {
    requiredNote: form.requiredNote[locale],
    groups: { details: form.groups.details[locale], project: form.groups.project[locale], message: form.groups.message[locale] },
    noscript: form.noscript[locale],
    fields: Object.fromEntries(
      Object.entries(form.fields).map(([name, field]) => [
        name,
        { label: field.label[locale], hint: field.hint?.[locale], placeholder: field.placeholder?.[locale] },
      ]),
    ) as QuoteFormText["fields"],
    services: [
      ...services.map((s) => ({ value: s.slug, label: s.name[locale] })),
      { value: "not-sure", label: form.serviceOther[locale] },
    ],
    projectTypes: form.projectTypes.map((t) => ({ value: t.value, label: t.label[locale] })),
    files: {
      accept: form.files.accept,
      maxFiles: form.files.maxFiles,
      maxSizeMb: form.files.maxSizeMb,
      choose: form.files.choose[locale],
      drop: form.files.drop[locale],
      remove: form.files.remove[locale],
      note: form.files.note[locale],
      units: { kb: form.files.units.kb[locale], mb: form.files.units.mb[locale] },
    },
    submit: form.submit[locale],
    errors: Object.fromEntries(Object.entries(form.errors).map(([k, v]) => [k, v[locale]])) as QuoteFormText["errors"],
    ready: Object.fromEntries(Object.entries(form.ready).map(([k, v]) => [k, v[locale]])) as QuoteFormText["ready"],
    privacy: { text: form.privacy.text[locale], link: form.privacy.link[locale] },
  };
}
