import type { CSSProperties } from "react";
import { getMedia } from "@/content/media";
import { getClients, getClientsPageContent } from "@/content/repository";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd } from "@/lib/inner-page";
import { planSpans } from "@/lib/logo-wall";
import { JsonLd } from "@/lib/seo";
import { Icon } from "../Icon";
import { ClosingCta } from "../inner/ClosingCta";
import { PageHero } from "../inner/PageHero";
import { Logo, delay } from "../ui";

/**
 * Clients in the Modern Commerce design (Stage TM-2.3): every logo from the company profile on one curated wall, in the
 * homepage's logo tiles with the client's name under each — greyscale at rest, their own colours on hover or with the
 * switch (the homepage's toggle).
 * Wide logos take double tiles, planned per breakpoint so every row is full (six across on desktop, four on tablets,
 * two on phones), in the profile's order. No numbering, counts, grid references, partnership claims or testimonials.
 */
export async function ClientsPage({ locale }: { locale: Locale }) {
  const [page, clients] = await Promise.all([getClientsPageContent(), getClients()]);
  const dict = getDictionary(locale);
  const logos = clients.map((c) => ({ slug: c.slug, name: c.name[locale], image: { ...getMedia(c.logo), alt: c.name[locale] } }));
  const ratios = logos.map((l) => l.image.width / l.image.height);
  const spans = { sm: planSpans(ratios, 2, 3), md: planSpans(ratios, 4, 7), lg: planSpans(ratios, 6, 9) };

  return (
    <>
      {innerPageJsonLd("clients", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <PageHero
        breadcrumb={breadcrumbTrail("clients", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        tone="teal"
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
      />

      <section aria-labelledby="clients-list-title" className="sec sec-sheet sec-raised">
        <div className="shell">
          <div className="cl-head">
            <h2 id="clients-list-title" className="eyebrow" data-tone="teal">
              {page.listLabel[locale]}
            </h2>
            <button type="button" className="a2-toggle cl-toggle" data-toggle="colour" aria-pressed="false" aria-controls="clients-wall" data-js-only>
              <span className="knob" aria-hidden />
              <Icon name="colour" size={16} className="text-teal" />
              {page.colours[locale]}
            </button>
          </div>
          <ul id="clients-wall" aria-labelledby="clients-list-title" className="cl-wall">
            {logos.map((logo, i) => (
              <li
                key={logo.slug}
                style={{ "--span-sm": spans.sm[i], "--span-md": spans.md[i], "--span-lg": spans.lg[i], ...delay((i % 6) * 40) } as CSSProperties}
                data-reveal="fade"
              >
                <div className="logo-tile cl-tile">
                  <span className="cl-logo">
                    <Logo image={logo.image} />
                  </span>
                  {/* The name, as the previous wall showed it under each logo (the image's alt text carries it for screen readers). */}
                  <span aria-hidden className="cl-name">
                    {logo.name}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="cl-note">{page.note[locale]}</p>
        </div>
      </section>

      {/* No numbered rows here: the clients page shows no numbering or counts at all. */}
      <ClosingCta
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        numbered={false}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
