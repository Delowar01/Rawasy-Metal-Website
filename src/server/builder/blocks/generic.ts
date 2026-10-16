/**
 * The generic blocks (A1-CONTENT-MODEL §5.4; A5 brief §12): building blocks in the Modern Commerce design for owner-
 * created pages and, where a page's registry entry allows it, for adding to the site's own pages. Each renders with the
 * approved typography, spacing, surfaces, buttons and focus treatment (`src/components/builder/blocks/*`), and offers
 * only the inspector controls listed in its `design` field. Naming: A1's list as `generic.<name>` (A1 "call to action" →
 * `generic.cta`, "reusable (global) block" → `generic.reusable`).
 */
import { FIXED, FREE, type BlockDefinition } from "../block.ts";
import type { DesignValues } from "../design.ts";
import type { FieldIssue, Settings } from "../fields.ts";
import { EMAIL_RE, PHONE_RE } from "../links.ts";
import { ASPECTS, automatic, BUTTON_STYLES, choice, design, flag, head, iconChoice, items, link, media, rich, selection, text, textarea, value } from "./kit.ts";


const SECTION_SURFACES = ["plain", "muted", "raised", "dark"] as const;
const LIGHT_SURFACES = ["plain", "muted", "raised"] as const;
const reveal = (delay: 0 | 60 | 120 = 0): DesignValues["motion"] => ({ preset: "reveal", duration: "3", delay });

const base = {
  version: 1,
  owners: ["generic"],
  locked: false,
  anchor: "editable",
  reusable: true,
  storable: true,
  upcasters: {},
  structure: FREE,
} as const satisfies Partial<BlockDefinition>;

/** Buttons: a label per language, a structured target and an approved style (A5 brief §50). */
const buttons = (min: number, max: number, initial = min) =>
  items(
    "Buttons",
    "button",
    { min, max, initial },
    { target: link("Opens", undefined, { required: true }), style: choice("Style", BUTTON_STYLES, "primary") },
    { label: text("Button text", 60, { required: true }) },
  );

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;
/** Hosts a Google Maps place link may use (A1-CONTENT-MODEL §10: a validated place link, once RAWASY supplies it). */
const MAP_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);

export function mapPlaceLinkProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Paste the full Google Maps link (https://…).";
  }
  if (url.protocol !== "https:" || url.username || url.password || !MAP_HOSTS.has(url.hostname)) return "Use a Google Maps link (google.com/maps or maps.app.goo.gl).";
  if (url.hostname !== "maps.app.goo.gl" && !url.pathname.startsWith("/maps")) return "Use a Google Maps link (google.com/maps or maps.app.goo.gl).";
  if (value.length > 400 || /[\s\\\u0000-\u001F\u007F]/.test(value)) return "Paste the link as Google Maps gives it, without spaces.";
  return null;
}

const GENERIC: BlockDefinition[] = [
  {
    ...base,
    key: "generic.hero",
    label: "Page opening",
    description: "The page's title (its only main heading), label, lead text, optional photo and buttons — the approved inner-page opening.",
    category: "layout",
    icon: "hero",
    max: 1,
    locked: true,
    h1: true,
    anchor: "none",
    reusable: false,
    structure: FIXED,
    settings: {
      layout: choice(
        "Layout",
        [
          { value: "compact", label: "Text only" },
          { value: "split", label: "Text beside a photo" },
          { value: "stacked", label: "Text above a photo" },
        ],
        "compact",
      ),
      media: media("Photo"),
      decorative: flag("The photo is decorative (no alt text)", false),
      actions: buttons(0, 2),
      design: design({ tone: true }, { tone: "orange-accent" }),
    },
    content: {
      eyebrow: text("Label", 80, { required: true }),
      title: text("Title (the page's main heading)", 200, { required: true }),
      lead: textarea("Lead", 600),
      alt: text("Photo alt text", 300),
      caption: text("Photo caption", 300),
    },
    note: "Every page has exactly one main heading: this block provides it, first on the page.",
  },
  {
    ...base,
    key: "generic.heading",
    label: "Heading",
    description: "A section heading with an optional label and introduction.",
    category: "layout",
    icon: "heading",
    max: 20,
    settings: {
      design: design({ heading: [2, 3, 4], align: true, measure: true, tone: true, padding: true, responsive: true, motion: { target: "text" } }, { heading: 2, align: "start", measure: "normal", tone: "orange-accent", padding: "sm", motion: reveal() }),
    },
    content: head(true),
  },
  {
    ...base,
    key: "generic.rich_text",
    label: "Text",
    description: "Formatted text: paragraphs, headings (levels 3–4), lists, bold, italic, links and language marks.",
    category: "text",
    icon: "text",
    max: 30,
    settings: {
      design: design(
        { measure: true, align: true, surfaces: SECTION_SURFACES, padding: true, responsive: true, motion: { target: "text" } },
        { measure: "normal", align: "start", surface: "plain", padding: "md", motion: reveal() },
      ),
    },
    content: { eyebrow: text("Label", 80), title: text("Title", 200), body: rich("Text", {}, { required: true }) },
  },
  {
    ...base,
    key: "generic.image",
    label: "Image",
    description: "One photo with an optional caption, cropped around the photo's focal point when a shape is chosen.",
    category: "media",
    icon: "image",
    max: 30,
    settings: {
      media: media("Photo"),
      decorative: flag("Decorative (no alt text)", false),
      aspect: choice("Shape", ASPECTS, "original"),
      design: design({ width: true, radius: true, shadow: true, padding: true, motion: { target: "media" } }, { width: "shell", radius: "card", shadow: "none", padding: "md", motion: reveal() }),
    },
    content: { alt: text("Alt text", 300), caption: text("Caption", 300) },
  },
  {
    ...base,
    key: "generic.text_image",
    label: "Text and image",
    description: "A title, text and buttons beside or around a photo.",
    category: "media",
    icon: "text-image",
    max: 20,
    settings: {
      media: media("Photo"),
      decorative: flag("Decorative (no alt text)", false),
      aspect: choice("Photo shape", ASPECTS, "4x3"),
      actions: buttons(0, 2),
      design: design(
        {
          mediaPosition: ["start", "end", "top", "bottom"],
          surfaces: SECTION_SURFACES,
          tone: true,
          padding: true,
          radius: true,
          shadow: true,
          responsive: true,
          motion: { target: "text" },
        },
        { mediaPosition: "end", surface: "plain", tone: "steel", padding: "md", radius: "card", shadow: "none", responsive: { mobile: { mediaPosition: "top" } }, motion: reveal() },
      ),
    },
    content: { eyebrow: text("Label", 80), title: text("Title", 200, { required: true }), body: rich("Text", { maxChars: 4000, maxNodes: 160 }), alt: text("Photo alt text", 300), caption: text("Photo caption", 300) },
  },
  {
    ...base,
    key: "generic.gallery",
    label: "Gallery",
    description: "Photos in a grid, each with a caption; every photo keeps its own proportions or the chosen shape.",
    category: "media",
    icon: "gallery",
    max: 10,
    settings: {
      photos: items("Photos", "photo", { min: 1, max: 24, initial: 1 }, { media: media("Photo"), decorative: flag("Decorative", false) }, { caption: text("Caption", 300), alt: text("Alt text", 300) }),
      aspect: choice("Shape", ASPECTS, "4x3"),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, padding: true, responsive: true, motion: { target: "media", list: true } },
        { columns: 3, gap: "md", surface: "plain", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.video",
    label: "Video",
    description: "A YouTube (privacy-enhanced) or Vimeo video by its id — never an embed code.",
    category: "media",
    icon: "video",
    max: 6,
    settings: {
      provider: choice(
        "Provider",
        [
          { value: "youtube", label: "YouTube (youtube-nocookie.com)" },
          { value: "vimeo", label: "Vimeo" },
        ],
        "youtube",
      ),
      videoId: value("Video id", 20, { ltr: true, technical: true, hint: "YouTube: the 11 characters after v= ; Vimeo: the number at the end of the address." }),
      aspect: choice(
        "Shape",
        [
          { value: "16x9", label: "Wide (16:9)" },
          { value: "4x3", label: "Standard (4:3)" },
        ],
        "16x9",
      ),
      design: design({ width: true, padding: true, motion: { target: "media" } }, { width: "shell", padding: "md", motion: reveal() }),
    },
    content: { title: text("Video title (announced to screen readers)", 160, { required: true }), caption: text("Caption", 300) },
    check: (settings: Settings): FieldIssue[] => {
      const id = String(settings.videoId ?? "");
      if (!id) return [];
      const ok = settings.provider === "vimeo" ? VIMEO_ID.test(id) : YOUTUBE_ID.test(id);
      return ok ? [] : [{ path: "settings.videoId", message: settings.provider === "vimeo" ? "A Vimeo id is 6 to 12 digits." : "A YouTube id is 11 letters, digits, - or _." }];
    },
  },
  {
    ...base,
    key: "generic.services_grid",
    label: "Services grid",
    description: "Service cards from the CMS: all services in order, or a hand-picked list.",
    category: "records",
    icon: "grid",
    max: 4,
    settings: {
      services: selection("Services", "service", 12, automatic("all", 6)),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 3, gap: "md", surface: "muted", tone: "steel", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: { ...head(false), cardAction: text("Card link text", 60) },
  },
  {
    ...base,
    key: "generic.projects_grid",
    label: "Projects grid",
    description: "Project cards: featured projects, a category, all projects or a hand-picked list. Withheld projects never show a photo.",
    category: "records",
    icon: "grid",
    max: 4,
    settings: {
      projects: selection("Projects", "project", 24, automatic("featured", 6)),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 3, gap: "md", surface: "plain", tone: "brass", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: { ...head(false), cardAction: text("Card link text", 60) },
  },
  {
    ...base,
    key: "generic.machine_grid",
    label: "Machine grid",
    description: "Machine cards from the CMS with their stated power only (never invented specifications).",
    category: "records",
    icon: "machine",
    max: 4,
    settings: {
      machines: selection("Machines", "machine", 12, automatic("all", 6)),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 3, gap: "md", surface: "raised", tone: "steel", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: { ...head(false), cardAction: text("Card link text", 60) },
  },
  {
    ...base,
    key: "generic.client_logos",
    label: "Client logos",
    description: "Client logos from the CMS (no counts, numbering or claims).",
    category: "records",
    icon: "logos",
    max: 3,
    settings: {
      clients: selection("Clients", "client", 40, automatic("all", 12)),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, padding: true, responsive: true, motion: { target: "media", list: true } },
        { columns: 4, gap: "sm", surface: "plain", padding: "md", responsive: { mobile: { columns: 2 } }, motion: { preset: "fade", duration: "3", delay: 0 } },
      ),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.certificates",
    label: "Certificates",
    description: "Certificate cards (title and issuer, with the redacted preview only — never a number or the private original).",
    category: "records",
    icon: "certificate",
    max: 2,
    settings: {
      certificates: selection("Certificates", "certificate", 6, automatic("all", 3)),
      design: design(
        { columns: [1, 2, 3], gap: true, surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 3, gap: "md", surface: "muted", tone: "brass", padding: "md", responsive: { mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: { ...head(false), cardAction: text("Card link text", 60) },
  },
  {
    ...base,
    key: "generic.statistics",
    label: "Figures",
    description: "Figures with labels. Each figure's source stays admin-only and is never shown.",
    category: "text",
    icon: "figures",
    max: 6,
    settings: {
      figures: items(
        "Figures",
        "figure",
        { min: 1, max: 8, initial: 2 },
        {
          value: value("Figure", 16, { ltr: true, hint: "As shown, for example 12,000 or 06." }),
          sourceBasis: choice(
            "Source (admin only)",
            [
              { value: "unstated", label: "Not recorded" },
              { value: "profile", label: "Company profile" },
              { value: "licence", label: "Licence or registration" },
              { value: "owner", label: "Confirmed by RAWASY" },
              { value: "other", label: "Other" },
            ],
            "unstated",
            { adminOnly: true },
          ),
          sourcePages: value("Source pages (admin only)", 40, { adminOnly: true }),
        },
        { label: text("Label", 120, { required: true }), unit: text("Unit", 20) },
      ),
      design: design(
        { columns: [2, 3, 4], surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 4, surface: "plain", tone: "steel", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 2 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.feature_cards",
    label: "Feature cards",
    description: "Cards with an icon, a title and a short text.",
    category: "text",
    icon: "cards",
    max: 10,
    settings: {
      cards: items("Cards", "card", { min: 1, max: 12, initial: 3 }, { icon: iconChoice() }, { title: text("Title", 120, { required: true }), body: textarea("Text", 400) }),
      design: design(
        { columns: [1, 2, 3, 4], gap: true, surfaces: SECTION_SURFACES, tone: true, border: true, radius: true, shadow: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 3, gap: "md", surface: "plain", tone: "steel", border: "subtle", radius: "card", shadow: "card", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.timeline",
    label: "Timeline",
    description: "Dated or phased steps in order.",
    category: "text",
    icon: "timeline",
    max: 4,
    settings: {
      steps: items("Steps", "step", { min: 1, max: 12, initial: 3 }, {}, { marker: text("Marker (a year or a phase)", 40), title: text("Title", 120, { required: true }), body: textarea("Text", 400) }),
      design: design({ surfaces: SECTION_SURFACES, tone: true, padding: true, motion: { target: "text", list: true } }, { surface: "plain", tone: "teal", padding: "md", motion: { preset: "stagger", duration: "3", delay: 0 } }),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.process",
    label: "Process",
    description: "Numbered steps with icons and an optional note (for example “a general workflow, not a certified procedure”).",
    category: "text",
    icon: "steps",
    max: 4,
    settings: {
      steps: items("Steps", "step", { min: 2, max: 10, initial: 3 }, { icon: iconChoice("Icon", "doc") }, { title: text("Title", 120, { required: true }), body: textarea("Text", 400) }),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 3, gap: "md", surface: "muted", tone: "teal", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: { ...head(false), note: text("Note under the steps", 240) },
  },
  {
    ...base,
    key: "generic.industries",
    label: "Industries",
    description: "Industry cards from the CMS, with each one's classification.",
    category: "records",
    icon: "grid",
    max: 2,
    settings: {
      industries: selection("Industries", "industry", 12, automatic("all", 8)),
      design: design(
        { columns: [2, 3, 4], gap: true, surfaces: SECTION_SURFACES, tone: true, padding: true, responsive: true, motion: { target: "text", list: true } },
        { columns: 4, gap: "sm", surface: "raised", tone: "teal", padding: "md", responsive: { tablet: { columns: 2 }, mobile: { columns: 1 } }, motion: { preset: "stagger", duration: "3", delay: 0 } },
      ),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.faq",
    label: "Questions and answers",
    description: "Questions that open to their answers (keyboard and screen-reader friendly).",
    category: "text",
    icon: "faq",
    max: 4,
    settings: {
      questions: items("Questions", "question", { min: 1, max: 30, initial: 2 }, {}, { question: text("Question", 200, { required: true }), answer: rich("Answer", { maxChars: 3000, maxNodes: 120, headings: false }) }),
      design: design({ measure: true, surfaces: SECTION_SURFACES, padding: true, motion: { target: "text", list: true } }, { measure: "wide", surface: "plain", padding: "md", motion: { preset: "stagger", duration: "3", delay: 0 } }),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.cta",
    label: "Call to action",
    description: "A short prompt with one to three buttons on a panel.",
    category: "text",
    icon: "cta",
    max: 4,
    settings: {
      actions: buttons(1, 3),
      design: design({ surfaces: ["dark", "raised", "muted"], tone: true, align: true, padding: true, motion: { target: "text" } }, { surface: "dark", tone: "orange-accent", align: "start", padding: "md", motion: reveal() }),
    },
    content: { eyebrow: text("Label", 80), title: text("Title", 200, { required: true }), body: textarea("Text", 400) },
  },
  {
    ...base,
    key: "generic.contact_details",
    label: "Contact details",
    description: "The company's current contact details (read-only, from today's website source) or contact details written for this block.",
    category: "contact_blocks",
    icon: "contact",
    max: 2,
    settings: {
      source: choice(
        "Details shown",
        [
          { value: "company", label: "The company's current details (read-only; managed in Site settings, A6)" },
          { value: "custom", label: "Written for this block" },
        ],
        "company",
      ),
      phones: items("Phone numbers (written for this block)", "phone number", { min: 0, max: 4, initial: 0 }, { number: value("Number", 24, { ltr: true, check: (v) => (PHONE_RE.test(v) ? null : "Enter a phone number: digits, an optional + and spaces.") }), whatsapp: flag("Also on WhatsApp", false) }, { label: text("Label", 60) }),
      email: value("Email (written for this block)", 254, { ltr: true, check: (v) => (EMAIL_RE.test(v) ? null : "Enter one email address.") }),
      design: design({ columns: [1, 2], surfaces: SECTION_SURFACES, tone: true, padding: true, motion: { target: "text" } }, { columns: 2, surface: "raised", tone: "steel", padding: "md", motion: reveal() }),
    },
    content: { ...head(false), address: textarea("Address (written for this block)", 300), hours: textarea("Opening hours (written for this block)", 200) },
    note: "Editing the company's own details is part of Site settings (A6). This block only shows them, or shows details written here.",
  },
  {
    ...base,
    key: "generic.quote_form",
    label: "Quote form",
    description: "The website's quotation form exactly as it works today: it prepares an email or WhatsApp message the visitor sends; nothing is sent or stored by the site.",
    category: "contact_blocks",
    icon: "form",
    max: 1,
    reusable: false,
    settings: { design: design({ surfaces: LIGHT_SURFACES, padding: true }, { surface: "muted", padding: "md" }) },
    content: head(false),
    note: "Field management, storage and delivery belong to Forms & Enquiries (A7).",
  },
  {
    ...base,
    key: "generic.map",
    label: "Map",
    description: "A Google Maps view of an address search (no place is invented); a confirmed place link may be added for the “open in Google Maps” link.",
    category: "contact_blocks",
    icon: "map",
    max: 2,
    settings: {
      query: value("Address to search", 200),
      placeLink: value("Google Maps place link (optional)", 400, { ltr: true, technical: true, check: mapPlaceLinkProblem }),
      aspect: choice(
        "Shape",
        [
          { value: "16x9", label: "Wide (16:9)" },
          { value: "4x3", label: "Standard (4:3)" },
          { value: "1x1", label: "Square" },
        ],
        "16x9",
      ),
      design: design({ width: true, surfaces: SECTION_SURFACES, padding: true, motion: { target: "media" } }, { width: "shell", surface: "plain", padding: "md", motion: reveal() }),
    },
    content: { title: text("Map title (announced to screen readers)", 160, { required: true }), address: textarea("Address shown beside the map", 300), linkLabel: text("Link text", 60) },
    note: "RAWASY's own place link is still to be confirmed: until then use the address search.",
  },
  {
    ...base,
    key: "generic.logo_strip",
    label: "Logo strip",
    description: "A row of logos chosen from the media library.",
    category: "media",
    icon: "logos",
    max: 4,
    settings: {
      logos: items("Logos", "logo", { min: 1, max: 24, initial: 2 }, { media: media("Logo") }, { name: text("Name (alt text)", 120, { required: true }) }),
      design: design({ surfaces: SECTION_SURFACES, padding: true, motion: { target: "media", list: true } }, { surface: "plain", padding: "sm", motion: { preset: "fade", duration: "3", delay: 0 } }),
    },
    content: { title: text("Label", 120) },
  },
  {
    ...base,
    key: "generic.divider",
    label: "Divider",
    description: "A rule between sections.",
    category: "layout",
    icon: "divider",
    max: 20,
    anchor: "none",
    reusable: false,
    settings: {
      style: choice(
        "Style",
        [
          { value: "line", label: "Full line" },
          { value: "short", label: "Short accent line" },
          { value: "dots", label: "Dotted line" },
        ],
        "line",
      ),
      design: design({ tone: true, width: true, padding: true, motion: { target: "decoration" } }, { tone: "steel", width: "shell", padding: "sm", motion: { preset: "fade", duration: "3", delay: 0 } }),
    },
    content: {},
  },
  {
    ...base,
    key: "generic.spacer",
    label: "Space",
    description: "Vertical space from the spacing scale (per device if needed).",
    category: "layout",
    icon: "spacer",
    max: 20,
    anchor: "none",
    reusable: false,
    settings: { design: design({ padding: true, responsive: true }, { padding: "md" }) },
    content: {},
  },
  {
    ...base,
    key: "generic.button_group",
    label: "Buttons",
    description: "One to four buttons in a row.",
    category: "layout",
    icon: "buttons",
    max: 10,
    settings: {
      buttons: buttons(1, 4),
      design: design({ align: true, padding: true, responsive: true, motion: { target: "text" } }, { align: "start", padding: "sm", motion: reveal() }),
    },
    content: {},
  },
  {
    ...base,
    key: "generic.downloads",
    label: "Downloads",
    description: "Public PDF documents from the media library (approved items are downloadable once published; private documents can never be chosen).",
    category: "media",
    icon: "download",
    max: 4,
    settings: {
      files: items("Documents", "document", { min: 1, max: 12, initial: 1 }, { media: media("Document", ["document"]) }, { label: text("Name", 160, { required: true }), description: text("Description", 240) }),
      design: design({ columns: [1, 2], surfaces: SECTION_SURFACES, tone: true, padding: true, motion: { target: "text", list: true } }, { columns: 1, surface: "plain", tone: "steel", padding: "md", motion: { preset: "stagger", duration: "3", delay: 0 } }),
    },
    content: head(false),
  },
  {
    ...base,
    key: "generic.reusable",
    label: "Reusable section",
    description: "Insert a reusable section: it shows the reusable section's current working settings and texts, edited in one place.",
    category: "reusable",
    icon: "reusable",
    max: 30,
    storable: false,
    reusable: false,
    settings: {},
    content: {},
    note: "Library entry only: the inserted section keeps the reusable section's own block type and a link to it.",
  },
];


export const GENERIC_BLOCKS: readonly BlockDefinition[] = GENERIC;

/** The generic blocks a page of the site may receive when its owner's registry entry allows additions (A5 brief §26). */
export const SAFE_ADDITIONS = [
  "generic.heading",
  "generic.rich_text",
  "generic.image",
  "generic.text_image",
  "generic.gallery",
  "generic.video",
  "generic.services_grid",
  "generic.projects_grid",
  "generic.machine_grid",
  "generic.client_logos",
  "generic.certificates",
  "generic.statistics",
  "generic.feature_cards",
  "generic.timeline",
  "generic.process",
  "generic.industries",
  "generic.faq",
  "generic.cta",
  "generic.contact_details",
  "generic.logo_strip",
  "generic.divider",
  "generic.spacer",
  "generic.button_group",
  "generic.downloads",
] as const;
