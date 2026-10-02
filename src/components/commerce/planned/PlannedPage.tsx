import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { Icon } from "../Icon";
import type { Crumb } from "../inner/Breadcrumbs";
import { PendingNote } from "../inner/Document";
import { PageHero } from "../inner/PageHero";
import "./planned.css";

/**
 * A page that is routed and localized (noindex) but designed in a later build stage: Capabilities (1E) and the project
 * pages (1F), in the Modern Commerce design since Stage TM-2.6. It shows only what the content layer holds for it — the
 * title, the description and the stage it belongs to — and the ways on, with the placeholder's own words. No photos,
 * figures or sections the stage has not approved: the project pages show no project photos, since some held-back
 * projects still carry authorship, render or watermark questions.
 */
export function PlannedPage({
  locale,
  title,
  description,
  stage,
  breadcrumb,
}: {
  locale: Locale;
  title: string;
  description: string;
  stage: string;
  breadcrumb: Crumb[];
}) {
  const dict = getDictionary(locale);
  const { placeholder } = dict;
  return (
    <>
      <PageHero
        breadcrumb={breadcrumb}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={`${placeholder.badge} · ${stage}`}
        title={title}
        intro={description}
        actions={
          <>
            <a href={href(locale, "home")} className="btn btn-secondary">
              {/* Back: the arrow points against the reading direction. */}
              <span className="inline-flex -scale-x-100">
                <Icon name="arrow" size={17} />
              </span>
              {placeholder.back}
            </a>
            <a href={href(locale, "contact")} className="btn btn-primary">
              {placeholder.contact}
              <Icon name="arrow" size={17} />
            </a>
          </>
        }
      />
      <div className="sec pt-0">
        <div className="shell">
          <div className="max-w-[50rem]">
            <PendingNote label={placeholder.badge}>
              {placeholder.body} <span dir="ltr">{stage}</span>.
            </PendingNote>
          </div>
        </div>
      </div>
    </>
  );
}
