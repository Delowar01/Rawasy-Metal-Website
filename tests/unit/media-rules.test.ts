/**
 * Media library (A4) — the pure rules: the flag policy (unknown blocks; ai_edited blocks), the deliverability rule, the
 * role matrix of media operations, the variant widths, signatures (extension AND magic bytes), file-name cleaning, the
 * Content-Disposition header, folder names and the library's address parsing.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { decideAccess, requiredKeys, type MediaOperation } from "../../src/server/media/access.ts";
import { deliverability, documentPublicName, variantName } from "../../src/server/media/deliverability.ts";
import { publicAddressValid } from "../../src/server/media/delivery.ts";
import { folderNameProblem } from "../../src/server/media/folders.ts";
import { contentDisposition } from "../../src/server/media/headers.ts";
import { libraryHref, parseLibraryQuery } from "../../src/server/media/list.ts";
import { isBlockingMediaFlag, isKnownMediaFlag, MEDIA_FLAG_KEYS, MEDIA_FLAGS, plannedWidths, typeForExtension } from "../../src/server/media/registry.ts";
import { displayFilename, extensionOf, sniff, verifySignature } from "../../src/server/media/signature.ts";
import { permissionsOf } from "../../src/server/policy/registry.ts";

describe("flag policy (A4 brief §15)", () => {
  test("every A1 flag is known; only low_resolution is informative; ai_edited blocks; an unknown flag blocks", () => {
    assert.deepEqual(MEDIA_FLAG_KEYS.sort(), [
      "ai_edited",
      "ai_generated",
      "ai_watermark",
      "authorship_unconfirmed",
      "contains_identifiers",
      "contains_personal_data",
      "low_resolution",
      "product_render",
      "rights_pending",
      "third_party_branding",
    ]);
    assert.deepEqual(
      MEDIA_FLAG_KEYS.filter((k) => !MEDIA_FLAGS[k].blocking),
      ["low_resolution"],
    );
    assert.equal(isBlockingMediaFlag("ai_edited"), true);
    for (const unknown of ["future_flag", "", "toString", "__proto__", "constructor"]) {
      assert.equal(isKnownMediaFlag(unknown), false, unknown);
      assert.equal(isBlockingMediaFlag(unknown), true, `${unknown} blocks`);
    }
  });
});

describe("the deliverability rule (A4 brief §18)", () => {
  const ok = { visibility: "public", usageStatus: "approved", deleted: false, flags: [], kind: "image", current: { processingStatus: "ready", storageArea: "originals" }, widthVariants: 3 } as const;
  test("deliverable only when every condition holds", () => {
    assert.equal(deliverability(ok).deliverable, true);
    assert.equal(deliverability({ ...ok, current: { processingStatus: "ready", storageArea: "release" }, widthVariants: 0 }).deliverable, true, "a release file is its own delivery");
    const cases: [string, Partial<typeof ok> & Record<string, unknown>][] = [
      ["private", { visibility: "private" as never }],
      ["pending", { usageStatus: "pending_review" as never }],
      ["restricted", { usageStatus: "restricted" as never }],
      ["internal", { usageStatus: "internal" as never }],
      ["archived", { usageStatus: "archived" as never }],
      ["blocking flag", { flags: ["rights_pending"] as never }],
      ["unknown flag", { flags: ["made_up"] as never }],
      ["trashed", { deleted: true as never }],
      ["no file", { current: null as never }],
      ["processing", { current: { processingStatus: "processing", storageArea: "originals" } as never }],
      ["failed", { current: { processingStatus: "failed", storageArea: "originals" } as never }],
      ["no variants", { widthVariants: 0 as never }],
      ["svg", { kind: "svg" as never }],
    ];
    for (const [name, change] of cases) assert.equal(deliverability({ ...ok, ...change } as never).deliverable, false, name);
    assert.equal(deliverability({ ...ok, flags: ["low_resolution"] as never }).deliverable, true, "an informative flag does not block");
  });

  test("public names: variants and documents carry their hash", () => {
    assert.equal(variantName("01ARZ3NDEKTSV4RRFFQ69G5FAV/w320-0a1b2c3d.webp"), "w320-0a1b2c3d.webp");
    assert.equal(documentPublicName("0a1b2c3d4e5f", "pdf"), "document-0a1b2c3d.pdf");
  });
});

describe("the role matrix of media operations (A4 brief §21, §65)", () => {
  const ops: MediaOperation[] = ["view", "edit", "flag", "clear_flag", "approve", "restrict", "unrestrict", "archive", "unarchive", "trash", "untrash", "restore_version", "replace", "view_original"];
  const allowed = (role: string, visibility: "public" | "private") => ops.filter((op) => decideAccess(permissionsOf([role]), op, visibility).ok);

  test("public-class items", () => {
    assert.deepEqual(allowed("owner", "public"), ops);
    assert.deepEqual(allowed("admin", "public"), ops, "Admin manages and approves public media and downloads its originals");
    assert.deepEqual(allowed("editor", "public"), ["view", "edit", "flag", "replace"], "Editor: upload/edit, never approve or clear");
    assert.deepEqual(allowed("reviewer", "public"), ["view", "flag"], "Reviewer: view and add flags only");
  });

  test("private items: the Owner only — to anyone else they do not exist; never approvable", () => {
    assert.deepEqual(allowed("owner", "private"), ops.filter((op) => op !== "approve"));
    for (const role of ["admin", "editor", "reviewer"]) {
      for (const op of ops) {
        const decision = decideAccess(permissionsOf([role]), op, "private");
        assert.equal(decision.ok, false);
        assert.equal(!decision.ok && decision.hidden, true, `${role} ${op}: hidden`);
      }
    }
    assert.equal(requiredKeys("approve", "private"), null);
  });
});

describe("variants never upscale (A4 brief §30)", () => {
  test("only widths not wider than the source; a narrow source gets its own width", () => {
    assert.deepEqual(plannedWidths(4000), [320, 640, 1080, 1600, 2048]);
    assert.deepEqual(plannedWidths(2048), [320, 640, 1080, 1600, 2048]);
    assert.deepEqual(plannedWidths(1599), [320, 640, 1080]);
    assert.deepEqual(plannedWidths(320), [320]);
    assert.deepEqual(plannedWidths(200), [200]);
  });
});

describe("signatures (A4 brief §22, §28, §71): the extension AND the bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.alloc(8)]);
  const webp = (size: number) => Buffer.concat([Buffer.from("RIFF"), Buffer.from([size - 8, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(size - 16)]);
  const avif = (brand: string) => {
    const b = Buffer.alloc(32);
    b.writeUInt32BE(24, 0);
    b.write("ftyp", 4, "latin1");
    b.write(brand, 8, "latin1");
    b.write("mif1", 16, "latin1");
    b.write(brand, 20, "latin1");
    return b;
  };
  const pdfTail = Buffer.from("trailer\n<<>>\nstartxref\n9\n%%EOF\n");

  test("the allowlist: JPEG, PNG, WebP, AVIF, PDF — nothing else", () => {
    for (const ext of ["jpg", "jpeg", "JPG", "png", "webp", "avif", "pdf"]) assert.ok(typeForExtension(ext), ext);
    for (const ext of ["svg", "gif", "heic", "heif", "tif", "tiff", "bmp", "ico", "mp4", "mov", "webm", "html", "htm", "xml", "zip", "gz", "rar", "7z", "exe", "dll", "sh", "js", "doc", "docx", "xls", "xlsx", "ppt", "dwg", "dxf", "step", "stp", ""]) {
      assert.equal(typeForExtension(ext), null, ext);
    }
  });

  test("magic bytes decide; a mismatch is refused with a plain reason", () => {
    assert.equal(sniff(jpeg, jpeg.length), "jpeg");
    assert.equal(sniff(png, png.length), "png");
    assert.equal(sniff(webp(40), 40), "webp");
    assert.equal(sniff(webp(40), 30), null, "a WebP claiming more than it holds");
    assert.equal(sniff(avif("avif"), 32), "avif");
    assert.equal(sniff(avif("heic"), 32), null, "HEIC is not AVIF");
    assert.equal(sniff(Buffer.from("%PDF-1.7\n"), 9), "pdf");
    assert.equal(sniff(Buffer.from("<svg xmlns"), 10), null);
    assert.equal(sniff(Buffer.from("<!doctype html>"), 15), null);
    assert.equal(verifySignature("jpg", png, Buffer.alloc(0), png.length).ok, false);
    assert.equal(verifySignature("png", jpeg, Buffer.alloc(0), jpeg.length).ok, false);
    assert.equal(verifySignature("jpg", jpeg, Buffer.alloc(0), jpeg.length).ok, true);
    assert.equal(verifySignature("pdf", Buffer.from("%PDF-1.4\n"), Buffer.from("no end"), 100).ok, false);
    assert.equal(verifySignature("pdf", Buffer.from("%PDF-1.4\n"), pdfTail, 100).ok, true);
    assert.equal(verifySignature("svg", Buffer.from("<svg"), Buffer.alloc(0), 4).ok, false);
  });

  test("file names: the last part only, cleaned, never a path", () => {
    assert.equal(displayFilename("../../etc/passwd.jpg"), "passwd.jpg");
    assert.equal(displayFilename("C:\\Users\\x\\photo.PNG"), "photo.PNG");
    assert.equal(displayFilename("a\u0000b\u0007c\u202ed\u2066e.jpg"), "abcde.jpg");
    assert.equal(displayFilename("   "), "file");
    assert.equal([...displayFilename("ب".repeat(400) + ".jpg")].length, 255);
    assert.equal(extensionOf("photo.JPG"), "jpg");
    assert.equal(extensionOf("archive.tar.gz"), "gz");
    assert.equal(extensionOf(".htaccess"), "");
    assert.equal(extensionOf("noext"), "");
  });
});

describe("headers and addresses", () => {
  test("Content-Disposition can't be broken by a file name (quotes, separators, control characters, Unicode)", () => {
    assert.equal(contentDisposition("attachment", "report.pdf"), `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`);
    const evil = contentDisposition("attachment", 'a"; filename="x.html\r\nSet-Cookie: s=1;\\/.pdf');
    assert.ok(!/[\r\n]/.test(evil));
    assert.equal((evil.match(/"/g) ?? []).length, 2, "only the two quotes of the fallback name");
    assert.ok(!evil.includes("Set-Cookie: s=1;"), "no parameter injected");
    const arabic = contentDisposition("attachment", "شهادة.pdf");
    assert.match(arabic, /filename="_____\.pdf"; filename\*=UTF-8''%D8%B4/);
  });

  test("a long name is shortened by whole characters: never inside a surrogate pair, and a lone surrogate never throws (review L6)", () => {
    const emoji = "\u{1F600}";
    for (const name of [`${"a".repeat(199)}${emoji}.pdf`, `${"a".repeat(200)}${emoji}`, `${emoji.repeat(250)}.pdf`, `x\ud800y.pdf`, `\udc00${"b".repeat(300)}`]) {
      const header = contentDisposition("attachment", name);
      const encoded = header.slice(header.indexOf("UTF-8''") + 7);
      const decoded = decodeURIComponent(encoded);
      assert.ok([...decoded].length <= 200, `at most 200 characters: ${[...decoded].length}`);
      assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(decoded), "no lone surrogate");
      assert.ok(/^[\x20-\x7e]*$/.test(header), "the header stays ASCII");
    }
    assert.match(contentDisposition("attachment", `${"a".repeat(199)}${emoji}`), /%F0%9F%98%80$/, "a character that fits is kept whole");
    assert.match(contentDisposition("attachment", "x\ud800y.pdf"), /x%EF%BF%BDy\.pdf$/, "a lone surrogate becomes U+FFFD");
  });

  test("the public address grammar: a ULID and a width variant or a document name, nothing else", () => {
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    assert.ok(publicAddressValid(id, "w320-0a1b2c3d.webp"));
    assert.ok(publicAddressValid(id, "w2048-0a1b2c3d.webp"));
    assert.ok(publicAddressValid(id, "document-0a1b2c3d.pdf"));
    for (const name of ["thumb-0a1b2c3d.webp", "w320-0A1B2C3D.webp", "w320-0a1b2c3d.jpg", "../w320-0a1b2c3d.webp", "w320-0a1b2c3d.webp/..", "w320-0a1b2c3d.webp%00", "w320-0a1b2c3d.webp\u0000", "document-0a1b2c3d.pdf.html", "w1-0a1b2c3d.webp", "x".repeat(300)]) {
      assert.equal(publicAddressValid(id, name), false, name);
    }
    for (const badId of ["01arz3ndektsv4rrffq69g5fav", "01ARZ3NDEKTSV4RRFFQ69G5FA", "01ARZ3NDEKTSV4RRFFQ69G5FAVX", "../../etc", "01ARZ3NDEKTSV4RRFFQ69G5FA%2F", "I1ARZ3NDEKTSV4RRFFQ69G5FAV"]) {
      assert.equal(publicAddressValid(badId, "w320-0a1b2c3d.webp"), false, badId);
    }
  });

  test("folder names: plain text on one line, no separators", () => {
    assert.deepEqual(folderNameProblem("  Site   photos "), { name: "Site photos" });
    assert.deepEqual(folderNameProblem("صور المشاريع"), { name: "صور المشاريع" });
    for (const bad of ["", "   ", "a/b", "a\\b", "..", ".", "x".repeat(121), "a\u0007b", "<b>bold</b>", "a\u202eb"]) assert.ok("problem" in folderNameProblem(bad), JSON.stringify(bad));
  });

  test("the library's address is read strictly (unknown values fall back), and written back without defaults", () => {
    const q = parseLibraryQuery({ q: "  clock ", status: "approved", kind: "video", folder: "../x", flag: "drop table", sort: "evil", size: "1000", page: "-3", trash: "1", missing: "alt", view: "list" });
    assert.equal(q.q, "clock");
    assert.equal(q.status, "approved");
    assert.equal(q.kind, "");
    assert.equal(q.folder, "");
    assert.equal(q.flag, "");
    assert.equal(q.sort, "newest");
    assert.equal(q.pageSize, 24);
    assert.equal(q.page, 1);
    assert.equal(q.trash, true);
    assert.equal(q.missingAlt, true);
    assert.equal(q.view, "list");
    assert.equal(libraryHref(q), "/admin/media?q=clock&status=approved&missing=alt&trash=1&view=list");
    assert.equal(libraryHref(parseLibraryQuery({})), "/admin/media");
  });
});
