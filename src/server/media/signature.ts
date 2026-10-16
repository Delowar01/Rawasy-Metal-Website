/**
 * What a file is, from its bytes (A4 brief §28; A1-MEDIA-STORAGE §6 step 4): the extension must be on the allowlist
 * AND the signature must agree with it. The browser's MIME type and the file name are never trusted. Images are then
 * decoded (with a pixel limit) and re-encoded before anything is delivered, which neutralizes polyglot files; PDFs are
 * checked for their header and end-of-file marker and only ever delivered as attachments.
 *
 * Pure functions over a buffer (the first bytes and the last bytes of the file): framework-free, unit-tested.
 */
import { typeForExtension, type AcceptedType, type SignatureType } from "./registry.ts";

/** How many bytes of the start of a file `sniff` needs. */
export const HEAD_BYTES = 4096;
/** How many bytes of the end of a file the PDF check reads. */
export const TAIL_BYTES = 1024;

const ascii = (buf: Uint8Array, start: number, end: number) => Buffer.from(buf.subarray(start, end)).toString("latin1");

/** ISO BMFF brands that make a file AVIF (still image or sequence). HEIC/HEIF brands are not accepted. */
const AVIF_BRANDS = new Set(["avif", "avis"]);

function isAvif(head: Uint8Array): boolean {
  if (head.length < 16) return false;
  const size = Buffer.from(head).readUInt32BE(0);
  if (ascii(head, 4, 8) !== "ftyp" || size < 16 || size > 4096 || size % 4 !== 0) return false;
  const end = Math.min(size, head.length);
  const brands = [ascii(head, 8, 12)];
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(ascii(head, offset, offset + 4));
  return brands.some((brand) => AVIF_BRANDS.has(brand));
}

function isWebp(head: Uint8Array, totalSize: number): boolean {
  if (head.length < 16 || ascii(head, 0, 4) !== "RIFF" || ascii(head, 8, 12) !== "WEBP") return false;
  const riffSize = Buffer.from(head).readUInt32LE(4);
  // The RIFF size counts everything after its own 8 bytes; a file that claims more than it holds is broken.
  if (riffSize + 8 > totalSize || riffSize < 8) return false;
  return ["VP8 ", "VP8L", "VP8X"].includes(ascii(head, 12, 16));
}

function isPng(head: Uint8Array): boolean {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return head.length >= 16 && magic.every((b, i) => head[i] === b) && ascii(head, 12, 16) === "IHDR";
}

function isJpeg(head: Uint8Array): boolean {
  // SOI, then the first marker (APPn, DQT, SOF, DHT, COM …): FF D8 FF xx.
  return head.length >= 4 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff && head[3] >= 0xc0 && head[3] !== 0xff;
}

function isPdfHead(head: Uint8Array): boolean {
  return /^%PDF-[12]\.[0-9]/.test(ascii(head, 0, 8));
}

/** The file's type from its first bytes (and its total size, which a WebP header must agree with), or null. */
export function sniff(head: Uint8Array, totalSize: number): SignatureType | null {
  if (isJpeg(head)) return "jpeg";
  if (isPng(head)) return "png";
  if (isWebp(head, totalSize)) return "webp";
  if (isAvif(head)) return "avif";
  if (isPdfHead(head)) return "pdf";
  return null;
}

/** A PDF's end: the `%%EOF` marker in its last kilobyte (a truncated or padded file has none). */
export function pdfTailOk(tail: Uint8Array): boolean {
  return ascii(tail, 0, tail.length).includes("%%EOF");
}

/** The lower-case extension of a file name ("photo.JPG" → "jpg"), or "" when it has none. */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export type VerifyResult = { ok: true; accepted: AcceptedType } | { ok: false; reason: string };

/**
 * The extension decides what may be uploaded (the allowlist); the signature must then be exactly that type. A PNG
 * renamed .jpg, an HTML page renamed .jpg, an SVG, a fake WebP or AVIF and a PDF without its end marker are refused.
 */
export function verifySignature(extension: string, head: Uint8Array, tail: Uint8Array, totalSize: number): VerifyResult {
  const accepted = typeForExtension(extension);
  if (!accepted) return { ok: false, reason: "This file type is not accepted. Use JPEG, PNG, WebP, AVIF or PDF." };
  const found = sniff(head, totalSize);
  if (found !== accepted.type) {
    return { ok: false, reason: found ? `The file's content is ${found.toUpperCase()}, not what its name says (.${extension}).` : `The file is not a valid ${accepted.type.toUpperCase()} file.` };
  }
  if (accepted.type === "pdf" && !pdfTailOk(tail)) return { ok: false, reason: "The PDF is incomplete or damaged (no end-of-file marker)." };
  return { ok: true, accepted };
}

/**
 * A file name as shown in the admin and offered on download: the last path part only, control and bidi-override
 * characters removed, at most 255 characters, never used to build a path.
 */
export function displayFilename(raw: string, max = 255): string {
  const base = (raw.split(/[\\/]/).pop() ?? "").normalize("NFC");
  // Control characters, bidi controls (LRM, RLM, ALM, embeddings, overrides, isolates), line separators and the BOM.
  const clean = base.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029\ufeff]/g, "").trim();
  return [...(clean || "file")].slice(0, max).join("");
}
