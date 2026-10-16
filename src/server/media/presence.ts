/**
 * Whether a file version's delivery bytes are really on disk (A4 brief §18 "storage record exists", §62 "never mark a
 * file ready when its binary is missing"): an uploaded image needs each recorded variant at its recorded size, a
 * document its original, a release file its file in the release's `public/` folder. Approval and version restores check
 * this before they make anything deliverable; the maintenance tool reports what is missing.
 *
 * Framework-free. Release keys are checked against a strict grammar and resolved inside the release folder only.
 */
import { lstat, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { MediaStore } from "./storage.ts";

/** A release key: `/media/<group>/<name>.<ext>` — today's `public/media` files, as the media registry names them. */
export const RELEASE_KEY = /^\/media\/[a-z0-9-]{1,40}\/[a-z0-9][a-z0-9._-]{0,120}\.(webp|png|jpe?g|avif|pdf)$/;

/** The absolute path of a release file inside `releaseDir` (the app's `public/` folder), or null for a bad key. */
export function releasePath(releaseDir: string, storageKey: string): string | null {
  if (!RELEASE_KEY.test(storageKey) || storageKey.includes("..")) return null;
  const root = resolve(releaseDir);
  const full = resolve(root, `.${storageKey}`);
  const rel = relative(root, full);
  if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`) || resolve(root, rel) !== full) return null;
  return full;
}

/** The release file's real path when it is a regular file inside the release folder (no symbolic link out of it). */
export async function releaseFile(releaseDir: string, storageKey: string): Promise<string | null> {
  const full = releasePath(releaseDir, storageKey);
  if (!full) return null;
  try {
    // `turbopackIgnore`: run-time paths (the release folder, a checked key); without it the bundler's file tracing
    // lists the whole project — every source file and all of public/, the held-back media included — for the routes.
    const [root, real] = await Promise.all([realpath(/* turbopackIgnore: true */ releaseDir), realpath(/* turbopackIgnore: true */ full)]);
    const rel = relative(root, real);
    if (!rel || rel.startsWith("..")) return null;
    const stat = await lstat(real);
    return stat.isFile() ? real : null;
  } catch {
    return null;
  }
}

export interface PresenceFile {
  storageArea: "release" | "originals" | "private";
  storageKey: string;
  byteSize: number;
  kind: "image" | "svg" | "document";
}

export interface PresenceVariant {
  variantKey: string;
  storageKey: string;
  byteSize: number;
}

/** What is missing for a version to be delivered (empty when everything is in place). Never throws for a bad key. */
export async function missingDeliveryFiles(
  store: MediaStore | null,
  releaseDir: string,
  file: PresenceFile,
  variants: readonly PresenceVariant[],
): Promise<string[]> {
  if (file.storageArea === "release") {
    const path = await releaseFile(releaseDir, file.storageKey);
    if (!path) return ["the release file"];
    const stat = await lstat(path);
    return stat.size === file.byteSize ? [] : ["the release file (its size differs from the record)"];
  }
  if (!store) return ["the media storage (RAWASY_DATA_DIR is not set)"];
  const missing: string[] = [];
  const sizeOf = async (area: "originals" | "private" | "derived", key: string) => {
    try {
      return await store.sizeOf(area, key);
    } catch {
      return null;
    }
  };
  if (file.kind === "document" || file.storageArea === "private") {
    const size = await sizeOf(file.storageArea, file.storageKey);
    if (size !== file.byteSize) missing.push("the file itself");
    return missing;
  }
  const widths = variants.filter((v) => v.variantKey !== "thumb");
  if (!widths.length) missing.push("its delivery variants");
  for (const variant of variants) {
    const size = await sizeOf("derived", variant.storageKey);
    if (size !== variant.byteSize) missing.push(`the variant ${variant.variantKey}`);
  }
  return missing;
}

/** The release folder of this app: `public/` beside the build (the working directory of `next start` / server.js). */
export const defaultReleaseDir = () => join(process.cwd(), "public");
