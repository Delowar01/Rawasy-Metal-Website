/**
 * What the builder's Server Actions accept (A5 brief §66–§67): small structured JSON only, parsed strictly before any
 * database work — never written as received. A layout save names each section by its stored id (or a temporary
 * reference for a new one), its place (the array order), its visibility, devices and anchor and, only when the editor
 * changed it, its settings, texts and language states, which the block registry then validates in full. Who acts, the
 * structure lock, block versions and translation statuses are never read from input.
 */
import { z } from "zod";
import { plainText } from "../cms/text.ts";
import { BUILDER_LIMITS } from "./fields.ts";
import { ANCHOR_MAX, ULID_RE } from "./links.ts";

const ulid = z.string().regex(ULID_RE);
const blockKey = z.string().max(64).regex(/^[a-z][a-z_]*\.[a-z][a-z_]*$/);
/** A new section's temporary reference in a save ("new:3"); the server gives it a ULID. */
export const NEW_REF = /^new:[0-9]{1,6}$/;

export const ownerRefSchema = z.object({ type: z.enum(["page", "service"]), id: ulid }).strict();

export const devicesSchema = z
  .object({ desktop: z.boolean(), tablet: z.boolean(), mobile: z.boolean() })
  .strict()
  .refine((d) => d.desktop || d.tablet || d.mobile, { message: "Keep the section on at least one kind of screen, or hide it." });

/** A section's data as the editor holds it: settings, texts per language and the language checkboxes. */
export const sectionDataSchema = z
  .object({
    settings: z.unknown(),
    content: z.object({ en: z.unknown().optional(), ar: z.unknown().optional() }).strict(),
    complete: z.object({ en: z.boolean(), ar: z.boolean() }).strict(),
    otherUnaffected: z.boolean(),
  })
  .strict();
export type SectionDataInput = z.infer<typeof sectionDataSchema>;

export const sectionInputSchema = z
  .object({
    ref: z.union([ulid, z.string().regex(NEW_REF)]),
    /** A new section's block type (an existing one keeps its own; a different value is refused). */
    blockType: blockKey.optional(),
    /** A new section copied from this one (an existing section of the same owner). */
    duplicateOf: ulid.optional(),
    /** A new section linked to this reusable section. */
    reusableId: ulid.nullable().optional(),
    visible: z.boolean(),
    devices: devicesSchema,
    anchor: z.string().max(ANCHOR_MAX).nullable(),
    data: sectionDataSchema.optional(),
  })
  .strict();
export type SectionInput = z.infer<typeof sectionInputSchema>;

export const layoutInputSchema = z
  .object({
    owner: ownerRefSchema,
    expectedVersion: z.number().int().min(0).max(2_147_483_647),
    sections: z.array(sectionInputSchema).max(BUILDER_LIMITS.sectionsPerOwner),
  })
  .strict()
  .superRefine((value, ctx) => {
    const refs = value.sections.map((s) => s.ref);
    if (new Set(refs).size !== refs.length) ctx.addIssue({ code: "custom", message: "A section appears twice in the layout." });
  });
export type LayoutInput = z.infer<typeof layoutInputSchema>;

/** The other immediate section operations: on one section, decided on the layout's version the builder showed. */
export const sectionActionSchema = z
  .object({ owner: ownerRefSchema, expectedVersion: z.number().int().min(0).max(2_147_483_647), sectionId: ulid })
  .strict();

/**
 * A reusable section's name: A3's plain text (one line, no markup, no control or direction-override characters — it is
 * shown in lists, badges and audit summaries), 1 to 120 characters.
 */
export const reusableNameSchema = plainText(120).refine((v) => v.length > 0, { message: "Give the reusable section a name." });

/** Parses a JSON body the action received as text, bounded before parsing (never more than the save limit). */
export function parseBoundedJson(raw: unknown, limit: number = BUILDER_LIMITS.saveBytes): { ok: true; value: unknown } | { ok: false } {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > limit) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}
