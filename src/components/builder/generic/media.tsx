import Image from "next/image";
import { Icon } from "@/components/commerce/Icon";
import { itemsOf, itemText, textOf } from "@/server/builder/view";
import { BlockImage, deliveredImage } from "../BlockImage";
import type { BlockProps } from "../context";
import { GenericSection, Head, motionProps, PreviewNote, readClass, textMotion, titleId } from "../frame";
import { Buttons, specOf } from "../parts";
import { RichText } from "../RichText";

/** One photo with an optional caption (cropped around its focal point when a shape is chosen). */
export function GenericImage({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const caption = textOf(content, "caption");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="image" labelled={false} label={caption || undefined}>
      {(view) => (
        <figure className="gb-figure">
          <BlockImage
            id={settings.media as string | null}
            ctx={ctx}
            alt={textOf(content, "alt")}
            decorative={settings.decorative === true}
            aspect={(settings.aspect as string | undefined) ?? "original"}
            sizes={view.attrs["data-width"] === "shell" ? "(min-width: 1400px) 1300px, 92vw" : "100vw"}
            frame={view.frame}
            motion={motionProps(view, 0, { text: false })}
          />
          {caption && <figcaption className={`gb-caption ${readClass(view)}`.trim()}>{caption}</figcaption>}
        </figure>
      )}
    </GenericSection>
  );
}

/** A title, text and buttons beside, above or below a photo (per screen size). */
export function GenericTextImage({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const caption = textOf(content, "caption");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="text_image">
      {(view) => (
        <div className="gb-split">
          <div className={`gb-split-text ${readClass(view)}`.trim()} {...textMotion(view)}>
            {textOf(content, "eyebrow") && <p className={view.surface === "dark" ? "eyebrow eyebrow-dark" : "eyebrow"}>{textOf(content, "eyebrow")}</p>}
            <h2 id={titleId(section)} className="t-h2 gb-title">
              {textOf(content, "title")}
            </h2>
            <RichText value={content?.body} ctx={ctx} className="gb-split-body" />
            <Buttons section={section} ctx={ctx} repeater="actions" view={view} />
          </div>
          <figure className="gb-split-media gb-figure">
            <BlockImage
              id={settings.media as string | null}
              ctx={ctx}
              alt={textOf(content, "alt")}
              decorative={settings.decorative === true}
              aspect={(settings.aspect as string | undefined) ?? "4x3"}
              sizes="(min-width: 1024px) 46vw, 92vw"
              frame={view.frame}
            />
            {caption && <figcaption className={`gb-caption ${readClass(view)}`.trim()}>{caption}</figcaption>}
          </figure>
        </div>
      )}
    </GenericSection>
  );
}

/** Photos in a grid, each with a caption. */
export function GenericGallery({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const aspect = (settings.aspect as string | undefined) ?? "4x3";
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="gallery" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid gb-gallery">
            {itemsOf<{ media?: string | null; decorative?: boolean }>(settings, "photos").map((item, i) => {
              const caption = itemText(content, "photos", item.id, "caption");
              return (
                <li key={item.id}>
                  <figure className="gb-figure">
                    <BlockImage
                      id={item.media}
                      ctx={ctx}
                      alt={itemText(content, "photos", item.id, "alt")}
                      decorative={item.decorative === true}
                      aspect={aspect}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
                      motion={motionProps(view, i, { text: false })}
                    />
                    {caption && <figcaption className={`gb-caption ${readClass(view)}`.trim()}>{caption}</figcaption>}
                  </figure>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </GenericSection>
  );
}

/** A YouTube (privacy-enhanced) or Vimeo player built from a typed id only — never an embed code. */
export function GenericVideo({ section }: BlockProps) {
  const { settings, content } = section;
  const id = String(settings.videoId ?? "");
  const vimeo = settings.provider === "vimeo";
  // The id was checked against its provider's pattern when it was saved (generic.ts); checked again here.
  const valid = vimeo ? /^[0-9]{6,12}$/.test(id) : /^[A-Za-z0-9_-]{11}$/.test(id);
  const src = vimeo ? `https://player.vimeo.com/video/${id}?dnt=1` : `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  const title = textOf(content, "title");
  const caption = textOf(content, "caption");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="video" labelled={false} label={title || undefined}>
      {(view) => (
        <figure className="gb-figure gb-video">
          <div className="gb-frame" data-aspect={(settings.aspect as string | undefined) ?? "16x9"} {...motionProps(view, 0, { text: false })}>
            {valid ? (
              <iframe
                src={src}
                title={title}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              />
            ) : (
              <div className="gb-missing">
                <PreviewNote>
                  Video not shown in the preview: <strong>{id ? "the id doesn't match its provider" : "no video id yet"}</strong>
                </PreviewNote>
              </div>
            )}
          </div>
          {caption && <figcaption className={`gb-caption ${readClass(view)}`.trim()}>{caption}</figcaption>}
        </figure>
      )}
    </GenericSection>
  );
}

/** A row of logos from the media library, each named by its alt text. */
export function GenericLogoStrip({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const label = textOf(content, "title");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="logo_strip" labelled={Boolean(label)}>
      {(view) => (
        <>
          {label && (
            <p id={titleId(section)} className={`gb-strip-label ${readClass(view)}`.trim()}>
              {label}
            </p>
          )}
          <ul className="gb-logos">
            {itemsOf<{ media?: string | null }>(settings, "logos").map((item, i) => {
              const image = deliveredImage(item.media, ctx);
              const name = itemText(content, "logos", item.id, "name");
              return (
                <li key={item.id} className="gb-logo" {...motionProps(view, i, { text: false })}>
                  {image ? (
                    <Image src={image.image.src} alt={name} width={image.image.width} height={image.image.height} sizes="160px" {...(image.image.unoptimized ? { unoptimized: true } : {})} />
                  ) : (
                    <PreviewNote>{item.media ? "Logo not available" : "No logo chosen"}</PreviewNote>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </GenericSection>
  );
}

/** Public PDF documents from the media library: a name, a short description and the file. */
export function GenericDownloads({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="downloads" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid gb-docs">
            {itemsOf<{ media?: string | null }>(settings, "files").map((item, i) => {
              const media = item.media ? ctx.media.get(item.media) : undefined;
              const label = itemText(content, "files", item.id, "label");
              const description = itemText(content, "files", item.id, "description");
              const body = (
                <>
                  <span className="icon-chip">
                    <Icon name="doc" size={20} />
                  </span>
                  <span className="gb-doc-text">
                    <span className="gb-doc-name">{label}</span>
                    {description && <span className="t-small">{description}</span>}
                  </span>
                </>
              );
              return (
                <li key={item.id} {...motionProps(view, i)}>
                  {media?.ok && media.kind === "document" ? (
                    <a href={media.image.src} className="card card-link gb-doc">
                      {body}
                      <span className="tag">PDF</span>
                      <Icon name="arrow" size={17} className="go" />
                    </a>
                  ) : (
                    <div className="card gb-doc">
                      {body}
                      <PreviewNote>Document not available: {!item.media ? "none chosen" : media && !media.ok ? media.reason : "not a public document"}</PreviewNote>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </GenericSection>
  );
}

/** A Google map of an address search (no place is invented), with the address and a link to open it in Google Maps. */
export function GenericMap({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const query = String(settings.query ?? "").trim();
  const place = String(settings.placeLink ?? "").trim();
  const title = textOf(content, "title");
  const address = textOf(content, "address");
  const external = ctx.site.dict.a11y.externalLink;
  const q = encodeURIComponent(query);
  const open = place || (query ? `https://www.google.com/maps/search/?api=1&query=${q}` : "");
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="map" labelled={false} label={title || undefined}>
      {(view) => (
        <div className="gb-map">
          {(address || (open && textOf(content, "linkLabel"))) && (
            <div className={`gb-map-text ${readClass(view)}`.trim()} {...textMotion(view)}>
              {address && (
                <p className="gb-map-address">
                  <Icon name="pin" size={18} />
                  <span>{address}</span>
                </p>
              )}
              {open && textOf(content, "linkLabel") && (
                <a href={open} target="_blank" rel="noopener noreferrer" className="link-arrow">
                  {textOf(content, "linkLabel")}
                  <span className="gb-sr"> ({external})</span>
                  <Icon name="arrow-up-right" size={15} />
                </a>
              )}
            </div>
          )}
          <div className="gb-frame gb-map-frame" data-aspect={(settings.aspect as string | undefined) ?? "16x9"} {...motionProps(view, 0, { text: false })}>
            {query ? (
              <iframe
                src={`https://www.google.com/maps?q=${q}&hl=${ctx.locale}&z=15&output=embed`}
                title={title}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              />
            ) : (
              <div className="gb-missing">
                <PreviewNote>
                  Map not shown in the preview: <strong>no address to search yet</strong>
                </PreviewNote>
              </div>
            )}
          </div>
        </div>
      )}
    </GenericSection>
  );
}
