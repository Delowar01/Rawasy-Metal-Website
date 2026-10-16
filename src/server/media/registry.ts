/**
 * The media library's rules as code (A4; A1-MEDIA-STORAGE §4, §6, §7): the safety flags and their policy, the usage
 * statuses, the accepted file types, the size and pixel limits, the variant widths and the upload limits. A change here
 * is a code review, never a database edit. Framework-free and import-free: the services, the CLIs, the route handlers
 * and the unit tests load it.
 */

// --- Safety flags (A1 §4: FLAG_POLICY) -----------------------------------------------------------------------------------

export interface MediaFlagInfo {
  label: string;
  description: string;
  /** A blocking flag makes the item non-deliverable at once; an informative one only informs. */
  blocking: boolean;
}

/**
 * Every flag blocks except `low_resolution` (informative). `ai_edited` stays blocking in A4 (the Owner's locked
 * decision 7): making it informative is a later Owner decision. A flag the code does not know blocks (fail-closed).
 */
export const MEDIA_FLAGS = {
  rights_pending: { label: "Rights pending", description: "Permission to show this file is not confirmed.", blocking: true },
  authorship_unconfirmed: { label: "Authorship unconfirmed", description: "The work shown may not be RAWASY's: confirm authorship first.", blocking: true },
  ai_watermark: { label: "AI watermark", description: "The file carries an AI-generation watermark.", blocking: true },
  ai_generated: { label: "AI-generated", description: "The image was generated with AI.", blocking: true },
  ai_edited: { label: "AI-edited", description: "The image was altered with AI (blocking in A4).", blocking: true },
  product_render: { label: "Render, not a photograph", description: "A catalogue or 3D render rather than a photograph of delivered work.", blocking: true },
  third_party_branding: { label: "Third-party branding", description: "Shows another company's brand or product markings.", blocking: true },
  contains_identifiers: { label: "Contains identifiers", description: "Shows legible identifiers: registration, part or serial numbers, QR codes.", blocking: true },
  contains_personal_data: { label: "Contains personal data", description: "Shows people's names, faces or other personal data.", blocking: true },
  low_resolution: { label: "Low resolution", description: "Smaller than the place it is meant for (informative only).", blocking: false },
} as const satisfies Record<string, MediaFlagInfo>;

export type MediaFlagKey = keyof typeof MEDIA_FLAGS;
export const MEDIA_FLAG_KEYS = Object.keys(MEDIA_FLAGS) as MediaFlagKey[];

export const isKnownMediaFlag = (flag: string): flag is MediaFlagKey => Object.hasOwn(MEDIA_FLAGS, flag);
/** Fail-closed: a flag the code does not know blocks. */
export const isBlockingMediaFlag = (flag: string): boolean => (isKnownMediaFlag(flag) ? MEDIA_FLAGS[flag].blocking : true);
export const mediaFlagLabel = (flag: string): string => (isKnownMediaFlag(flag) ? MEDIA_FLAGS[flag].label : `Unknown flag (${flag})`);

// --- Statuses ----------------------------------------------------------------------------------------------------------

export const USAGE_STATUS_LABELS = {
  pending_review: "Pending review",
  approved: "Approved",
  restricted: "Restricted",
  internal: "Internal",
  archived: "Archived",
} as const;
export type UsageStatus = keyof typeof USAGE_STATUS_LABELS;

export const VISIBILITY_LABELS = { public: "Public class", private: "Private" } as const;
export type Visibility = keyof typeof VISIBILITY_LABELS;

export const KIND_LABELS = { image: "Image", svg: "SVG", document: "Document" } as const;
export type MediaKind = keyof typeof KIND_LABELS;

export const PROCESSING_LABELS = { uploaded: "Uploaded", processing: "Processing", ready: "Ready", failed: "Failed" } as const;
export type ProcessingStatus = keyof typeof PROCESSING_LABELS;

// --- Accepted types (A1 §7; A4 brief §22) --------------------------------------------------------------------------------

/** What a file's bytes are (its signature), never what the browser or the name says. */
export type SignatureType = "jpeg" | "png" | "webp" | "avif" | "pdf";

export interface AcceptedType {
  type: SignatureType;
  mime: string;
  kind: "image" | "document";
  /** Extensions accepted for this type (lower case, without the dot); the first is the one stored. */
  extensions: readonly string[];
}

export const ACCEPTED_TYPES: readonly AcceptedType[] = [
  { type: "jpeg", mime: "image/jpeg", kind: "image", extensions: ["jpg", "jpeg"] },
  { type: "png", mime: "image/png", kind: "image", extensions: ["png"] },
  { type: "webp", mime: "image/webp", kind: "image", extensions: ["webp"] },
  { type: "avif", mime: "image/avif", kind: "image", extensions: ["avif"] },
  { type: "pdf", mime: "application/pdf", kind: "document", extensions: ["pdf"] },
];

/** The accepted type an extension names (lower case, no dot), or null: SVG, GIF, HEIC, TIFF, video, HTML, archives … */
export const typeForExtension = (extension: string): AcceptedType | null =>
  ACCEPTED_TYPES.find((t) => t.extensions.includes(extension.toLowerCase())) ?? null;
export const typeForSignature = (type: SignatureType): AcceptedType => ACCEPTED_TYPES.find((t) => t.type === type)!;

// --- Limits (A4 brief §23; A1 §6) ----------------------------------------------------------------------------------------

export const MEDIA_LIMITS = {
  /** Largest file accepted (any type). */
  maxBytes: 20 * 1024 * 1024,
  /** Largest image accepted, in pixels (width × height, after orientation). */
  maxPixels: 40_000_000,
  /** Every part of an upload is exactly this long except the last. */
  chunkBytes: 4 * 1024 * 1024,
  /** Parts of the largest upload (20 MiB / 4 MiB). */
  maxParts: 5,
  /** An upload not completed within this time is refused and then cleaned up. */
  uploadTtlMs: 60 * 60 * 1000,
  /** Temporary uploads older than this are removed by the maintenance tool. */
  tmpMaxAgeMs: 24 * 60 * 60 * 1000,
  /** New upload sessions per user per hour (A1 §6: 60). */
  uploadsPerHour: 60,
  /** Upload sessions a user may have open at once. */
  activeUploads: 5,
  /** A file still "processing" after this is reported (and can be marked failed) by maintenance. */
  stuckProcessingMs: 15 * 60 * 1000,
  /** Old versions become purge candidates after this (A1 §11, Owner decision 9: at least 30 days; never auto-purged in A4). */
  versionRetentionMs: 30 * 24 * 60 * 60 * 1000,
  /** Characters of the original file name kept for display. */
  filenameMax: 255,
  folderNameMax: 120,
  folderDepth: 6,
  folders: 500,
  titleMax: 200,
  altMax: 500,
  captionMax: 500,
  rightsHolderMax: 200,
  rightsNoteMax: 2000,
  sourceNoteMax: 2000,
  noteMax: 500,
  /** A clearing or approval note is kept whole in the audit event (its strings are clipped at 200). */
  decisionNoteMax: 200,
} as const;

/** Public widths (A1 §6): only those not wider than the source are generated; never an upscale. */
export const VARIANT_WIDTHS = [320, 640, 1080, 1600, 2048] as const;
/** The admin thumbnail fits inside this square. */
export const THUMB_SIZE = 256;
/** The blur placeholder fits inside this square (the registry's own placeholders are about 10–16 px). */
export const BLUR_SIZE = 16;
export const WEBP_QUALITY = 82;
export const THUMB_QUALITY = 74;

/** The variant key of a width ('w1080'); a source narrower than 320 px gets one variant at its own width. */
export const widthKey = (width: number) => `w${width}`;

/** The widths to generate for a source of `width` pixels. */
export function plannedWidths(width: number): number[] {
  const fitting = VARIANT_WIDTHS.filter((w) => w <= width);
  return fitting.length ? [...fitting] : [width];
}

// --- Upload purposes -----------------------------------------------------------------------------------------------------

/**
 * What an upload is for, fixed when it is opened: a new public-class item, a new version of an existing item, or a
 * certificate's private original (Owner only; a private item that can never be published).
 */
export const UPLOAD_PURPOSES = ["new", "replace", "private_original"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
