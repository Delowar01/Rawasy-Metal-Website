import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMedia } from "@/content/media";
import { getClients, getClientsPageContent } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { ClientGrid } from "@/components/clients/ClientGrid";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";

export async function generateMetadata({ params }: PageProps<"/[locale]/clients">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("clients", locale);
}

/** Clients: the logos from the company profile, with a short factual introduction only. */
export default async function ClientsPage({ params }: PageProps<"/[locale]/clients">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, clients] = await Promise.all([getClientsPageContent(), getClients()]);
  const dict = getDictionary(locale);

  return (
    <>
      {innerPageJsonLd("clients", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <InnerPageHero
        layout="compact"
        backdrop="fine"
        breadcrumb={breadcrumbTrail("clients", locale)}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={page.hero.eyebrow[locale]}
        title={page.hero.title[locale]}
        intro={page.hero.intro[locale]}
      />

      <section aria-labelledby="clients-list-title" className="pb-[var(--section-y)]">
        <div className="container-x">
          <h2 id="clients-list-title" className="sr-only">
            {page.listLabel[locale]}
          </h2>
          <ClientGrid
            label={page.listLabel[locale]}
            clients={clients.map((client) => {
              const logo = getMedia(client.logo);
              const mono = getMedia(client.logoMono);
              return {
                slug: client.slug,
                name: client.name[locale],
                logo: { src: logo.src, width: logo.width, height: logo.height },
                mono: { src: mono.src, width: mono.width, height: mono.height },
              };
            })}
          />
          <p className="t-label mt-8 max-w-3xl text-ink-3" data-reveal="fade">
            {page.note[locale]}
          </p>
        </div>
      </section>

      <InnerCTA
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
