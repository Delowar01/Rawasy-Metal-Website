/**
 * Text rules of the Core CMS (A1-CONTENT-MODEL §12–§13; A3 brief §35–§36). Content is plain text: no HTML, script,
 * CSS or markup of any kind is accepted, and longer copy is stored in A1's rich-text JSON document — in A3 paragraphs
 * and line breaks only, edited as plain text (a blank line between paragraphs). No WYSIWYG editor, no HTML ever stored.
 *
 * Pure functions (no I/O), shared by the services, the server actions and the unit tests.
 */
import { z } from "zod";

// --- Plain text --------------------------------------------------------------------------------------------------------

/** C0/C1 control characters other than line feed and tab. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
/** Direction overrides, embeddings and isolates: the page sets text direction itself (LRM/RLM and ALM stay allowed). */
const BIDI_CONTROL = /[‪-‮⁦-⁩]/;
/** The start of an HTML tag, comment, declaration or processing instruction. */
const MARKUP = /<[A-Za-z!/?]/;

export type TextProblem = "control" | "bidi" | "markup" | "newline";

export const TEXT_PROBLEM_MESSAGES: Record<TextProblem, string> = {
  control: "Remove the invisible control characters.",
  bidi: "Remove the invisible direction-control characters (the page sets text direction itself).",
  markup: "Remove the HTML or markup (text in angle brackets): the CMS stores plain text only.",
  newline: "Use one line only.",
};

/** Line endings as a browser sends them (CRLF) become LF; nothing else is changed but the surrounding spaces. */
export const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, "\n");

/** Why a text is not acceptable plain text, or null. */
export function textProblem(value: string, options: { multiline: boolean }): TextProblem | null {
  if (CONTROL.test(value)) return "control";
  if (BIDI_CONTROL.test(value)) return "bidi";
  if (MARKUP.test(value)) return "markup";
  if (!options.multiline && value.includes("\n")) return "newline";
  return null;
}

/**
 * A Zod schema for an optional plain-text field: trimmed, line endings normalized, at most `max` characters (counted
 * as code points, so an Arabic letter counts once). Empty input is "" (the caller decides whether that means missing).
 */
export function plainText(max: number, options: { multiline?: boolean } = {}) {
  const multiline = options.multiline ?? false;
  return z
    .string()
    .max(max * 4)
    .transform((value) => normalizeNewlines(value).trim())
    .superRefine((value, ctx) => {
      if ([...value].length > max) ctx.addIssue({ code: "custom", message: `Use at most ${max} characters.` });
      const problem = textProblem(value, { multiline });
      if (problem) ctx.addIssue({ code: "custom", message: TEXT_PROBLEM_MESSAGES[problem] });
    });
}

/**
 * An alt text (A4; A1-CONTENT-MODEL §8.1, A4 brief §40): `null` = not written yet, `""` = deliberately decorative, otherwise
 * plain text — never only spaces (that is neither a description nor a decision).
 */
export function altText(max: number) {
  const text = plainText(max);
  return z
    .union([z.null(), z.string().max(max * 4)])
    .optional()
    .transform((value, ctx): string | null => {
      if (value === undefined || value === null) return null;
      if (value === "") return "";
      const parsed = text.safeParse(value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", message: issue.message });
        return z.NEVER;
      }
      if (!parsed.data) {
        ctx.addIssue({ code: "custom", message: "Write the alt text, or mark the photo decorative." });
        return z.NEVER;
      }
      return parsed.data;
    });
}

/** Length in characters as people count them (code points). */
export const charLength = (value: string) => [...value].length;

// --- Rich text (A1-CONTENT-MODEL §12), paragraphs only in A3 --------------------------------------------------------------

export type RichInline = { type: "text"; text: string } | { type: "hard_break" };
export type RichParagraph = { type: "paragraph"; content: RichInline[] };
export interface RichDoc {
  type: "doc";
  content: RichParagraph[];
}

export const EMPTY_DOC: RichDoc = { type: "doc", content: [] };

/** The stored document's shape: exactly these nodes and keys; text checked like plain text. */
export const richDocSchema = z
  .object({
    type: z.literal("doc"),
    content: z
      .array(
        z
          .object({
            type: z.literal("paragraph"),
            content: z
              .array(
                z.union([
                  z.object({ type: z.literal("text"), text: z.string().min(1).max(4000) }).strict(),
                  z.object({ type: z.literal("hard_break") }).strict(),
                ]),
              )
              .max(200),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .superRefine((doc, ctx) => {
    for (const paragraph of doc.content) {
      for (const node of paragraph.content) {
        if (node.type === "text" && textProblem(node.text, { multiline: false })) {
          ctx.addIssue({ code: "custom", message: TEXT_PROBLEM_MESSAGES[textProblem(node.text, { multiline: false })!] });
        }
      }
    }
  });

/**
 * Plain text → document: a blank line separates paragraphs; a single line break inside a paragraph is kept as a
 * `hard_break`. Lines are trimmed at their ends; empty paragraphs are dropped.
 */
export function plainToDoc(value: string): RichDoc {
  const text = normalizeNewlines(value).trim();
  if (!text) return EMPTY_DOC;
  const paragraphs = text
    .split(/\n[ \t]*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);
  return {
    type: "doc",
    content: paragraphs.map((lines) => ({
      type: "paragraph",
      content: lines.flatMap((line, i): RichInline[] => (i === 0 ? [{ type: "text", text: line }] : [{ type: "hard_break" }, { type: "text", text: line }])),
    })),
  };
}

/** Document → plain text (the editor's textarea). Unknown shapes read as empty (never thrown at a page). */
export function docToPlain(value: unknown): string {
  const parsed = richDocSchema.safeParse(value);
  if (!parsed.success) return "";
  return parsed.data.content
    .map((paragraph) => paragraph.content.map((node) => (node.type === "text" ? node.text : "\n")).join(""))
    .join("\n\n");
}

export const isDocEmpty = (value: unknown) => {
  const parsed = richDocSchema.safeParse(value);
  return !parsed.success || parsed.data.content.length === 0;
};

/**
 * A Zod schema for a rich-text field written as plain text: checked line by line like plain text, at most
 * `LIMITS.text.paragraphs` paragraphs of at most `maxParagraph` characters, returned as the document.
 */
export function richTextFromPlain(maxParagraph: number, maxParagraphs: number) {
  return z
    .string()
    .max(maxParagraph * maxParagraphs * 4)
    .transform((value) => normalizeNewlines(value))
    .superRefine((value, ctx) => {
      const problem = textProblem(value, { multiline: true });
      if (problem) ctx.addIssue({ code: "custom", message: TEXT_PROBLEM_MESSAGES[problem] });
      const doc = plainToDoc(value);
      if (doc.content.length > maxParagraphs) ctx.addIssue({ code: "custom", message: `Use at most ${maxParagraphs} paragraphs.` });
      for (const p of doc.content) {
        const length = p.content.reduce((n, node) => n + (node.type === "text" ? charLength(node.text) : 1), 0);
        if (length > maxParagraph) {
          ctx.addIssue({ code: "custom", message: `A paragraph is longer than ${maxParagraph} characters: split it.` });
          break;
        }
      }
    })
    .transform((value) => plainToDoc(value));
}

// --- Lists of short lines (service highlights) ------------------------------------------------------------------------

/** One item per line; empty lines dropped; each item trimmed and checked. */
export function linesList(maxItems: number, maxLength: number) {
  return z
    .string()
    .max(maxItems * maxLength * 4 + maxItems * 2)
    .transform((value) =>
      normalizeNewlines(value)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .superRefine((items, ctx) => {
      if (items.length > maxItems) ctx.addIssue({ code: "custom", message: `Use at most ${maxItems} lines.` });
      for (const item of items) {
        if (charLength(item) > maxLength) {
          ctx.addIssue({ code: "custom", message: `Each line may have at most ${maxLength} characters.` });
          break;
        }
        const problem = textProblem(item, { multiline: false });
        if (problem) {
          ctx.addIssue({ code: "custom", message: TEXT_PROBLEM_MESSAGES[problem] });
          break;
        }
      }
    });
}

/** A stored list of strings (JSON) read defensively. */
export const storedLines = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

// --- Addresses ---------------------------------------------------------------------------------------------------------

/**
 * An external address (A1 §12–§13): `https:` only, a real host name with a dot, no user name or password, no spaces,
 * backslashes or control characters, at most 255 characters (as typed and as stored). Never fetched by the server.
 */
export function httpsUrlProblem(value: string): string | null {
  if (charLength(value) > 255) return "Use at most 255 characters.";
  if (/\s/.test(value)) return "An address has no spaces.";
  // A backslash reads as "/" to a browser ("https://evil.com\@example.com" opens evil.com), and control characters are
  // dropped by the parser: neither belongs in an address (A3 security review, finding 6).
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return "An address may not contain a backslash or control characters.";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a full address that starts with https://";
  }
  if (url.protocol !== "https:") return "Only https:// addresses are accepted.";
  if (url.username || url.password) return "An address may not contain a user name or password.";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || url.hostname.includes("..")) return "Enter a public web address (for example https://example.com).";
  if (charLength(url.href) > 255) return "Use at most 255 characters.";
  return null;
}

/**
 * An accepted address as stored: the parser's own form (`URL.href`: lower-case host, punycode for other scripts, a
 * normalized path), so what is stored is exactly what a browser would open. Call only after `httpsUrlProblem` is null.
 */
export const normalizedHttpsUrl = (value: string) => new URL(value).href;

/** A same-site path for a canonical override (A1 §11): `/`, or segments of lowercase letters, digits and hyphens. */
export function sitePathProblem(value: string): string | null {
  if (value === "/") return null;
  if (!/^(\/[a-z0-9]+(-[a-z0-9]+)*)+$/.test(value) || value.length > 255) {
    return "Use a path on this site such as /services/laser-cutting (lowercase, no domain, no query).";
  }
  return null;
}

// --- Certificate digit guard (A1-PUBLISHING-VERSIONS §4.2; e2e/commerce-certificates.spec.ts) ---------------------------
// Characters beyond ASCII are written as escapes here: a literal no-break space in the separator class was once lost
// (A3 security review, finding 1), which let "1010 123 456" with no-break spaces through.

/** Seven or more digits in a row (read after `guardText`). */
const DIGIT_RUN = /[0-9]{7,}/;
/**
 * Digits written in groups: one separator between two digits — any space (no-break and narrow ones included), any dash
 * or hyphen, a dot, comma, slash, apostrophe or right single quote, or the Arabic decimal or thousands separator. At
 * least as strict as the public certificates test (space, no-break space, dot, slash, hyphen). A colon is no separator
 * ("ISO 9001:2015" holds two numbers), nor are two characters in a row ("14001, 9001" is a list).
 */
const GROUPED = /[0-9](?:[0-9]|[\p{Zs}\p{Pd}.,/'’٫٬](?=[0-9]))+/gu;
/** The documents' own dates (issue and registration dates) are the one grouped exception, as in the public test. */
const DATE = /^([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}|[0-9]{4}[./-][0-9]{1,2}[./-][0-9]{1,2})$/;
/**
 * Expiry wording: "expiry", "expires", "valid until / till / through / to", "validity"; Arabic انتهاء (expiry), صلاحية /
 * صلاحيته (validity), صالح(ة) or ساري(ة) حتى / لغاية (valid until).
 */
const EXPIRY =
  /expir|\bvalid(?:ity\b|\s+(?:until|till|thru|through|to)\b)|انتهاء|صلاحي[ةت]|(?:صالح|ساري)[ةه]?\s+(?:حتى|لغاية)/iu;

/** Arabic-Indic and Extended Arabic-Indic digits as ASCII digits. */
export const asciiDigits = (value: string) =>
  value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * Invisible format characters (Unicode category Cf: zero-width spaces and joiners, direction marks, the soft hyphen, the
 * word joiner, the byte-order mark): plain text may hold them, and a number written with them between its digits shows
 * as one number, so the guard reads past them (A5 final security review).
 */
const FORMAT = /\p{Cf}/gu;

/**
 * The text the guard reads: NFKC first (full-width and other compatibility digits become ASCII, no-break spaces plain
 * spaces), format characters removed, then every other decimal digit of any script as "0" — only how many digits there
 * are, and where, matters.
 */
const guardText = (value: string) =>
  value
    .normalize("NFKC")
    .replace(FORMAT, "")
    .replace(/\p{Nd}/gu, (d) => (d >= "0" && d <= "9" ? d : "0"));

/**
 * Whether a text holds what would be a registration or certificate number: seven or more digits in a row, or written in
 * groups, in any digit script — dates aside. Also applied to certificate slugs (the slug is the public anchor).
 */
export function hasRegistrationNumber(value: string): boolean {
  const text = guardText(value);
  if (DIGIT_RUN.test(text)) return true;
  for (const match of text.matchAll(GROUPED)) {
    if (match[0].replace(/[^0-9]/g, "").length >= 7 && !DATE.test(match[0])) return true;
  }
  return false;
}

/**
 * Why a public certificate text may not be stored, or null: a registration or certificate number or expiry wording.
 * Applied on save to every public certificate text, facts included (A1 applies it at publication too).
 */
export function digitGuardProblem(value: string): string | null {
  if (hasRegistrationNumber(value)) return "Certificate text can't hold a registration or certificate number (seven or more digits, in a row or in groups).";
  if (EXPIRY.test(value.normalize("NFKC").replace(FORMAT, ""))) return "Expiry details stay admin-only: use the expiry date field instead.";
  return null;
}

// --- Search normalization (A1-DATABASE-SCHEMA §2) --------------------------------------------------------------------

/**
 * Text as the admin search compares it: tashkeel and tatweel removed, alef forms unified, ta marbuta → ha, alef maqsura
 * → ya, Arabic-Indic digits → ASCII, Latin lower-cased, spaces collapsed. Applied to stored text and to the query alike.
 */
export function normalizeForSearch(value: string): string {
  return asciiDigits(value)
    .normalize("NFKC")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A LIKE pattern for a normalized query: `%`, `_` and `\` escaped (MariaDB's default escape character). */
export const likePattern = (query: string) => `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
