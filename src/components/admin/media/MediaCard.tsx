/**
 * How a media item looks wherever the admin shows one (pickers, chosen slots, lists, the library): an admin-only
 * thumbnail or a document mark, the item's label, and its state written out — status, Trash, blocking flags, no file —
 * never colour alone (A4 brief §41, §53, §82). Plain markup: usable by server and client components alike.
 */
import { cardWarnings, STATUS_BADGE, STATUS_TEXT, type MediaCardModel } from "@/server/admin/actions/media-model";

export function MediaThumb({ card, size = "md" }: { card: MediaCardModel; size?: "sm" | "md" | "lg" }) {
  const cls = `adm-media-thumb is-${size}`;
  if (card.unavailable) {
    return (
      <span className={`${cls} is-empty`} aria-hidden="true">
        ?
      </span>
    );
  }
  if (card.thumb) {
    // Admin previews only (never a public address); decorative here: the card's text names the item.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={card.thumb} alt="" width={card.width ?? undefined} height={card.height ?? undefined} loading="lazy" decoding="async" />;
  }
  return (
    <span className={`${cls} is-doc`} aria-hidden="true">
      {card.kind === "document" ? "PDF" : card.visibility === "private" ? "Private" : card.blocking ? "Hidden" : "No preview"}
    </span>
  );
}

/** The item's state as text badges: its status always, then every warning. */
export function MediaBadges({ card }: { card: MediaCardModel }) {
  if (card.unavailable) return <span className="adm-badge is-danger">Not available</span>;
  return (
    <span className="adm-badges">
      {card.visibility === "private" ? <span className="adm-badge is-info">Private — never publishable</span> : null}
      <span className={`adm-badge ${STATUS_BADGE[card.status]}`.trim()}>{STATUS_TEXT[card.status]}</span>
      {card.trashed ? <span className="adm-badge is-danger">In the Trash</span> : null}
      {card.blocking ? <span className="adm-badge is-danger">Blocking flag</span> : null}
      {!card.ready ? <span className="adm-badge is-warning">No ready file</span> : null}
    </span>
  );
}

/** A compact card: thumbnail, label (Arabic title too), kind and size, badges. */
export function MediaSummary({ card, href }: { card: MediaCardModel; href?: string }) {
  const warnings = cardWarnings(card).filter((w) => w !== "Approved");
  return (
    <span className="adm-media-summary">
      <MediaThumb card={card} size="sm" />
      <span className="adm-media-summary-text">
        {href && !card.unavailable ? (
          <a href={href} target="_blank" rel="noopener">
            {card.label}
            <span className="adm-sr-only"> (opens the item in a new tab)</span>
          </a>
        ) : (
          <strong>{card.label}</strong>
        )}
        {card.labelAr ? (
          <span lang="ar" dir="rtl" className="adm-muted">
            {card.labelAr}
          </span>
        ) : null}
        {!card.unavailable ? (
          <span className="adm-hint">
            {card.kind === "document" ? "PDF document" : "Image"}
            {card.width && card.height ? ` · ${card.width} × ${card.height}` : ""}
          </span>
        ) : (
          <span className="adm-hint">Removed, or not visible to you. Choose another item.</span>
        )}
        <MediaBadges card={card} />
        {warnings.length && card.visibility === "public" && !card.unavailable ? (
          <span className="adm-hint adm-media-warning">Not public until approved and published; choosing it never approves it.</span>
        ) : null}
      </span>
    </span>
  );
}
