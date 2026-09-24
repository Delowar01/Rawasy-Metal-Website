#!/usr/bin/env python3
"""
Extract web-ready media from the RAWASY company profile PDF.

Usage:
    python3 scripts/extract-profile-assets.py <company-profile.pdf>

Requires: pymupdf, pillow, numpy  (pip install pymupdf pillow numpy)

What it does
  * Pulls every embedded photo we use by PDF object id (xref) and saves it as
    WebP at its NATIVE resolution (never upscaled). The supplied profile is a
    "low size" export, so most photos are 150-770 px wide. Replace the files in
    public/media with the original high-resolution photography before launch;
    keep the same file names and re-run `media.generated.ts` generation.
  * Crops the client-logo page and removes the white tile background
    (colour-to-alpha) so logos can be shown as monochrome silhouettes.
  * Renders the three registration documents with sensitive numbers, QR codes
    and personal names REDACTED (blurred) for public preview.
  * Writes src/content/media.generated.ts — a registry of every asset with its
    intrinsic size and a tiny blur placeholder.
"""
import base64
import io
import json
import os
import sys

import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
MEDIA = os.path.join(PUBLIC, "media")

# --------------------------------------------------------------------------
# Photo mapping: media id -> (pdf xref, options)
# Page numbers refer to the 16-page company profile.
# --------------------------------------------------------------------------
PHOTOS = {
    # Cover / atmosphere (p.1-2) — appear to be stock / illustrative imagery
    "site/riyadh-night": 10486,
    "site/laser-sparks": 10502,
    "site/laser-head": 10497,
    "site/steel-frame-dusk": 10487,
    "site/scaffold-silhouettes": 10500,
    "site/welder-sparks": 10501,
    "site/steel-beams-hall": 1959,
    "site/site-engineers": 1960,
    # Services (p.3-6)
    "services/cnc-bending-1": 3931,
    "services/cnc-bending-2": 3933,
    "services/cnc-bending-3": 3930,
    "services/steel-structures-1": 3936,
    "services/steel-structures-2": 3937,
    "services/steel-structures-3": 3935,
    "services/steel-structures-4": 3938,
    "services/fabrication-workshop": 5907,
    "services/fabrication-grinding": 6546,
    "services/fabrication-welding": 5909,
    "services/fabrication-laser-welding": 5908,
    "services/fabrication-cut-sheets": 5911,
    "services/fabrication-perforated-beams": 5906,
    "services/engraving-nameplates": 5912,
    "services/engraving-wood": 5904,
    "services/engraving-rotary": 5902,
    "services/scaffolding-1": 5921,
    "services/scaffolding-2": 5922,
    "services/scaffolding-3": 5920,
    "services/scaffolding-4": 5918,
    "services/scaffolding-5": 5917,
    "services/scaffolding-props": 5919,
    # Machinery (p.7) — transparent cut-outs
    "machines/tube-cutting-12kw": 5928,
    "machines/press-brake": 5930,
    "machines/fiber-laser-combo-12kw": 5932,
    "machines/fiber-laser-6kw": 5934,
    "machines/fiber-laser-3kw": 5936,
    "machines/laser-welding": 5938,
    # Work gallery (p.3, p.8-11)
    "projects/chandelier-1": 5949,
    "projects/lattice-cubes-1": 5943,
    "projects/lighting-tree-1": 5950,
    "projects/tulip-roundabout-1": 5944,
    "projects/tulip-roundabout-2": 5946,
    "projects/clock-tower-1": 3922,
    "projects/clock-tower-2": 5945,
    "projects/clock-tower-3": 5956,
    "projects/wave-sculpture-1": 5952,
    "projects/wave-sculpture-2": 5953,
    "projects/wave-sculpture-3": 5954,
    "projects/wheat-monument-1": 5951,
    "projects/wheat-monument-2": 5947,
    "projects/wheat-monument-3": 5948,
    "projects/dome-finial-1": 5971,
    "projects/dome-finial-2": 5961,
    "projects/gateway-signs-1": 5973,
    "projects/gateway-signs-2": 5972,
    "projects/gateway-signs-3": 5974,
    "projects/heritage-cannons-1": 5963,
    "projects/heritage-cannons-2": 5975,
    "projects/heritage-cannons-3": 5964,
    "projects/heritage-cannons-4": 5965,
    "projects/laser-cut-bench-1": 5968,
    "projects/calligraphy-sculptures-1": 5966,
    "projects/stainless-landmark-1": 5970,
    "projects/laser-cut-components-1": 5969,
    "projects/perforated-canopy-1": 5962,
    "projects/seed-sculpture-1": 5980,
    "projects/palm-canopies-1": 5987,
    "projects/car-park-shades-1": 5989,
    "projects/car-park-shades-2": 5990,
    "projects/leaf-sculpture-1": 5981,
    "projects/leaf-sculpture-2": 5984,
    "projects/billboard-structure-1": 5985,
    "projects/perforated-seating-1": 5991,
    "projects/perforated-seating-2": 5982,
    "projects/geometric-lanterns-1": 5986,
    "projects/tree-grate-1": 5983,
    "projects/screen-enclosures-1": 6010,
    "projects/screen-enclosures-2": 6004,
    "projects/emblem-sculptures-1": 6002,
    "projects/emblem-sculptures-2": 6003,
    "projects/vision-globe-1": 6012,
    "projects/vision-globe-2": 6011,
    "projects/litter-bins-1": 6005,
    "projects/litter-bins-2": 6006,
    "projects/litter-bins-3": 6007,
    "projects/sculpture-fabrication-1": 6013,
    "projects/sculpture-fabrication-2": 5999,
    "projects/perforated-beams-1": 6001,
    "projects/perforated-beams-2": 6000,
    "projects/stainless-handrails-1": 5997,
    "projects/curved-frames-1": 6008,
    "projects/canopy-tree-1": 3921,
    "projects/suspended-lantern-1": 6545,
    "projects/tower-replica-1": 3923,
}

# Crops applied after extraction, as fractions (left, top, right, bottom).
CROPS = {
    # Removes a camera GPS/time stamp printed across the top of the photo.
    "projects/screen-enclosures-2": (0.0, 0.2, 1.0, 1.0),
}

# Client logo grid on p.12, row-major (3 columns x 7 rows)
CLIENTS = [
    "alfanar", "alkharayef", "arcoma",
    "obeikan", "rakayiz", "lamsat-injaz",
    "btt", "manar-alomran", "aitco",
    "raqyah", "sahar-alriyadh", "atlas",
    "al-bereik", "metal-details", "steco",
    "trolley-carriage", "tbk-metal", "ledco",
    "ami", "isf", "ssf",
]

# Certificate documents. Boxes are in pixels of a 200 dpi page render.
# "redact" boxes cover numbers, barcodes, QR codes and personal names.
CERTIFICATES = {
    "commercial-registration-ar": {
        "page": 13,
        "crop": (233, 373, 1420, 1212),
        "redact": [(300, 568, 691, 1012), (935, 748, 1105, 802)],
    },
    "commercial-registration-en": {
        "page": 13,
        "crop": (233, 1271, 1420, 2110),
        "redact": [(550, 1566, 715, 1626), (845, 1432, 1344, 1929)],
    },
    "vat-registration": {
        "page": 14,
        "crop": (213, 336, 1467, 2112),
        "redact": [
            (298, 352, 572, 418),
            (368, 438, 508, 558),
            (596, 1050, 1086, 1117),
            (596, 1206, 1086, 1275),
            (596, 1285, 1086, 1354),
            (796, 2000, 884, 2090),
        ],
    },
    "commercial-activity-licence": {
        "page": 15,
        "crop": (198, 336, 1452, 2112),
        "redact": [
            (728, 384, 920, 574),
            (350, 682, 1300, 752),
            (500, 832, 626, 878),
            (1008, 832, 1160, 878),
            (688, 1047, 962, 1090),
            (752, 1568, 898, 1710),
        ],
    },
}


def ensure_dir(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def pixmap_to_pil(doc, xref):
    base = doc.extract_image(xref)
    smask = base.get("smask", 0)
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.colorspace and pix.colorspace.n != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    if smask:
        mask = pymupdf.Pixmap(doc, smask)
        pix = pymupdf.Pixmap(pix, mask)
    mode = "RGBA" if pix.alpha else "RGB"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    if img.mode == "RGBA" and np.array(img)[:, :, 3].min() >= 250:
        img = img.convert("RGB")  # soft mask was fully opaque
    return img


def trim_white_bars(img, threshold=245, coverage=0.97):
    """Remove uniform white letterbox bars around a photo."""
    a = np.asarray(img.convert("RGB")).astype(int)
    white = a.min(axis=2) > threshold
    cols = np.where(white.mean(axis=0) < coverage)[0]
    rows = np.where(white.mean(axis=1) < coverage)[0]
    if len(cols) == 0 or len(rows) == 0:
        return img
    return img.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1))


def remove_baked_shadow(img):
    """Drop the soft grey floor shadow some product cut-outs carry in their alpha."""
    a = np.asarray(img.convert("RGBA")).astype(np.float64)
    lum = a[:, :, :3].mean(axis=2)
    shadow = (a[:, :, 3] < 200) & (lum < 95)
    a[:, :, 3] = np.where(shadow, 0, a[:, :, 3])
    return Image.fromarray(a.round().astype(np.uint8), "RGBA")


def blur_data_url(img):
    thumb = img.copy()
    thumb.thumbnail((16, 16))
    buf = io.BytesIO()
    if thumb.mode == "RGBA":
        thumb.save(buf, "WEBP", quality=40, alpha_quality=40)
    else:
        thumb.convert("RGB").save(buf, "WEBP", quality=40)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def save_webp(img, media_id, lossless=False, quality=84):
    rel = f"/media/{media_id}.webp"
    out = os.path.join(PUBLIC, rel.lstrip("/"))
    ensure_dir(out)
    if lossless:
        img.save(out, "WEBP", lossless=True, method=6)
    elif img.mode == "RGBA":
        img.save(out, "WEBP", quality=quality, alpha_quality=100, method=6)
    else:
        img.convert("RGB").save(out, "WEBP", quality=quality, method=6)
    return {
        "src": rel,
        "width": img.width,
        "height": img.height,
        "blurDataURL": blur_data_url(img),
    }


def color_to_alpha_white(img):
    """GIMP-style colour-to-alpha against white: exact on light backgrounds."""
    a = np.asarray(img.convert("RGB")).astype(np.float64) / 255.0
    alpha = 1.0 - a.min(axis=2)
    safe = np.where(alpha > 1e-6, alpha, 1.0)
    rgb = 1.0 - (1.0 - a) / safe[..., None]
    rgb = np.clip(rgb, 0, 1)
    out = np.dstack([rgb, alpha]) * 255.0
    res = Image.fromarray(out.round().astype(np.uint8), "RGBA")
    bbox = Image.fromarray((alpha * 255 > 10).astype(np.uint8) * 255).getbbox()
    if bbox:
        res = res.crop(bbox)
    return res


def mono_silhouette(logo):
    """Black silhouette with alpha normalised, so pale logos read as strongly as dark ones."""
    alpha = np.asarray(logo)[:, :, 3].astype(np.float64) / 255.0
    ref = np.percentile(alpha[alpha > 0.02], 97) if (alpha > 0.02).any() else 1.0
    alpha = np.clip(alpha / max(ref, 0.05), 0, 1) ** 0.8
    out = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    out[:, :, 3] = (alpha * 255).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def extract_clients(doc):
    page = doc[11]
    pix = page.get_pixmap(dpi=300)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    a = np.asarray(img).astype(int)
    white = a.min(axis=2) > 235
    h, w = white.shape
    # Tiles are the large white rounded rectangles; find column / row bands.
    col_profile = white[int(h * 0.15): int(h * 0.95)].mean(axis=0) > 0.35
    row_profile = white[:, int(w * 0.08): int(w * 0.92)].mean(axis=1) > 0.35

    def bands(profile, min_len):
        out, start = [], None
        for i, v in enumerate(profile):
            if v and start is None:
                start = i
            elif not v and start is not None:
                if i - start >= min_len:
                    out.append((start, i))
                start = None
        if start is not None and len(profile) - start >= min_len:
            out.append((start, len(profile)))
        return out

    cols = bands(col_profile, int(w * 0.12))
    rows = bands(row_profile, int(h * 0.04))
    rows = [r for r in rows if r[0] > h * 0.12]  # skip the page title
    assert len(cols) == 3, cols
    assert len(rows) == 7, rows
    registry = {}
    for r_i, (y0, y1) in enumerate(rows):
        for c_i, (x0, x1) in enumerate(cols):
            name = CLIENTS[r_i * 3 + c_i]
            inset = 26
            tile = img.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset))
            logo = color_to_alpha_white(tile)
            logo.thumbnail((520, 240), Image.LANCZOS)
            registry[f"clients/{name}"] = save_webp(logo, f"clients/{name}", lossless=True)
            registry[f"clients/{name}-mono"] = save_webp(mono_silhouette(logo), f"clients/{name}-mono", lossless=True)
    return registry


def extract_certificates(doc):
    registry = {}
    for name, spec in CERTIFICATES.items():
        page = doc[spec["page"] - 1]
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        for x0, y0, x1, y1 in spec["redact"]:
            # Solid, hatched block: nothing of the original survives.
            w, h = x1 - x0, y1 - y0
            block = Image.new("RGB", (w, h), (226, 224, 219))
            bd = ImageDraw.Draw(block)
            for off in range(-h, w, 14):
                bd.line((off, 0, off + h, h), fill=(205, 202, 196), width=2)
            bd.rectangle((0, 0, w - 1, h - 1), outline=(180, 177, 171), width=2)
            img.paste(block, (x0, y0))
        doc_img = img.crop(spec["crop"])
        preview = doc_img.copy()
        preview.thumbnail((1100, 1600), Image.LANCZOS)
        registry[f"certificates/{name}"] = save_webp(preview, f"certificates/{name}", quality=82)
        thumb = doc_img.copy()
        thumb.thumbnail((560, 800), Image.LANCZOS)
        thumb = thumb.filter(ImageFilter.GaussianBlur(2.2))
        registry[f"certificates/{name}-thumb"] = save_webp(thumb, f"certificates/{name}-thumb", quality=70)
    return registry


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    profile = pymupdf.open(sys.argv[1])
    registry = {}
    for media_id, xref in PHOTOS.items():
        img = pixmap_to_pil(profile, xref)
        if img.mode == "RGB":
            img = trim_white_bars(img)
        if media_id.startswith("machines/") and img.mode == "RGBA":
            img = remove_baked_shadow(img)
        if media_id in CROPS:
            l, t, r, b = CROPS[media_id]
            img = img.crop((round(img.width * l), round(img.height * t), round(img.width * r), round(img.height * b)))
        registry[media_id] = save_webp(img, media_id)
    registry.update(extract_clients(profile))
    registry.update(extract_certificates(profile))

    out = os.path.join(ROOT, "src", "content", "media.generated.ts")
    ensure_dir(out)
    with open(out, "w") as f:
        f.write("// AUTO-GENERATED by scripts/extract-profile-assets.py — do not edit by hand.\n")
        f.write("// Intrinsic sizes + blur placeholders for every extracted asset.\n\n")
        f.write("export const mediaRegistry = ")
        f.write(json.dumps(dict(sorted(registry.items())), indent=2))
        f.write(" as const;\n\nexport type MediaId = keyof typeof mediaRegistry;\n")
    print(f"wrote {len(registry)} assets")


if __name__ == "__main__":
    main()
