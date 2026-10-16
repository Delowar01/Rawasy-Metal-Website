import { AboutHeroAside } from "@/components/commerce/about/AboutPage";
import { CapabilitiesActions, capabilityFacts } from "@/components/commerce/capabilities/CapabilitiesPage";
import { FleetPlate } from "@/components/commerce/capabilities/FleetPlate";
import { CertificateDocuments, CertificateTable, RedactionNote } from "@/components/commerce/certificates/CertificatesPage";
import { ClientsWall } from "@/components/commerce/clients/ClientsPage";
import { ContactActions, contactRows, DirectContact, QuoteSection } from "@/components/commerce/contact/ContactPage";
import { Location } from "@/components/commerce/contact/Location";
import { quoteFormText } from "@/components/commerce/contact/quote-text";
import { IndustryStrip, SectorsSection } from "@/components/commerce/industries/IndustriesPage";
import { ClosingCta } from "@/components/commerce/inner/ClosingCta";
import { PendingNote } from "@/components/commerce/inner/Document";
import { NotFoundPanel } from "@/components/commerce/inner/NotFound";
import { PageHero } from "@/components/commerce/inner/PageHero";
import { LegalBand, LegalContact, legalDate } from "@/components/commerce/legal/LegalPage";
import { QuickFilter } from "@/components/commerce/projects/Gallery";
import { Collage } from "@/components/commerce/projects/ProjectsPage";
import { ServicesIndex, ServiceTiles } from "@/components/commerce/services/ServicesPage";
import type { ServiceRowView } from "@/components/commerce/services/ServiceRow";
import { industryIcon, industryTone, serviceTone } from "@/components/commerce/tones";
import type { CommerceImage, Tone } from "@/components/commerce/types";
import { serviceIcon } from "@/components/commerce/ui";
import { getCompany, getContactContent, getServices } from "@/content/repository";
import type { ServiceSlug } from "@/content/types";
import { getDictionary } from "@/i18n/dictionaries";
import { breadcrumbTrail, type InnerRoute } from "@/lib/inner-page";
import { formatPower } from "@/lib/utils";
import type { Content, SelectionValue } from "@/server/builder/fields";
import type { LinkTarget } from "@/server/builder/links";
import type { Loc, PreviewService } from "@/server/builder/preview-data";
import { itemsOf, itemText, linesOf, resolveLink, resolveSelection, textOf } from "@/server/builder/view";
import { blockSection, type Placed } from "../compose";
import type { BlockProps, BlockSection, RenderContext } from "../context";
import { PreviewNote } from "../frame";
import { InvalidSection } from "../Placeholder";
import { RichText } from "../RichText";
import { machineFacts, machineNotes, machinesOf } from "./capabilities";
import { commerceImage, imageProblem, placeholderImage } from "./images";
import { filterOptionsOf, projectNotes, projectView, showcasedProjects } from "./projects";

/*
 * The inner pages' blocks (A5 brief §11, §41): the kit's page opening in each page's own composition, the closing call
 * to action, the services index, the clients wall, the certificate register and redaction note, the sectors with their
 * classification note, the quote section and the location, and the legal text in its band — the approved components of
 * `src/components/commerce/*`, drawn from the sections' data and the working records. The company's contact details
 * (phones, email, WhatsApp, address) stay the website's current ones until Site settings (A6); the quotation form is
 * today's handoff form, unchanged (A7).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const LANGUAGE = { en: "English", ar: "Arabic" } as const;
const label = (value: Loc<string>, slug: string) => value.en ?? value.ar ?? slug;

/** The inner page an owner is (its breadcrumb trail and its own route). */
const ROUTE: Record<string, InnerRoute> = {
  "system:about": "about",
  "system:services": "services",
  "system:capabilities": "capabilities",
  "system:projects": "projects",
  "system:industries": "industries",
  "system:clients": "clients",
  "system:certificates": "certificates",
  "system:contact": "contact",
  "legal:privacy": "privacy",
  "legal:terms": "terms",
};

/** A picture without its alt text (the components that take a bare picture). */
const picture = (image: CommerceImage) => ({
  src: image.src,
  width: image.width,
  height: image.height,
  blurDataURL: image.blurDataURL,
  ...(image.unoptimized ? { unoptimized: true as const } : {}),
});

/** A service's number: its place among the services in the collection's order (as today's "01" … "06"). */
function serviceIndex(service: PreviewService, ctx: RenderContext): string {
  const live = ctx.records.services.filter((s) => !s.archived || s.id === service.id);
  return pad(live.findIndex((s) => s.id === service.id) + 1);
}

// --- The page opening -------------------------------------------------------------------------------------------------

function factsOf(section: BlockSection) {
  return itemsOf(section.settings, "facts")
    .map((item) => ({ label: itemText(section.content, "facts", item.id, "label"), value: itemText(section.content, "facts", item.id, "value") }))
    .filter((fact) => fact.label || fact.value);
}

async function PageOpening({ section, ctx }: BlockProps) {
  const route = ctx.ownerKind ? ROUTE[ctx.ownerKind] : undefined;
  if (!route) return <InvalidSection id={section.id} label="Page opening" problem="this opening belongs to one of the site's own pages." />;
  const { locale } = ctx;
  const dict = getDictionary(locale);
  const c = section.content;
  const base = { breadcrumb: breadcrumbTrail(route, locale), breadcrumbLabel: dict.a11y.breadcrumb, eyebrow: textOf(c, "eyebrow"), title: textOf(c, "title"), intro: textOf(c, "intro") || undefined };
  switch (section.settings.variant) {
    case "clients":
      return <PageHero {...base} tone="teal" />;

    case "certificates": {
      const { items } = resolveSelection("certificate", section.settings.certificates as SelectionValue | undefined, ctx.records);
      return (
        <PageHero
          layout="stacked"
          {...base}
          tone="brass"
          below={
            <CertificateTable
              caption={textOf(c, "registerLabel")}
              columns={{ number: textOf(c, "colNumber"), document: textOf(c, "colDocument"), issuer: textOf(c, "colIssuer"), reference: textOf(c, "colReference") }}
              reference={textOf(c, "reference")}
              rows={items.map((cert) => ({ slug: cert.slug, title: cert.title[locale] ?? "", issuer: cert.issuer[locale] ?? "" }))}
            />
          }
        />
      );
    }

    case "industries": {
      const { items } = resolveSelection("industry", section.settings.strip as SelectionValue | undefined, ctx.records);
      const live = ctx.records.industries.filter((i) => !i.archived);
      return (
        <PageHero
          layout="stacked"
          {...base}
          tone="teal"
          facts={factsOf(section)}
          below={
            <IndustryStrip
              items={items.map((industry) => ({
                slug: industry.slug,
                index: pad(live.findIndex((i) => i.id === industry.id) + 1),
                name: industry.name[locale] ?? "",
                tone: (industryTone[industry.slug] ?? "steel") as Tone,
                image: commerceImage(industry.media, ctx, ""),
              }))}
            />
          }
        />
      );
    }

    case "contact": {
      const contact = ctx.hrefOf(locale, "contact");
      const rows = contactRows(
        contact,
        {
          phone: textOf(c, "phoneLabel"),
          call: textOf(c, "call"),
          whatsapp: textOf(c, "whatsappLabel"),
          chat: textOf(c, "chat"),
          email: textOf(c, "emailLabel"),
          send: textOf(c, "send"),
          address: textOf(c, "addressLabel"),
          viewMap: textOf(c, "viewMap"),
        },
        locale,
      );
      return (
        <PageHero
          layout="split"
          {...base}
          actions={<ContactActions contact={contact} quote={textOf(c, "quote")} findUs={textOf(c, "findUs")} />}
          aside={<DirectContact title={textOf(c, "methodsLabel")} rows={rows} externalLabel={dict.a11y.externalLink} />}
        />
      );
    }

    case "legal": {
      const date = ctx.page?.effectiveDate;
      return (
        <PageHero
          {...base}
          tone="steel"
          facts={[
            { label: textOf(c, "updatedLabel"), value: date ? <time dateTime={date}>{legalDate(date, locale)}</time> : <PreviewNote>No effective date on the page record yet</PreviewNote> },
            { label: textOf(c, "appliesTo"), value: textOf(c, "appliesToValue") },
          ]}
        />
      );
    }

    case "services": {
      const { items } = resolveSelection("service", section.settings.services as SelectionValue | undefined, ctx.records);
      return (
        <PageHero
          layout="split"
          {...base}
          facts={factsOf(section)}
          aside={
            <ServiceTiles
              label={textOf(c, "plateLabel")}
              tiles={items.map((s) => ({
                slug: s.slug,
                index: serviceIndex(s, ctx),
                name: s.name[locale] ?? "",
                tone: serviceTone[s.slug as ServiceSlug] ?? "steel",
                icon: serviceIcon[s.slug as ServiceSlug],
              }))}
            />
          }
        />
      );
    }

    case "about": {
      // The registered names are the company's current ones (read-only until Site settings, A6).
      const company = await getCompany();
      return (
        <PageHero
          layout="split"
          {...base}
          tone="steel"
          facts={factsOf(section)}
          aside={
            <AboutHeroAside
              image={commerceImage(section.settings.media as string | undefined, ctx, textOf(c, "photoAlt"))}
              caption={textOf(c, "caption")}
              nameplate={textOf(c, "nameplate")}
              legalName={{ en: company.legalName.en, ar: company.legalName.ar }}
            />
          }
        />
      );
    }

    case "capabilities": {
      const unit = textOf(c, "powerUnit");
      const machines = machinesOf(section, ctx, { unit });
      return (
        <PageHero
          layout="split"
          tone="steel"
          {...base}
          facts={capabilityFacts(machineFacts(machines, unit), { machines: textOf(c, "factMachines"), laser: textOf(c, "factLaser"), peak: textOf(c, "factPeak") })}
          actions={<CapabilitiesActions explore={textOf(c, "explore")} quote={ctx.hrefOf(locale, "contact", { hash: "quote" })} quoteLabel={textOf(c, "quote")} />}
          aside={<FleetPlate machines={machines} label={textOf(c, "fleet")} />}
        />
      );
    }

    case "projects": {
      const shown = showcasedProjects(ctx).map((p) => projectView(p, ctx));
      const { items: prints } = resolveSelection("project", section.settings.prints as SelectionValue | undefined, ctx.records);
      return (
        <PageHero
          layout="split"
          {...base}
          tone="brass"
          facts={factsOf(section)}
          actions={<QuickFilter label={textOf(c, "quickFilter")} options={filterOptionsOf(shown, ctx)} allLabel={textOf(c, "allLabel")} />}
          aside={<Collage items={prints.slice(0, 3).map((p) => projectView(p, ctx))} refLabel={textOf(c, "refLabel")} />}
        />
      );
    }

    default:
      return <PageHero layout="split" {...base} facts={factsOf(section)} />;
  }
}

// --- The 404 ---------------------------------------------------------------------------------------------------------------

function NotFoundBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return (
    <NotFoundPanel
      text={{ code: textOf(c, "code"), note: textOf(c, "note"), title: textOf(c, "title"), body: textOf(c, "body"), home: textOf(c, "home"), contact: textOf(c, "contact") }}
      homeHref={ctx.hrefOf(ctx.locale, "home")}
      contactHref={ctx.hrefOf(ctx.locale, "contact")}
    />
  );
}

// --- The closing call to action --------------------------------------------------------------------------------------

function ClosingBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const links = itemsOf<{ target?: LinkTarget | null }>(section.settings, "links").flatMap((item) => {
    const link = resolveLink(item.target ?? null, ctx.locale, ctx.records, ctx.hrefOf);
    const text = itemText(c, "links", item.id, "label");
    if (!link || !text) return [];
    return [{ href: link.href, label: text, description: itemText(c, "links", item.id, "description") || undefined }];
  });
  return <ClosingCta label={textOf(c, "label")} title={textOf(c, "title")} body={textOf(c, "body") || undefined} numbered={section.settings.numbered !== false} links={links} />;
}

// --- Services overview -----------------------------------------------------------------------------------------------------

function serviceRow(record: PreviewService, ctx: RenderContext): ServiceRowView {
  const { locale } = ctx;
  const engraving = record.slug === "laser-engraving";
  return {
    slug: record.slug as ServiceSlug,
    index: serviceIndex(record, ctx),
    name: record.name[locale] ?? "",
    tagline: record.tagline[locale] ?? "",
    summary: record.summary[locale] ?? "",
    highlights: record.highlights[locale] ?? [],
    equipment: ctx.records.machines
      .filter((m) => !m.archived && m.service === record.id)
      .map((m) => {
        const short = m.shortName[locale] ?? m.name[locale] ?? "";
        return m.powerWatts ? `${short} · ${formatPower(m.powerWatts, locale)}` : short;
      }),
    href: ctx.hrefOf(locale, "service", { slug: record.slug }),
    tone: serviceTone[record.slug as ServiceSlug] ?? "steel",
    // Laser Engraving shows its signature, never photographs (decision D6), as today.
    photos: engraving
      ? undefined
      : {
          cover: commerceImage(record.cover, ctx, record.coverAlt[locale] ?? ""),
          supporting: commerceImage(record.supporting, ctx, record.supportingAlt[locale] ?? ""),
        },
  };
}

function ServicesIndexBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const { items } = resolveSelection("service", section.settings.services as SelectionValue | undefined, ctx.records);
  return (
    <ServicesIndex
      label={textOf(c, "indexLabel")}
      labels={{ includes: textOf(c, "includesLabel"), equipment: textOf(c, "equipmentLabel"), open: textOf(c, "open") }}
      rows={items.map((record) => serviceRow(record, ctx))}
    />
  );
}

// --- Clients -------------------------------------------------------------------------------------------------------------------

/** The chosen clients whose logo may be shown (the others are left out, each with a note). */
export function clientLogos(section: BlockSection, ctx: RenderContext, notes: string[]) {
  const { items } = resolveSelection("client", section.settings.clients as SelectionValue | undefined, ctx.records);
  return items.flatMap((record) => {
    const problem = imageProblem(record.logo, ctx);
    if (problem) {
      notes.push(`The client “${label(record.name, record.slug)}” is left out: its logo cannot be shown (${problem === "No photo chosen yet" ? "No logo yet" : problem}).`);
      return [];
    }
    const name = record.name[ctx.locale] ?? "";
    if (!name) notes.push(`The client “${label(record.name, record.slug)}” has no ${LANGUAGE[ctx.locale]} name yet.`);
    return [{ slug: record.slug, name, image: commerceImage(record.logo, ctx, name) }];
  });
}

function ClientsWallBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return <ClientsWall listLabel={textOf(c, "label")} colours={textOf(c, "colours")} note={textOf(c, "note")} logos={clientLogos(section, ctx, [])} />;
}

// --- Certificates ----------------------------------------------------------------------------------------------------------------

/** A certificate's redacted previews as the register shows them (images only; the preview's language first). */
function certificatePreviews(record: { previews: { media: string; locale: "en" | "ar" | null }[] }, section: BlockSection, ctx: RenderContext) {
  const c = section.content;
  const shown = record.previews.filter((p) => {
    const item = ctx.media.get(p.media);
    return item?.ok && item.kind !== "document";
  });
  const labelled = (p: { locale: "en" | "ar" | null }) => (shown.length > 1 ? (p.locale === "ar" ? textOf(c, "arabic") : p.locale === "en" ? textOf(c, "english") : undefined) : undefined);
  const ordered = [...shown].sort((a, b) => Number(b.locale === ctx.locale) - Number(a.locale === ctx.locale));
  if (!ordered.length) {
    const first = record.previews[0];
    return [{ ...picture(placeholderImage(first ? (imageProblem(first.media, ctx) ?? "Not an image") : "No preview yet")) }];
  }
  return ordered.map((p) => ({ ...picture(commerceImage(p.media, ctx, "")), label: labelled(p) || undefined }));
}

function CertificatesRegisterBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  const { locale } = ctx;
  const dict = getDictionary(locale);
  const { items } = resolveSelection("certificate", section.settings.certificates as SelectionValue | undefined, ctx.records);
  const reference = { label: textOf(c, "referenceLabel"), value: textOf(c, "reference") };
  return (
    <CertificateDocuments
      label={textOf(c, "label")}
      labels={{ view: textOf(c, "view"), close: dict.a11y.close, preview: textOf(c, "preview"), note: textOf(c, "dialogNote") }}
      documents={items.map((cert) => ({
        slug: cert.slug,
        title: cert.title[locale] ?? "",
        issuer: cert.issuer[locale] ?? "",
        facts: [...cert.facts.map((f) => ({ label: f.label[locale] ?? "", value: f.value[locale] ?? "" })).filter((f) => f.label || f.value), ...(reference.label || reference.value ? [reference] : [])],
        previews: certificatePreviews(cert, section, ctx),
      }))}
    />
  );
}

function RedactionBlock({ section }: BlockProps) {
  const c = section.content;
  return <RedactionNote label={textOf(c, "label")} title={textOf(c, "title")} points={linesOf(c, "points")} />;
}

// --- Industries: the sectors and their classification note share one section ------------------------------------------------

function sectorList(section: BlockSection, ctx: RenderContext) {
  const c = section.content;
  const { locale } = ctx;
  const { items } = resolveSelection("industry", section.settings.industries as SelectionValue | undefined, ctx.records);
  return {
    label: textOf(c, "label"),
    basis: { profile: textOf(c, "profile"), inferred: textOf(c, "inferred") },
    related: textOf(c, "related"),
    items: items.map((industry, i) => ({
      slug: industry.slug,
      index: pad(i + 1),
      name: industry.name[locale] ?? "",
      description: industry.description[locale] ?? "",
      basis: industry.classification === "profile_sector" ? ("profile" as const) : ("inferred" as const),
      icon: industryIcon[industry.slug] ?? "factory",
      tone: (industryTone[industry.slug] ?? "steel") as Tone,
      services: industry.services
        .map((id) => ctx.records.services.find((s) => s.id === id))
        .filter((s) => s !== undefined && !s.archived)
        .map((s) => ({ href: ctx.hrefOf(locale, "service", { slug: s!.slug }), label: s!.name[locale] ?? "" })),
      image: picture(commerceImage(industry.feature ?? industry.media, ctx, "")),
    })),
  };
}

const sectorNote = (section: BlockSection) => ({ label: textOf(section.content, "label"), title: textOf(section.content, "title"), paragraphs: linesOf(section.content, "paragraphs") });

function SectorsGroup({ items, ctx }: { items: Placed[]; ctx: RenderContext }) {
  const sectors = items.find((i) => i.section.blockType === "industries.sectors");
  const note = items.find((i) => i.section.blockType === "industries.index");
  return (
    <SectorsSection
      list={sectors ? sectorList(blockSection(sectors.section, sectors.ordinal), ctx) : undefined}
      note={note ? sectorNote(blockSection(note.section, note.ordinal)) : undefined}
    />
  );
}

// --- Contact -----------------------------------------------------------------------------------------------------------------------

async function QuoteBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  // The form is today's handoff form, word for word (A7 boundary): its own texts are the website's.
  const [page, services] = await Promise.all([getContactContent(), getServices()]);
  return (
    <QuoteSection
      head={{ label: textOf(c, "label"), title: textOf(c, "title"), intro: textOf(c, "intro"), stepsLabel: textOf(c, "stepsLabel"), steps: linesOf(c, "steps"), status: textOf(c, "status") }}
      text={quoteFormText(ctx.locale, page, services)}
      privacyHref={ctx.hrefOf(ctx.locale, "privacy")}
    />
  );
}

function LocationBlock({ section, ctx }: BlockProps) {
  const c = section.content;
  return (
    <Location
      locale={ctx.locale}
      text={{
        label: textOf(c, "label"),
        title: textOf(c, "title"),
        intro: textOf(c, "intro"),
        address: textOf(c, "addressLabel"),
        name: textOf(c, "nameLabel"),
        contact: textOf(c, "contactLabel"),
        mapTitle: textOf(c, "mapTitle"),
        mapCaption: textOf(c, "mapCaption"),
        directions: textOf(c, "directions"),
        openMap: textOf(c, "openMap"),
        call: textOf(c, "call"),
        callLabel: textOf(c, "phoneLabel"),
        send: textOf(c, "send"),
        emailLabel: textOf(c, "emailLabel"),
        external: getDictionary(ctx.locale).a11y.externalLink,
      }}
    />
  );
}

// --- Legal: the contents and the sections share one band ---------------------------------------------------------------------

/** The band of the legal contents (its labels) and the legal sections that follow it. */
function LegalBandBlocks({ contents, items, ctx }: { contents: Content | null; items: BlockSection[]; ctx: RenderContext }) {
  const labels = { email: textOf(contents, "email"), phone: textOf(contents, "phone"), address: textOf(contents, "address") };
  const pendingLabel = textOf(contents, "pending");
  const sections = items.map((s) => {
      const pending = textOf(s.content, "pendingNote");
      return {
        id: s.anchor ?? `gb-${s.id}`,
        title: textOf(s.content, "title"),
        body: (
          <>
            <RichText value={s.content?.body} ctx={ctx} prose="ip-prose" />
            {s.settings.contact === true && <LegalContact contact={ctx.shell.contact} labels={labels} />}
            {pending && <PendingNote label={pendingLabel}>{pending}</PendingNote>}
          </>
        ),
      };
    });
  return <LegalBand contents={textOf(contents, "onThisPage")} sections={sections} />;
}

function LegalGroup({ items, ctx }: { items: Placed[]; ctx: RenderContext }) {
  const contents = items.find((i) => i.section.blockType === "legal.contents")?.section.content ?? null;
  const sections = items.filter((i) => i.section.blockType === "legal.section").map((i) => blockSection(i.section, i.ordinal));
  return <LegalBandBlocks contents={contents} items={sections} ctx={ctx} />;
}

// --- Registries ------------------------------------------------------------------------------------------------------------------

export const PAGE_RENDERERS = {
  "page.hero": PageOpening,
  "page.closing_cta": ClosingBlock,
  "services.index": ServicesIndexBlock,
  "clients.wall": ClientsWallBlock,
  "certificates.register": CertificatesRegisterBlock,
  "certificates.redaction": RedactionBlock,
  "industries.sectors": ({ section, ctx }: BlockProps) => <SectorsSection list={sectorList(section, ctx)} />,
  "industries.index": ({ section }: BlockProps) => <SectorsSection note={sectorNote(section)} />,
  "contact.quote": QuoteBlock,
  "contact.location": LocationBlock,
  "legal.contents": ({ section, ctx }: BlockProps) => <LegalBandBlocks contents={section.content} items={[]} ctx={ctx} />,
  "legal.section": ({ section, ctx }: BlockProps) => <LegalBandBlocks contents={null} items={[section]} ctx={ctx} />,
  "not_found.view": NotFoundBlock,
} as const;

export const PAGE_GROUPS = {
  sectors: SectorsGroup,
  "legal-band": LegalGroup,
} as const;

/** Anchorless blocks the bridge finds by the approved markup. */
export const PAGE_SELECTORS = {
  "legal.contents": ".ip-band .ip-toc",
  "industries.index": "#sectors .in-note",
  "services.index": ".sv-index",
  "certificates.register": ".ct-docs",
} as const;

export const PAGE_NOTES = {
  "clients.wall": ({ section, ctx }: BlockProps) => {
    const notes: string[] = [];
    clientLogos(section, ctx, notes);
    return notes;
  },
  "certificates.register": ({ section, ctx }: BlockProps) => {
    const { items } = resolveSelection("certificate", section.settings.certificates as SelectionValue | undefined, ctx.records);
    return items.flatMap((cert) => {
      const shown = cert.previews.filter((p) => !imageProblem(p.media, ctx));
      return shown.length === cert.previews.length && shown.length ? [] : [`The certificate “${label(cert.title, cert.slug)}”: ${shown.length ? "some previews are" : "its preview is"} not shown (${cert.previews.length ? cert.previews.map((p) => imageProblem(p.media, ctx)).filter(Boolean).join("; ") || "Not an image" : "No preview yet"}).`];
    });
  },
  "services.index": ({ section, ctx }: BlockProps) => {
    const { items } = resolveSelection("service", section.settings.services as SelectionValue | undefined, ctx.records);
    return items.flatMap((s) => {
      const notes: string[] = [];
      if (!(s.slug in serviceIcon)) notes.push(`The service “${label(s.name, s.slug)}” has no icon or colour of its own here: they follow the six services the site was built with.`);
      if (s.slug !== "laser-engraving") {
        for (const [what, id] of [["cover", s.cover], ["supporting photo", s.supporting]] as const) {
          const problem = imageProblem(id, ctx);
          if (problem) notes.push(`The service “${label(s.name, s.slug)}”: its ${what} is shown as a placeholder (${problem}).`);
        }
      }
      return notes;
    });
  },
  "page.hero": ({ section, ctx }: BlockProps) => {
    if (section.settings.variant === "legal" && !ctx.page?.effectiveDate) return ["The page record has no effective date yet."];
    if (section.settings.variant === "capabilities") return machineNotes(section, ctx, false);
    if (section.settings.variant === "projects") {
      const { items } = resolveSelection("project", section.settings.prints as SelectionValue | undefined, ctx.records);
      return projectNotes(items, ctx);
    }
    if (section.settings.variant === "industries") {
      const { items } = resolveSelection("industry", section.settings.strip as SelectionValue | undefined, ctx.records);
      return items.flatMap((i) => (imageProblem(i.media, ctx) ? [`The sector “${label(i.name, i.slug)}”: its strip photo is shown as a placeholder (${imageProblem(i.media, ctx)}).`] : []));
    }
    return [];
  },
} as const;
