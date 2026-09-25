import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMedia } from "@/content/media";
import { getClients, getClientsPageContent } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { JsonLd } from "@/lib/seo";
import { ClientWall } from "@/components/clients/ClientWall";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { Backdrop } from "@/components/visual/Backdrop";

export async function generateMetadata({ params }: PageProps<"/[locale]/clients">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("clients", locale);
}

/** Clients: the logos from the company profile on one unnumbered wall, with a short factual introduction only. */
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

      <section aria-labelledby="clients-list-title" className="sec-eng section-y relative isolate overflow-hidden">
        <Backdrop kind="fine" className="[--bd-fade:linear-gradient(to_bottom,transparent_40%,var(--eng-surface))]" />
        <div className="container-x">
          <ClientWall
            label={page.listLabel[locale]}
            labelId="clients-list-title"
            coloursLabel={page.colours[locale]}
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
          <p className="t-caption mt-6 max-w-3xl text-ink-2" data-reveal="fade">
            {page.note[locale]}
          </p>
        </div>
      </section>

      {/* No numbered rows here: the clients page shows no numbering or counts at all. */}
      <InnerCTA
        label={page.cta.label[locale]}
        title={page.cta.title[locale]}
        numbered={false}
        links={page.cta.links.map((link) => ({ href: href(locale, link.route), label: link.label[locale] }))}
      />
    </>
  );
}
