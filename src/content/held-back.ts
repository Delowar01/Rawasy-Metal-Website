/**
 * Release images the asset inventory keeps off every page that no content rule derives (docs/ASSET_INVENTORY.md, open
 * question 12; decision D6): the Laser Engraving images. `services/engraving-nameplates` shows third-party branding with
 * legible part and serial numbers and awaits RAWASY's permission; `services/engraving-wood` and
 * `services/engraving-rotary` are renders. Media IDs (mapped to files through the media registry). Take an ID out only
 * once RAWASY approves showing that image.
 *
 * One list for the deployment archive (scripts/package-namecheap.mjs leaves the files out) and the content import
 * (src/server/migration/importer.ts refuses to run while one is delivered): with the withheld project photos, the 13
 * held-back release files.
 */
export const HELD_BACK_MEDIA = ["services/engraving-nameplates", "services/engraving-wood", "services/engraving-rotary"] as const;
