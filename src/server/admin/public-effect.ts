/**
 * What the admin says about the public website (A9 acceptance review). One admin serves two kinds of release:
 *
 * - a static-content release (CONTENT_SOURCE=static, the default and the rollback) renders `src/content/*`: nothing
 *   saved or published in the admin reaches its visitors;
 * - a database-content release (CONTENT_SOURCE=database) renders the published versions: a publication, a rollback, an
 *   unpublication and every change of a delivered media item reach its pages at the next request.
 *
 * Every admin text that says which of the two is true lives here, in both forms. The static texts are the ones the
 * admin showed before this review, word for word (a static release renders exactly as before). The admin picks the set
 * by its build's content source (`src/app/(admin)/admin/_components/public-effect.ts`); client components receive the
 * text they need as a prop. Never write either claim on an admin screen elsewhere.
 *
 * Framework-free (no imports): the unit tests read it directly.
 */
export interface PublicEffectTexts {
  /** The publishing panel's "Public website" line. */
  panelPublic: string;
  /** The content editor's status card, "Public website". */
  statusPublic: string;
  /** The note on every content list and editor. */
  draftNote: string;
  /** The lead of a collection's order screen. */
  orderLead: string;
  /** The note of the layout builder. */
  layoutNote: string;
  /** The dashboard's media card. */
  dashMedia: string;
  /** The media library's lead. */
  mediaLead: string;
  /** The library upload's hint. */
  uploadHint: string;
  /** The publish dialog's sentence, before its audit clause and its full stop. */
  publishDialog: string;
  /** The reusable section editor's note, after "Used by …". */
  reusableNote: string;
  /** The note on every site-controls screen (settings, menus, interface text). */
  siteNote: string;
  /** The note on the forms and enquiries screens. */
  formNote: string;
  /** The form editor's "Delivery and protection" hint. */
  formEditorHint: string;
  /** The services menu's collection row. */
  menuServicesHint: string;
}

const STATIC: PublicEffectTexts = {
  panelPublic: "Unchanged: the public pages keep reading today's approved content until the content cutover (A9).",
  statusPublic: "Unchanged until the content cutover (A9): publishing fills the database's public read model only.",
  draftNote: "Working records: publishing fills the database's public read model; the public website keeps today's content until the content cutover (A9).",
  orderLead: "The order the public site uses once it is published (read from the content cutover, A9). Archived items keep their place and are stepped over.",
  layoutNote: "Working layout: the public website does not use it before the content cutover (A9); publishing makes it the live version in the database.",
  dashMedia: "The library only; today's public site keeps its own files until the cutover (A9).",
  mediaLead: "Uploads start as pending review. Nothing here changes the public website: today's site keeps its own files until the cutover (A9).",
  uploadHint:
    "JPEG, PNG, WebP, AVIF or PDF; at most 20 MB and 40 megapixels. The file's real type is checked, not its name. It starts as pending review: a version that uses it can be published only once an Owner or Admin approves it, and the public website reads published versions only from the content cutover (A9).",
  publishDialog: "This version becomes the live version in the database's public read model. The public website keeps showing today's approved pages until the content cutover (A9)",
  reusableNote:
    "Saving changes the working preview of every page and service that links it; its live version changes only when someone publishes it, and no visitor sees any of it before the content cutover (A9).",
  siteNote:
    "Working copy: the public website keeps today's settings, menus and text until the content cutover (A9); publishing makes each part's live version in the database. The admin preview shows the working copy.",
  formNote:
    "A working copy for the admin and its preview: the website's quote form stays today's handoff form — the visitor sends the prepared email or WhatsApp message — until the approved cutover.",
  formEditorHint:
    "The website's form stays today's handoff form whatever is chosen here: nothing reaches the website's visitors before the approved cutover. The delivery mode, stored attachments, the consent box and the retention period are the Owner's decisions.",
  menuServicesHint: "Each service with its own name and tagline, in the services' order (the six services of today's website until publishing, A8, and the switch, A9).",
};

const DATABASE: PublicEffectTexts = {
  panelPublic: "Live: the public pages show the live version; publishing, rolling back or unpublishing changes them at the next request.",
  statusPublic: "Live: the public pages show the published version, from the next request after each publication.",
  draftNote: "Working records: saving changes nothing public; publishing makes a version live on the public website at the next request.",
  orderLead: "The order the public site uses once it is published. Archived items keep their place and are stepped over.",
  layoutNote:
    "Working layout: publishing makes its texts live on the public website at the next request. Which sections a site page shows, and in what order, stay as approved: a section hidden, moved or added here shows in the preview only (a service page's optional sections follow their visibility).",
  dashMedia: "The public pages show approved, delivered items only; withdrawing one changes them at the next request.",
  mediaLead:
    "Uploads start as pending review. The public pages show approved items only: approving an item, or restricting, archiving or trashing one they show, changes them at the next request. Some photos are required by the approved design — on the homepage, the Projects, Industries and Certificates pages and the service pages: withdrawing one takes that page offline in both languages until it is delivered again. A photo that came with the website keeps its own file address until the next release leaves it out: ask the hosting operator to remove it sooner (the runbook's emergency step).",
  uploadHint:
    "JPEG, PNG, WebP, AVIF or PDF; at most 20 MB and 40 megapixels. The file's real type is checked, not its name. It starts as pending review: a version that uses it can be published only once an Owner or Admin approves it.",
  publishDialog: "This version becomes the live version: the public website shows it from the next request",
  reusableNote: "Saving changes the working preview of every page and service that links it; its live version changes only when someone publishes it.",
  siteNote: "Working copy: visitors see the published settings, menus and text; publishing a part makes its working copy live at the next request. The admin preview shows the working copy.",
  formNote:
    "A working copy for the admin and its preview: publishing makes its texts the ones visitors see. The website's quote form stays a handoff form — the visitor sends the prepared email or WhatsApp message; nothing is stored.",
  formEditorHint:
    "The website's form stays a handoff form whatever is chosen here: nothing is stored or sent; only its published texts reach visitors. The delivery mode, stored attachments, the consent box and the retention period are the Owner's decisions.",
  menuServicesHint: "Each published service with its own name and tagline, in the services' published order.",
};

/** The texts for a release whose public pages read the published versions (`true`: database content) or not. */
export function publicEffectTexts(readsPublished: boolean): PublicEffectTexts {
  return readsPublished ? DATABASE : STATIC;
}
