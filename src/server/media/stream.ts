/**
 * Opens a delivery target for streaming (framework-free): from the persistent store (never through a symlink, inside its
 * area) or, for a release file, from the release's `public/` folder (strict key grammar, real path inside it). The size
 * on disk must equal the recorded size, or nothing is served (an integrity problem the maintenance tool reports).
 */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import type { DeliveryTarget } from "./delivery.ts";
import { releaseFile } from "./presence.ts";
import type { MediaStore } from "./storage.ts";

export interface OpenedTarget {
  body: ReadableStream<Uint8Array>;
  size: number;
  /** Stops the stream (a HEAD request, or an answer without a body). */
  close: () => void;
}

export async function openTarget(store: MediaStore | null, releaseDir: string, target: DeliveryTarget): Promise<OpenedTarget | null> {
  let stream: Readable;
  let size: number;
  if (target.area === "release") {
    const path = await releaseFile(releaseDir, target.key);
    if (!path) return null;
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
    if (!handle) return null;
    const info = await handle.stat();
    if (!info.isFile()) {
      await handle.close();
      return null;
    }
    size = info.size;
    stream = handle.createReadStream({ autoClose: true });
  } else {
    if (!store) return null;
    const opened = await store.readStream(target.area, target.key).catch(() => null);
    if (!opened) return null;
    size = opened.size;
    stream = opened.stream;
  }
  if (size !== target.byteSize) {
    stream.destroy();
    return null;
  }
  return { body: Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, size, close: () => stream.destroy() };
}
