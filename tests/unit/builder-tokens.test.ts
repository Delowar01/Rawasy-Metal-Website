/**
 * Page builder (A5) — the design inspector's contrast rule (brief §23–§24) decides on colours written in
 * `src/server/builder/design.ts` (`TOKENS`). They must be the colours the preview actually draws: the Modern Commerce
 * tokens in `system.css` (light on `.mc`, dark under `html[data-theme="dark"] .mc`) and the dark panel's tone values in
 * `blocks.css`. Any drift — a token changed in the stylesheet and not here, or the other way round — fails this test, so
 * the AA decision can never be taken on colours nobody sees.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { APPEARANCE, AA, appearanceContrast, SURFACES, TOKENS, TONES } from "../../src/server/builder/design.ts";
import { toneAttr } from "../../src/server/builder/view.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const SYSTEM = readFileSync(join(ROOT, "src/components/commerce/system.css"), "utf8");
const BLOCKS = readFileSync(join(ROOT, "src/components/builder/blocks.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `selector` (its own braces, comments removed). */
function block(css: string, selector: string): Map<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = clean.search(new RegExp(`(^|[\\s}])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`));
  assert.ok(at >= 0, `no rule ${selector}`);
  const open = clean.indexOf("{", at);
  let depth = 0;
  let end = open;
  for (; end < clean.length; end++) {
    if (clean[end] === "{") depth++;
    if (clean[end] === "}" && --depth === 0) break;
  }
  const body = clean.slice(open + 1, end);
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim().toLowerCase());
  return out;
}

const light = block(SYSTEM, ".mc");
const dark = block(SYSTEM, 'html[data-theme="dark"] .mc');
/** A token in a theme: the dark rule redefines some names and inherits the rest from `.mc`. */
const token = (theme: "light" | "dark", name: string) => (theme === "dark" ? (dark.get(name) ?? light.get(name)) : light.get(name));

const SURFACE_VARS = { plain: "--bg", muted: "--bg-alt", raised: "--surface", raised2: "--surface-2", dark: "--navy" } as const;
const TEXT_VARS = { ink: "--ink", ink2: "--ink-2", onDark: "--on-dark", onDark2: "--on-dark-2" } as const;
const TONE_VARS = { steel: "--steel", teal: "--teal", brass: "--brass", "orange-accent": "--brand-ink" } as const;

describe("design tokens (§23–§24): the contrast rule decides on the colours the preview draws", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: surfaces, text and tones equal system.css`, () => {
      for (const [key, name] of Object.entries(SURFACE_VARS)) assert.equal(TOKENS[theme].surface[key as keyof typeof SURFACE_VARS], token(theme, name), `${theme} surface ${key} (${name})`);
      for (const [key, name] of Object.entries(TEXT_VARS)) assert.equal(TOKENS[theme].text[key as keyof typeof TEXT_VARS], token(theme, name), `${theme} text ${key} (${name})`);
      for (const [key, name] of Object.entries(TONE_VARS)) assert.equal(TOKENS[theme].tone[key as keyof typeof TONE_VARS], token(theme, name), `${theme} tone ${key} (${name})`);
    });
  }

  test("on the dark panel a tone's text takes the dark theme's value, as blocks.css sets it", () => {
    for (const tone of TONES) {
      const attr = toneAttr(tone);
      const rule = new RegExp(`\\.mc \\.gb\\[data-tone="${attr}"\\] \\.gb-dark \\{ --tone-ink: (#[0-9a-f]{6}); \\}`);
      const found = rule.exec(BLOCKS);
      assert.ok(found, `blocks.css has no dark-panel value for ${tone}`);
      assert.equal(found[1], TOKENS.dark.tone[tone], tone);
    }
  });

  test("every tone attribute the preview writes has its Modern Commerce rule", () => {
    for (const tone of TONES) assert.match(SYSTEM, new RegExp(`\\.mc \\[data-tone="${toneAttr(tone)}"\\] \\{ --tone: `), tone);
  });

  test("the dark panel is navy in both themes, with on-dark text (blocks.css)", () => {
    const panel = /\.mc \.gb-dark \{([^}]*)\}/.exec(BLOCKS.replace(/\/\*[\s\S]*?\*\//g, ""));
    assert.ok(panel);
    assert.match(panel[1], /background: var\(--navy\);/);
    assert.match(panel[1], /color: var\(--on-dark\);/);
  });

  test("every offered appearance reaches AA in both themes, computed from these tokens", () => {
    for (const surface of SURFACES) {
      for (const tone of TONES) {
        const ratio = appearanceContrast(surface, tone);
        assert.equal(APPEARANCE.has(`${surface}/${tone}`), ratio >= AA, `${surface}/${tone}: ${ratio.toFixed(3)}`);
      }
    }
    assert.ok(APPEARANCE.size > 0);
  });
});
