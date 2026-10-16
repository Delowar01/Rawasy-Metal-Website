/**
 * Media library (A4) — the store's path security (A4 brief §9, §70): keys follow a strict grammar per area, every path
 * resolves inside its area, a symbolic link at a file or directory never leads out, and RAWASY_DATA_DIR must be an
 * absolute folder outside the application and outside any public folder. Runs on temporary folders.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { releasePath, releaseFile } from "../../src/server/media/presence.ts";
import { dataDirFrom, isValidKey, MediaStore, StorageConfigError, StoragePathError } from "../../src/server/media/storage.ts";
import { derivedNameHash } from "../../src/server/media/images.ts";

const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
let root: string;
let outside: string;
let store: MediaStore;

before(async () => {
  root = mkdtempSync(join(tmpdir(), "rawasy-store-unit-"));
  outside = mkdtempSync(join(tmpdir(), "rawasy-outside-unit-"));
  writeFileSync(join(outside, "secret.txt"), "not for the store");
  store = await MediaStore.open(root);
});
after(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("keys (A4 brief §70)", () => {
  test("each area's grammar accepts only generated keys", () => {
    assert.ok(isValidKey("originals", `2026/10/${ULID}.jpg`));
    assert.ok(isValidKey("derived", `${ULID}/w1080-0a1b2c3d.webp`));
    assert.ok(isValidKey("derived", `${ULID}/thumb-0a1b2c3d.webp`));
    assert.ok(isValidKey("private", `${ULID}/${ULID}.pdf`));
    assert.ok(isValidKey("tmp", `${ULID}/part-1`));
    const bad: [Parameters<typeof isValidKey>[0], string][] = [
      ["originals", `../2026/10/${ULID}.jpg`],
      ["originals", `/etc/passwd`],
      ["originals", `2026/13/${ULID}.jpg`],
      ["originals", `2026/10/${ULID}.svg`],
      ["originals", `2026/10/${ULID}.jpg/..`],
      ["originals", `2026\\10\\${ULID}.jpg`],
      ["originals", `2026/10/${ULID}.jpg\u0000.png`],
      ["originals", `2026%2F10%2F${ULID}.jpg`],
      ["originals", `2026/10/${ULID.toLowerCase()}.jpg`],
      ["derived", `${ULID}/w1080-0a1b2c3d.jpg`],
      ["derived", `${ULID}/../w1080-0a1b2c3d.webp`],
      ["derived", `${ULID}/w1080-0a1b2c3.webp`],
      ["derived", `${ULID}/original.webp`],
      ["private", `${ULID}/${ULID}.html`],
      ["tmp", `${ULID}/part-0`],
      ["tmp", `${ULID}/part-100`],
      ["tmp", `${ULID}/../../x`],
      ["originals", `${"a".repeat(300)}`],
      ["originals", ""],
    ];
    for (const [area, key] of bad) {
      assert.equal(isValidKey(area, key), false, `${area}: ${key}`);
      assert.throws(() => store.path(area, key), StoragePathError, `${area}: ${key}`);
    }
  });

  test("a symbolic link never leads out: at the file (O_NOFOLLOW) or at its directory (real path checked)", async () => {
    const dir = join(store.areaRoot("derived"), ULID);
    mkdirSync(dir, { recursive: true });
    symlinkSync(join(outside, "secret.txt"), join(dir, "w320-0a1b2c3d.webp"));
    await assert.rejects(store.openRead("derived", `${ULID}/w320-0a1b2c3d.webp`), StoragePathError);
    assert.equal(await store.sizeOf("derived", `${ULID}/w320-0a1b2c3d.webp`), null, "a symlink is not a stored file");
    const other = "01BX5ZZKBKACTAV9WEVGEMMVRZ";
    symlinkSync(outside, join(store.areaRoot("derived"), other));
    writeFileSync(join(outside, "w640-0a1b2c3d.webp"), "outside bytes");
    await assert.rejects(store.verifiedPath("derived", `${other}/w640-0a1b2c3d.webp`), StoragePathError);
    await assert.rejects(store.writeAtomic("derived", `${other}/w1080-0a1b2c3d.webp`, Buffer.from("x")), StoragePathError, "never written through a linked folder");
    const listing = await store.listArea("derived");
    assert.ok(listing.other.some((k) => k.includes("w320-0a1b2c3d.webp")) || listing.other.includes(other), "links are reported, not followed");
  });

  test("streamed writes keep their byte cap and leave nothing partial", async () => {
    async function* source(n: number) {
      yield Buffer.alloc(n);
    }
    const { StorageSizeError } = await import("../../src/server/media/storage.ts");
    await assert.rejects(store.writeStreamAtomic("tmp", `${ULID}/part-1`, source(11), { maxBytes: 10 }), StorageSizeError);
    await assert.rejects(store.writeStreamAtomic("tmp", `${ULID}/part-1`, source(9), { maxBytes: 10, exactBytes: 10 }), StorageSizeError);
    assert.equal(await store.sizeOf("tmp", `${ULID}/part-1`), null);
    assert.equal(await store.writeStreamAtomic("tmp", `${ULID}/part-1`, source(10), { maxBytes: 10, exactBytes: 10 }), 10);
    assert.equal(await store.sizeOf("tmp", `${ULID}/part-1`), 10);
  });
});

describe("generated files are written once (review M2)", () => {
  test("writeNew creates a file, accepts the same bytes again, and never replaces other bytes", async () => {
    const key = `${ULID}/w640-11111111.webp`;
    assert.equal(await store.writeNew("derived", key, Buffer.from("first bytes")), "created");
    assert.equal(await store.writeNew("derived", key, Buffer.from("first bytes")), "same", "the same bytes: not this write's file");
    await assert.rejects(store.writeNew("derived", key, Buffer.from("other bytes")), StoragePathError);
    const opened = await store.openRead("derived", key);
    assert.equal((await opened!.handle.readFile()).toString(), "first bytes", "never overwritten");
    await opened!.handle.close();
    const listing = await store.listArea("derived");
    assert.ok(!listing.files.some((k) => k.includes(".tmp-")), "no temporary file left behind");
  });

  test("writeNew never writes through a link at the name or its folder", async () => {
    const linked = `${ULID}/w1600-22222222.webp`;
    symlinkSync(join(outside, "secret.txt"), join(store.areaRoot("derived"), linked));
    await assert.rejects(store.writeNew("derived", linked, Buffer.from("not for the store")), StoragePathError);
    const other = "01BX5ZZKBKACTAV9WEVGEMMVS0";
    symlinkSync(outside, join(store.areaRoot("derived"), other));
    await assert.rejects(store.writeNew("derived", `${other}/w320-33333333.webp`, Buffer.from("x")), StoragePathError);
  });

  test("a derivative's name comes from its file version and its bytes: two versions of the same pixels never share one", () => {
    const bytes = Buffer.from("identical variant bytes");
    const a = derivedNameHash("01HZZZZZZZZZZZZZZZZZZZZZZA", bytes);
    const b = derivedNameHash("01HZZZZZZZZZZZZZZZZZZZZZZB", bytes);
    assert.match(a, /^[0-9a-f]{8}$/);
    assert.notEqual(a, b);
    assert.equal(derivedNameHash("01HZZZZZZZZZZZZZZZZZZZZZZA", bytes), a, "the same version and bytes: the same (immutable) name");
    assert.notEqual(derivedNameHash("01HZZZZZZZZZZZZZZZZZZZZZZA", Buffer.from("other bytes")), a);
  });
});

describe("RAWASY_DATA_DIR (A4 brief §9)", () => {
  test("absolute, outside the application folder, never inside a public or public_html folder", () => {
    assert.throws(() => dataDirFrom({}, "/srv/app"), StorageConfigError);
    assert.throws(() => dataDirFrom({ RAWASY_DATA_DIR: "data" }, "/srv/app"), StorageConfigError);
    assert.throws(() => dataDirFrom({ RAWASY_DATA_DIR: "/srv/app/data" }, "/srv/app"), StorageConfigError);
    assert.throws(() => dataDirFrom({ RAWASY_DATA_DIR: "/srv/app" }, "/srv/app"), StorageConfigError);
    assert.throws(() => dataDirFrom({ RAWASY_DATA_DIR: "/home/user/public_html/media" }, "/srv/app"), StorageConfigError);
    assert.throws(() => dataDirFrom({ RAWASY_DATA_DIR: "/srv/public/media" }, "/srv/app"), StorageConfigError);
    assert.equal(dataDirFrom({ RAWASY_DATA_DIR: "/home/user/rawasy-data" }, "/srv/app"), "/home/user/rawasy-data");
  });

  test("release files: only /media/<group>/<name>.<ext>, resolved inside the release folder", async () => {
    const release = mkdtempSync(join(tmpdir(), "rawasy-release-unit-"));
    try {
      mkdirSync(join(release, "media", "site"), { recursive: true });
      writeFileSync(join(release, "media", "site", "logo.webp"), "x");
      assert.ok(await releaseFile(release, "/media/site/logo.webp"));
      for (const key of ["/media/../server.js", "/media/site/../../x.webp", "media/site/logo.webp", "/media/site/logo.svg", "/etc/passwd", "/media/site/logo.webp\u0000"]) {
        assert.equal(releasePath(release, key), null, key);
      }
      symlinkSync(join(outside, "secret.txt"), join(release, "media", "site", "link.webp"));
      assert.equal(await releaseFile(release, "/media/site/link.webp"), null, "a link out of the release folder is not a release file");
    } finally {
      rmSync(release, { recursive: true, force: true });
    }
  });
});
