import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projectCategories } from "@/content/projects";
import { getProjectsPageContent, getShowcasedProjects } from "@/content/repository";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { breadcrumbTrail, innerPageJsonLd, innerPageMetadata } from "@/lib/inner-page";
import { categoryTone, projectCard, refOrder } from "@/lib/project-cards";
import { JsonLd } from "@/lib/seo";
import { InnerCTA } from "@/components/inner/InnerCTA";
import { InnerPageHero } from "@/components/inner/InnerPageHero";
import { FeaturedProject } from "@/components/projects/FeaturedProject";
import { FilterChips, ProjectFilterProvider } from "@/components/projects/ProjectFilter";
import { ProjectGallery } from "@/components/projects/ProjectGallery";
import { ProjectHighlights } from "@/components/projects/ProjectHighlights";
import { ProjectIndex } from "@/components/projects/ProjectIndex";
import { ProjectsCollage, type CollageItem } from "@/components/projects/ProjectsCollage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Backdrop } from "@/components/visual/Backdrop";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return innerPageMetadata("projects", locale);
}

/**
 * Projects overview: image-led. A layered collage opens the page, one project
 * is featured large, a few are highlighted in editorial pairs, then the full
 * gallery is a filterable masonry wall. A text index closes the page as
 * secondary navigation. Project detail pages follow in Stage 1F.
 */
export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [page, showcased] = await Promise.all([getProjectsPageContent(), getShowcasedProjects()]);
  const dict = getDictionary(locale);

  const cards = showcased.map((p) => projectCard(p, locale));
  const bySlug = (slug: string) => cards.find((c) => c.slug === slug);
  const featured = bySlug(page.featured.slug) ?? cards[0];
  const highlights = page.editorial.slugs.map(bySlug).filter((c) => c !== undefined);
  const indexed = [...cards].sort((a, b) => refOrder(a.ref) - refOrder(b.ref));
  // Filter chips: every classification with at least one showcased project, in content order.
  const options = projectCategories
    .filter((c) => c.slug !== "industrial" && cards.some((p) => p.categories.some((pc) => pc.slug === c.slug)))
    .map((c) => ({ slug: c.slug, label: c.label[locale], tone: categoryTone[c.slug] }));
  const refLabel = page.refLabel[locale];
  const collage = ["tulip-roundabout-sculpture", "clock-tower-landmark", "suspended-lantern"].map((slug) => {
    const card = bySlug(slug)!;
    return { image: card.gallery[0], alt: card.title, ref: card.ref };
  }) as [CollageItem, CollageItem, CollageItem];

  return (
    <>
      {innerPageJsonLd("projects", locale, "CollectionPage").map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}

      <ProjectFilterProvider>
        <InnerPageHero
          backdrop="grid"
          breadcrumb={breadcrumbTrail("projects", locale)}
          breadcrumbLabel={dict.a11y.breadcrumb}
          eyebrow={page.hero.eyebrow[locale]}
          title={page.hero.title[locale]}
          intro={page.hero.intro[locale]}
          actions={
            <div className="js-only w-full">
              <p aria-hidden className="t-label text-ink-2">
                {page.hero.quickFilter[locale]}
              </p>
              <FilterChips
                options={options}
                allLabel={page.gallery.all[locale]}
                label={page.hero.quickFilter[locale]}
                scrollTo="gallery"
                size="sm"
                className="mt-3 flex-wrap gap-1.5"
              />
            </div>
          }
          aside={<ProjectsCollage items={collage} refLabel={refLabel} />}
          meta={page.hero.meta.map((m) => ({ label: m.label[locale], value: m.value[locale] }))}
        />

        {featured && (
          <FeaturedProject
            project={featured}
            label={page.featured.label[locale]}
            refLabel={refLabel}
            viewLabel={page.view[locale]}
            alt={featured.title}
          />
        )}

        <section aria-labelledby="highlights-title" className="sec-eng section-y relative isolate overflow-hidden">
          <Backdrop
            kind="fine"
            className="[--bd-fade:linear-gradient(to_bottom,transparent_30%,var(--eng-surface))]"
          />
          <div className="container-x">
            <SectionHeader
              id="highlights-title"
              index="01"
              label={page.editorial.label[locale]}
              title={page.editorial.title[locale]}
              intro={page.editorial.intro[locale]}
            />
            <div className="mt-14 lg:mt-20">
              <ProjectHighlights projects={highlights} refLabel={refLabel} viewLabel={page.view[locale]} />
            </div>
          </div>
        </section>

        <section id="gallery" aria-labelledby="gallery-title" className="section-y">
          <div className="container-x">
            <SectionHeader
              id="gallery-title"
              index="02"
              label={page.gallery.label[locale]}
              title={page.gallery.title[locale]}
              intro={page.gallery.intro[locale]}
            />
            <div className="mt-10 lg:mt-14">
              <ProjectGallery
                projects={cards}
                options={options}
                labels={{
                  filter: page.gallery.filterLabel[locale],
                  all: page.gallery.all[locale],
                  showing: page.gallery.showing[locale],
                  ref: refLabel,
                  view: page.view[locale],
                }}
              />
            </div>
          </div>
        </section>
      </ProjectFilterProvider>

      <section aria-labelledby="index-title" className="sec-deep section-y">
        <div className="container-x">
          <SectionHeader
            id="index-title"
            size="compact"
            index="03"
            label={page.index.label[locale]}
            title={page.index.title[locale]}
            intro={page.index.note[locale]}
          />
          <div className="mt-10 lg:mt-14">
            <ProjectIndex projects={indexed} label={page.index.label[locale]} />
          </div>
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
