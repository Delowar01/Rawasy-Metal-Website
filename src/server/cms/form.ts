/**
 * A content form's fields as one plain object for its schema (pure; the Server Actions and the tests use it).
 *
 * Names are `field`, `<locale>.<field>`, `rel.<relation>` (repeated, in order) or `seo.<field>`; anything else —
 * Next's own `$ACTION…` fields, prototype keys, deeper paths, files — is ignored, so a forged extra field cannot reach a
 * column (no mass assignment: each schema reads only the fields it defines). A repeated single field keeps its first value.
 */
const PART = /^[A-Za-z][A-Za-z0-9]{0,40}$/;

export type FormObject = Record<string, unknown>;

export function formToObject(entries: Iterable<[string, FormDataEntryValue]>): FormObject {
  const out: FormObject = Object.create(null);
  for (const [name, value] of entries) {
    if (typeof value !== "string") continue;
    const parts = name.split(".");
    if (parts.length > 2 || !parts.every((p) => PART.test(p))) continue;
    if (parts.length === 1) {
      if (!(parts[0] in out)) out[parts[0]] = value;
      continue;
    }
    const [group, key] = parts;
    const bucket = (out[group] ??= Object.create(null)) as Record<string, unknown>;
    if (typeof bucket !== "object" || Array.isArray(bucket)) continue;
    if (group === "rel") {
      ((bucket[key] ??= []) as string[]).push(value);
    } else if (!(key in bucket)) {
      bucket[key] = value;
    }
  }
  return out;
}

/** Zod issue paths as the form names its fields (`en.title`, `rel.machines`, `children`). */
export const fieldName = (path: readonly PropertyKey[]) => path.filter((p) => typeof p === "string" || typeof p === "number").join(".");
