import { Icon } from "@/components/commerce/Icon";
import { PageHero } from "@/components/commerce/inner/PageHero";
import { getDictionary } from "@/i18n/dictionaries";
import { href } from "@/i18n/routes";
import { designView, itemsOf, itemText, itemValue, textOf, toneAttr } from "@/server/builder/view";
import { BlockImage } from "../BlockImage";
import type { BlockProps } from "../context";
import { designOf, GenericSection, Head, motionProps, readClass, textMotion, titleId } from "../frame";
import { buttonElements, Buttons, iconName, pad, specOf } from "../parts";
import { RichText } from "../RichText";

/** The page's opening (generic pages): the inner-page kit's `PageHero` — trail, label, the page's only h1, lead, buttons — with its photo beside or under the text. */
export function GenericHero({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  const view = designView(specOf(section.blockType), designOf(section));
  const layout = (settings.layout as "compact" | "split" | "stacked" | undefined) ?? "compact";
  const dict = getDictionary(ctx.locale);
  const title = textOf(content, "title");
  const actions = buttonElements(section, ctx, "actions", view);
  const photo =
    layout === "compact" ? null : (
      <figure className="gb-hero-figure">
        <BlockImage
          id={settings.media as string | null}
          ctx={ctx}
          alt={textOf(content, "alt")}
          decorative={settings.decorative === true}
          sizes={layout === "split" ? "(min-width: 1024px) 40vw, 92vw" : "(min-width: 1400px) 1400px, 92vw"}
          priority
        />
        {textOf(content, "caption") && <figcaption className="ip-figure-caption a2-read">{textOf(content, "caption")}</figcaption>}
      </figure>
    );
  return (
    <div data-section={section.id} className="gb-hero">
      <PageHero
        layout={layout}
        breadcrumb={[
          { href: href(ctx.locale, "home"), label: dict.common.home },
          { href: `/${ctx.locale}${ctx.path}`, label: title || ctx.label },
        ]}
        breadcrumbLabel={dict.a11y.breadcrumb}
        eyebrow={textOf(content, "eyebrow")}
        tone={toneAttr(designOf(section).tone) ?? "brand"}
        title={title}
        intro={textOf(content, "lead") || undefined}
        actions={actions.length ? <>{actions}</> : undefined}
        aside={layout === "split" ? photo : undefined}
        below={layout === "stacked" ? photo : undefined}
      />
    </div>
  );
}

/** A section heading: label, title at the chosen level, introduction. */
export function GenericHeading({ section }: BlockProps) {
  const { content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="heading" labelled={Boolean(textOf(content, "title"))}>
      {(view) => <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />}
    </GenericSection>
  );
}

/** Formatted text with an optional label and title. */
export function GenericRichText({ section, ctx }: BlockProps) {
  const { content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="rich_text" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <div className="gb-measure">
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} />
          <div className={`gb-body ${readClass(view)}`.trim()} {...textMotion(view)}>
            <RichText value={content?.body} ctx={ctx} />
          </div>
        </div>
      )}
    </GenericSection>
  );
}

/** A short prompt with one to three buttons, on the dark panel or a sheet. */
export function GenericCta({ section, ctx }: BlockProps) {
  const { content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="cta">
      {(view) => (
        <div className="gb-cta" {...textMotion(view)}>
          <div className="gb-cta-text">
            {textOf(content, "eyebrow") && <p className={view.surface === "dark" ? "eyebrow eyebrow-dark" : "eyebrow"}>{textOf(content, "eyebrow")}</p>}
            <h2 id={titleId(section)} className="t-h2 gb-title">
              {textOf(content, "title")}
            </h2>
            {textOf(content, "body") && <p className="t-lead gb-intro">{textOf(content, "body")}</p>}
          </div>
          <Buttons section={section} ctx={ctx} repeater="actions" view={view} />
        </div>
      )}
    </GenericSection>
  );
}

/** Questions that open to their answers (native disclosure: keyboard and screen readers as the browser provides). */
export function GenericFaq({ section, ctx }: BlockProps) {
  const { settings, content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="faq" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <div className="gb-measure">
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <div className="gb-faq">
            {itemsOf(settings, "questions").map((item, i) => (
              <details key={item.id} className="gb-faq-item" {...motionProps(view, i)}>
                <summary>
                  <h3 className="t-h4">{itemText(content, "questions", item.id, "question")}</h3>
                  <Icon name="chevron" size={18} className="gb-faq-chev" />
                </summary>
                <div className="gb-faq-answer">
                  <RichText value={itemValue(content, "questions", item.id, "answer")} ctx={ctx} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </GenericSection>
  );
}

/** Figures with labels; each figure's source stays admin-only and is never drawn. */
export function GenericStatistics({ section }: BlockProps) {
  const { settings, content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="statistics" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <dl className="gb-grid gb-stats">
            {itemsOf<{ value?: string }>(settings, "figures").map((item, i) => (
              <div key={item.id} className="card gb-stat" {...motionProps(view, i)}>
                <dt>{itemText(content, "figures", item.id, "label")}</dt>
                <dd>
                  <span className="t-stat gb-stat-value" dir="ltr">
                    {item.value}
                  </span>
                  {itemText(content, "figures", item.id, "unit") && <span className="gb-stat-unit">{itemText(content, "figures", item.id, "unit")}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </GenericSection>
  );
}

/** Cards with an icon, a title and a short text. */
export function GenericFeatureCards({ section }: BlockProps) {
  const { settings, content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="feature_cards" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ul className="gb-grid">
            {itemsOf<{ icon?: string }>(settings, "cards").map((item, i) => (
              <li key={item.id} {...motionProps(view, i)}>
                <div className="gb-card" {...view.frame}>
                  <span className="icon-chip">
                    <Icon name={iconName(item.icon)} size={20} />
                  </span>
                  <h3 className="t-h4">{itemText(content, "cards", item.id, "title")}</h3>
                  {itemText(content, "cards", item.id, "body") && <p className="t-small">{itemText(content, "cards", item.id, "body")}</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </GenericSection>
  );
}

/** Dated or phased steps in order, on a line. */
export function GenericTimeline({ section }: BlockProps) {
  const { settings, content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="timeline" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <div className="gb-measure">
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ol className="gb-timeline">
            {itemsOf(settings, "steps").map((item, i) => (
              <li key={item.id} {...motionProps(view, i)}>
                <span className="gb-timeline-dot" aria-hidden />
                {itemText(content, "steps", item.id, "marker") && <p className="gb-timeline-marker">{itemText(content, "steps", item.id, "marker")}</p>}
                <h3 className="t-h4">{itemText(content, "steps", item.id, "title")}</h3>
                {itemText(content, "steps", item.id, "body") && <p className="t-small">{itemText(content, "steps", item.id, "body")}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </GenericSection>
  );
}

/** Numbered steps with icons, and a note under them. */
export function GenericProcess({ section }: BlockProps) {
  const { settings, content } = section;
  return (
    <GenericSection section={section} spec={specOf(section.blockType)} name="process" labelled={Boolean(textOf(content, "title"))}>
      {(view) => (
        <>
          <Head section={section} view={view} eyebrow={textOf(content, "eyebrow")} title={textOf(content, "title")} intro={textOf(content, "intro")} />
          <ol className="gb-grid gb-steps">
            {itemsOf<{ icon?: string }>(settings, "steps").map((item, i) => (
              <li key={item.id} className="card gb-step" {...motionProps(view, i)}>
                <span className="gb-step-top">
                  <span className="icon-chip">
                    <Icon name={iconName(item.icon, "doc")} size={20} />
                  </span>
                  <span className="gb-step-n" aria-hidden>
                    {pad(i + 1)}
                  </span>
                </span>
                <h3 className="t-h4">{itemText(content, "steps", item.id, "title")}</h3>
                {itemText(content, "steps", item.id, "body") && <p className="t-small">{itemText(content, "steps", item.id, "body")}</p>}
              </li>
            ))}
          </ol>
          {textOf(content, "note") && <p className={`gb-footnote ${readClass(view)}`.trim()}>{textOf(content, "note")}</p>}
        </>
      )}
    </GenericSection>
  );
}

/** One to four buttons in a row. */
export function GenericButtonGroup({ section, ctx }: BlockProps) {
  const view = designView(specOf(section.blockType), designOf(section));
  return (
    <div id={section.anchor ?? undefined} data-section={section.id} data-gb="button_group" className="gb gb-row" {...view.attrs}>
      <div className="shell gb-in" {...textMotion(view)}>
        <Buttons section={section} ctx={ctx} repeater="buttons" view={view} />
      </div>
    </div>
  );
}

/** A rule between sections: full, a short accent line or dotted. */
export function GenericDivider({ section }: BlockProps) {
  const view = designView(specOf(section.blockType), designOf(section));
  return (
    <div data-section={section.id} data-gb="divider" className="gb gb-row" {...view.attrs}>
      <div className="shell gb-in">
        <hr className="gb-rule" data-style={(section.settings.style as string | undefined) ?? "line"} {...motionProps(view, 0, { text: false })} />
      </div>
    </div>
  );
}

/** Vertical space from the spacing scale. */
export function GenericSpacer({ section }: BlockProps) {
  const view = designView(specOf(section.blockType), designOf(section));
  return <div data-section={section.id} data-gb="spacer" className="gb gb-space" aria-hidden {...view.attrs} />;
}
