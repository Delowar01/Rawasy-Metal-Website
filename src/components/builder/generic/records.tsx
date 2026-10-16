import Image from "next/image";
import { Icon } from "@/components/commerce/Icon";
import { getIndustriesPageContent } from "@/content/repository";
import type { SelectionValue } from "@/server/builder/fields";
import { resolveSelection, textOf } from "@/server/builder/view";
import { BlockImage, deliveredImage } from "../BlockImage";
import type { BlockProps } from "../context";
import { GenericSection, Head, motionProps, PreviewNote } from "../frame";
import { iconName, RecordText, specOf } from "../parts";

/*
 * The record grids (A5 brief §16, §51–§53): cards built from the A3 working records a selection names — by hand (its
 * order kept) or automatically (the collection's order, featured only or one category). Archived and missing records are
 * left out (the notes say so); a text a record lacks in this language shows as an admin-only note; a restricted project
 * never shows its photos; only delivered media are drawn (never a private item).
 */

const selectionOf = (section: BlockProps["section"], key: string) => section.settings[key] as SelectionValue | undefined;

/** Service cards: the service's icon, name and tagline, opening its page. */
export function GenericServicesGrid({ section, ctx }: BlockProps) {
  const { content } = section;
  const { items } = resolveSelection("service", selectionOf(section, "services"), ctx.records);
  const action = textOf(content, "cardAction");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="services_grid" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid">
            {items.map((service, i) => (
              <li key={service.id} {...motionProps(view, i)}>
                <div className="card card-link card-edge gb-record">
                  <span className="icon-chip">
                    <Icon name={iconName(service.icon, "fabrication")} size={20} />
                  </span>
                  <h3 className="t-h4">
                    <a href={ctx.hrefOf(ctx.locale, "service", { slug: service.slug })} className="stretch">
                      <RecordText value={service.name} ctx={ctx} what="name" />
                    </a>
                  </h3>
                  {service.tagline[ctx.locale] && <p className="t-small">{service.tagline[ctx.locale]}</p>}
                  {action && (
                    <span className="gb-go">
                      {action}
                      <Icon name="arrow" size={16} className="go" />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!items.length && <PreviewNote block>No services to show yet.</PreviewNote>}
        </>
      )}
    </GenericSection>
  );
}

/** Project cards: the first delivered photo (never for a restricted project), the title and its categories. */
export function GenericProjectsGrid({ section, ctx }: BlockProps) {
  const { content } = section;
  const { items } = resolveSelection("project", selectionOf(section, "projects"), ctx.records);
  const action = textOf(content, "cardAction");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="projects_grid" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid">
            {items.map((project, i) => {
              const photo = project.restrictions.length ? null : (project.media.find((id) => deliveredImage(id, ctx)) ?? null);
              const categories = project.categories.map((id) => ctx.records.categories.find((c) => c.id === id)?.label[ctx.locale]).filter((label): label is string => Boolean(label));
              return (
                <li key={project.id} {...motionProps(view, i)}>
                  <div className="card card-link card-edge gb-record gb-record-media">
                    {photo ? (
                      <div className="card-media gb-record-photo">
                        <BlockImage id={photo} ctx={ctx} alt="" decorative aspect="4x3" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw" />
                      </div>
                    ) : (
                      <div className="gb-record-photo gb-missing">
                        <PreviewNote>{project.restrictions.length ? `Photos withheld (${project.restrictions.join(", ")})` : "No deliverable photo"}</PreviewNote>
                      </div>
                    )}
                    <div className="gb-record-body">
                      <h3 className="t-h4">
                        <a href={ctx.hrefOf(ctx.locale, "project", { slug: project.slug })} className="stretch">
                          <RecordText value={project.title} ctx={ctx} what="title" />
                        </a>
                      </h3>
                      {categories.length > 0 && (
                        <ul className="gb-tags">
                          {categories.slice(0, 2).map((label) => (
                            <li key={label} className="tag">
                              {label}
                            </li>
                          ))}
                        </ul>
                      )}
                      {action && (
                        <span className="gb-go">
                          {action}
                          <Icon name="arrow" size={16} className="go" />
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!items.length && <PreviewNote block>No projects to show yet.</PreviewNote>}
        </>
      )}
    </GenericSection>
  );
}

/** Machine cards: the machine's photo on its stage, name, type and its stated power only. */
export function GenericMachineGrid({ section, ctx }: BlockProps) {
  const { content } = section;
  const { items } = resolveSelection("machine", selectionOf(section, "machines"), ctx.records);
  const action = textOf(content, "cardAction");
  const unit = ctx.locale === "ar" ? "واط" : "W";
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="machine_grid" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid">
            {items.map((machine, i) => {
              const photo = deliveredImage(machine.media, ctx);
              return (
                <li key={machine.id} {...motionProps(view, i)}>
                  <div className="card card-link card-edge gb-record gb-record-media">
                    <div className="gb-machine-stage">
                      {photo ? (
                        <Image
                          src={photo.image.src}
                          alt=""
                          width={photo.image.width}
                          height={photo.image.height}
                          sizes="(min-width: 1024px) 26vw, 80vw"
                          style={{ maxWidth: photo.image.width }}
                          {...(photo.image.unoptimized ? { unoptimized: true } : {})}
                        />
                      ) : (
                        <PreviewNote>{machine.media ? "Photo not available" : "No photo"}</PreviewNote>
                      )}
                    </div>
                    <div className="gb-record-body">
                      {machine.category[ctx.locale] && <p className="gb-kicker">{machine.category[ctx.locale]}</p>}
                      <h3 className="t-h4">
                        <a href={ctx.hrefOf(ctx.locale, "capabilities", { hash: machine.slug })} className="stretch">
                          <RecordText value={machine.name} ctx={ctx} what="name" />
                        </a>
                      </h3>
                      {machine.powerWatts !== null && (
                        <p className="gb-power">
                          <Icon name="power" size={16} />
                          <span dir="ltr">{machine.powerWatts.toLocaleString("en-US")}</span> {unit}
                        </p>
                      )}
                      {action && (
                        <span className="gb-go">
                          {action}
                          <Icon name="arrow" size={16} className="go" />
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!items.length && <PreviewNote block>No machines to show yet.</PreviewNote>}
        </>
      )}
    </GenericSection>
  );
}

/** Client logos on light tiles, named by the client's name (no counts, numbering or claims). */
export function GenericClientLogos({ section, ctx }: BlockProps) {
  const { content } = section;
  const { items } = resolveSelection("client", selectionOf(section, "clients"), ctx.records);
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="client_logos" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid gb-client-logos">
            {items.map((client, i) => {
              const logo = deliveredImage(client.logo, ctx);
              const name = client.name[ctx.locale] ?? client.name.en ?? client.slug;
              return (
                <li key={client.id} className="gb-logo" {...motionProps(view, i, { text: false })}>
                  {logo ? (
                    <Image src={logo.image.src} alt={name} width={logo.image.width} height={logo.image.height} sizes="160px" {...(logo.image.unoptimized ? { unoptimized: true } : {})} />
                  ) : (
                    <PreviewNote>{client.logo ? "Logo not available" : "No logo"}</PreviewNote>
                  )}
                </li>
              );
            })}
          </ul>
          {!items.length && <PreviewNote block>No clients to show yet.</PreviewNote>}
        </>
      )}
    </GenericSection>
  );
}

/** Certificate cards: the redacted preview's thumbnail, the title and the issuer (never a number or a private original). */
export function GenericCertificates({ section, ctx }: BlockProps) {
  const { content } = section;
  const { items } = resolveSelection("certificate", selectionOf(section, "certificates"), ctx.records);
  const action = textOf(content, "cardAction");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="certificates" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid">
            {items.map((certificate, i) => {
              const thumb = deliveredImage(certificate.thumb, ctx);
              return (
                <li key={certificate.id} {...motionProps(view, i)}>
                  <div className="card card-link card-edge gb-record gb-record-media">
                    <div className="gb-doc-plate">
                      {thumb ? (
                        <Image
                          src={thumb.image.src}
                          alt=""
                          width={thumb.image.width}
                          height={thumb.image.height}
                          sizes="(min-width: 1024px) 22vw, 60vw"
                          style={{ maxWidth: thumb.image.width }}
                          {...(thumb.image.unoptimized ? { unoptimized: true } : {})}
                        />
                      ) : (
                        <PreviewNote>{certificate.thumb ? "Preview not available" : "No preview"}</PreviewNote>
                      )}
                    </div>
                    <div className="gb-record-body">
                      <h3 className="t-h4">
                        <a href={ctx.hrefOf(ctx.locale, "certificates", { hash: certificate.slug })} className="stretch">
                          <RecordText value={certificate.title} ctx={ctx} what="title" />
                        </a>
                      </h3>
                      {certificate.issuer[ctx.locale] && <p className="t-small">{certificate.issuer[ctx.locale]}</p>}
                      {action && (
                        <span className="gb-go">
                          {action}
                          <Icon name="arrow" size={16} className="go" />
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!items.length && <PreviewNote block>No certificates to show yet.</PreviewNote>}
        </>
      )}
    </GenericSection>
  );
}

/** Industry cards with each one's classification: a company-profile sector or a website classification. */
export async function GenericIndustries({ section, ctx }: BlockProps) {
  const { content } = section;
  const { items } = resolveSelection("industry", selectionOf(section, "industries"), ctx.records);
  const page = await getIndustriesPageContent();
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="industries" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid">
            {items.map((industry, i) => (
              <li key={industry.id} {...motionProps(view, i)}>
                <div className="card gb-record">
                  <p className="gb-kicker">{industry.classification === "profile_sector" ? page.basis.profile[ctx.locale] : page.basis.inferred[ctx.locale]}</p>
                  <h3 className="t-h4">
                    <RecordText value={industry.name} ctx={ctx} what="name" />
                  </h3>
                  {industry.description[ctx.locale] && <p className="t-small">{industry.description[ctx.locale]}</p>}
                </div>
              </li>
            ))}
          </ul>
          {!items.length && <PreviewNote block>No industries to show yet.</PreviewNote>}
        </>
      )}
    </GenericSection>
  );
}
