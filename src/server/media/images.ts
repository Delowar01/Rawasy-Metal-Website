/**
 * Image decoding and the variants of public-class images (A1-MEDIA-STORAGE §6 steps 5 and 7; A4 brief §30–§31):
 *
 * - decoded with a 40-megapixel limit; the EXIF orientation is applied; no metadata (EXIF, GPS, ICC comments) is
 *   copied to a derivative (sharp writes none unless asked);
 * - WebP variants at 320, 640, 1080, 1600 and 2048 px wide — only widths not wider than the source, never an upscale
 *   (a source narrower than 320 px gets one variant at its own width) — plus a 256 px admin thumbnail and a blur
 *   placeholder;
 * - one image at a time per process (`sharp.concurrency(1)`, cache off, and a queue in front of it): the host shares
 *   2 GB of memory with everything else. The source is decoded once, scaled to the largest width needed as raw pixels,
 *   and every variant is made from those pixels.
 *
 * Every derivative's name carries its content hash; the bytes are written atomically. Framework-free.
 */
import { createHash } from "node:crypto";
import sharp, { type Metadata, type OutputInfo, type Sharp } from "sharp";
import { BLUR_SIZE, MEDIA_LIMITS, plannedWidths, THUMB_QUALITY, THUMB_SIZE, WEBP_QUALITY, widthKey, type SignatureType } from "./registry.ts";
import { derivedKey, type MediaStore } from "./storage.ts";

sharp.concurrency(1);
sharp.cache(false);

let queue: Promise<unknown> = Promise.resolve();

/** Runs `work` after every image job queued before it (one image job at a time in this process). */
export function oneImageAtATime<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.catch(() => undefined);
  return run;
}

/** Why an image was refused, in words for the person who uploaded it (never a library's message). */
export class ImageRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejected";
  }
}

const SHARP_FORMAT: Record<Exclude<SignatureType, "pdf">, string> = { jpeg: "jpeg", png: "png", webp: "webp", avif: "heif" };

const decodeOptions = { limitInputPixels: MEDIA_LIMITS.maxPixels, sequentialRead: true } as const;

export interface ImageFacts {
  /** Width and height as displayed (after the EXIF orientation). */
  width: number;
  height: number;
}

/**
 * Reads an image's header with the pixel limit: the decoder must agree with the signature (an AVIF must be AV1, never
 * HEVC), the image must not be animated, and width × height (as displayed) at most 40 megapixels.
 */
export async function probeImage(path: string, expected: Exclude<SignatureType, "pdf">): Promise<ImageFacts> {
  let meta: Metadata;
  try {
    meta = await sharp(path, decodeOptions).metadata();
  } catch {
    throw new ImageRejected("The image could not be read. It may be damaged, or larger than 40 megapixels.");
  }
  if (meta.format !== SHARP_FORMAT[expected]) throw new ImageRejected("The image's content does not match its type.");
  if (expected === "avif" && meta.compression !== "av1") throw new ImageRejected("Only AVIF (AV1) images are accepted, not HEIC/HEIF.");
  if ((meta.pages ?? 1) > 1) throw new ImageRejected("Animated or multi-page images are not accepted.");
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new ImageRejected("The image has no size.");
  if (w * h > MEDIA_LIMITS.maxPixels) throw new ImageRejected("The image is larger than 40 megapixels.");
  const turned = (meta.orientation ?? 1) >= 5;
  return { width: turned ? h : w, height: turned ? w : h };
}

export interface GeneratedVariant {
  variantKey: string;
  width: number;
  height: number;
  byteSize: number;
  storageKey: string;
  sha256: Buffer;
}

export interface GeneratedImage {
  width: number;
  height: number;
  blurDataUrl: string | null;
  variants: GeneratedVariant[];
}

const hashOf = (data: Uint8Array) => createHash("sha256").update(data).digest();

/**
 * Decodes the original once (pixel limit, orientation applied), then writes the width variants, the thumbnail and the
 * blur placeholder. Checks each written file's size afterwards. Throws ImageRejected for an image that cannot be
 * decoded fully (a truncated or damaged file passes the header check but fails here).
 */
export async function generateVariants(store: MediaStore, sourcePath: string, mediaId: string, facts: ImageFacts): Promise<GeneratedImage> {
  return oneImageAtATime(async () => {
    const widths = plannedWidths(facts.width);
    const largest = Math.max(...widths);
    let base: { data: Buffer; info: OutputInfo };
    try {
      base = await sharp(sourcePath, decodeOptions)
        .rotate()
        .resize({ width: largest, withoutEnlargement: true })
        .toColourspace("srgb")
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new ImageRejected("The image could not be decoded. It may be damaged or incomplete.");
    }
    const raw = { width: base.info.width, height: base.info.height, channels: base.info.channels as 1 | 2 | 3 | 4 };
    const fromBase = () => sharp(base.data, { raw });
    const variants: GeneratedVariant[] = [];
    const write = async (variantKey: string, pipeline: Sharp, quality: number) => {
      const out = await pipeline.webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      const sha256 = hashOf(out.data);
      const storageKey = derivedKey(mediaId, variantKey, sha256.toString("hex").slice(0, 8));
      await store.writeAtomic("derived", storageKey, out.data);
      const written = await store.sizeOf("derived", storageKey);
      if (written !== out.data.byteLength) throw new Error("A derivative was not written completely.");
      variants.push({ variantKey, width: out.info.width, height: out.info.height, byteSize: out.data.byteLength, storageKey, sha256 });
    };
    for (const width of widths) {
      await write(widthKey(width), width === base.info.width ? fromBase() : fromBase().resize({ width, withoutEnlargement: true }), WEBP_QUALITY);
    }
    await write("thumb", fromBase().resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true }), THUMB_QUALITY);
    const blur = await fromBase().resize(BLUR_SIZE, BLUR_SIZE, { fit: "inside" }).webp({ quality: 20 }).toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;
    return { width: facts.width, height: facts.height, blurDataUrl: blurDataUrl.length <= 600 ? blurDataUrl : null, variants };
  });
}
