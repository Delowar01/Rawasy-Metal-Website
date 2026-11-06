import { QuoteSection } from "@/components/commerce/contact/ContactPage";
import { quoteFormText } from "@/components/commerce/contact/quote-text";
import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";
import { getContactContent, getServices } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/routes";
import { workingQuoteFormText } from "@/server/forms/copy";
import type { FormModel } from "@/server/forms/forms";
import { overlayShell, type WorkingSite } from "@/server/site/working";
import { PreviewLanguageLink } from "./PreviewLanguageLink";
import { siteViewOf, workingReach } from "./site";

/**
 * A form's preview (A7.1, `/admin/preview/form/<id>`): the approved quote section (`QuoteSection`, `QuoteForm`) inside
 * the site's working shell, its words from the form's working copy — the form's texts, each field's label, help and
 * messages, the project types' labels — and the prepared request addressed as the company settings' working copy says
 * (A6). The section's heading, steps and note are the Contact page's (its builder section holds them). Not set up:
 * today's form exactly. An admin-only note says what the approved component does not draw from the working copy.
 */
export async function FormPreview({ form, site, locale }: { form: FormModel; site: WorkingSite; locale: Locale }) {
  const [page, services] = await Promise.all([getContactContent(), getServices()]);
  const shell = overlayShell(await getShellView(locale, { route: null, path: null }), site, locale);
  const base = quoteFormText(locale, page, services);
  const text = form.setUp ? workingQuoteFormText(base, form.copy[locale], form.fields.map((f) => ({ key: f.key, texts: f.texts[locale], options: f.options }))) : base;
  const { form: content, methods } = page;
  return (
    <PageShell shell={shell} sameAddressLink={PreviewLanguageLink}>
      <div className="shell gb-failed" lang="en" dir="ltr">
        <div className="gb-missing">
          <span className="gb-note">
            Preview only — the quote form with this working copy&apos;s texts{form.setUp ? "" : " (not set up: today's form)"}. The approved component keeps today&apos;s field order and
            required marks{form.settings.consentMode === "checkbox" ? " and draws no consent box" : ""}; stored submissions are checked against the working rules. The website&apos;s form
            stays today&apos;s handoff form.
          </span>
        </div>
      </div>
      <QuoteSection
        head={{ label: content.label[locale], title: content.title[locale], intro: content.intro[locale], stepsLabel: methods.stepsLabel[locale], steps: content.steps[locale], status: content.status[locale] }}
        text={text}
        privacyHref={href(locale, "privacy")}
        reach={workingReach(siteViewOf(site, locale))}
      />
    </PageShell>
  );
}
