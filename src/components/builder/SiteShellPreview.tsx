import { getShellView } from "@/components/commerce/data";
import { PageShell } from "@/components/commerce/shell/PageShell";
import type { Locale } from "@/i18n/config";
import { overlayShell, type WorkingSite } from "@/server/site/working";
import { PreviewLanguageLink } from "./PreviewLanguageLink";

/**
 * The site's shell on its own (A6.6, `/admin/preview/site/shell`): the approved header and footer drawn from the site's
 * working copy — company details, navigation, interface text — with an admin-only note where a page's sections would be.
 * Nothing is marked as the current page; the language switch keeps this preview.
 */
export async function SiteShellPreview({ site, locale }: { site: WorkingSite; locale: Locale }) {
  const shell = overlayShell(await getShellView(locale, { route: null, path: null }), site, locale);
  return (
    <PageShell shell={shell} sameAddressLink={PreviewLanguageLink}>
      <div className="shell gb-failed" lang="en" dir="ltr">
        <div className="gb-missing">
          <span className="gb-note">
            Preview only — the header and footer as the site&apos;s working copy sets them (company details, navigation, interface text). A page&apos;s preview shows them around its sections.
          </span>
        </div>
      </div>
    </PageShell>
  );
}
