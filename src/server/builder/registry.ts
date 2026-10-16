/**
 * The block registry (A5 brief §9–§10): every block type of the page builder, assembled from `blocks/*`, and the two ways
 * section data is checked against it.
 *
 * - `validate` — what an editor sends: the settings and each language's content parsed by the block's strict schemas,
 *   repeated items matched across languages, the block's own cross-field rules, depth and size bounded. Unknown block
 *   types and library-only entries cannot be validated, so they cannot be saved.
 * - `read` — what the database holds: a newer schema version than this code knows is never edited or shown (it would be
 *   read silently wrong); an older one is upcast step by step (a missing step fails closed) and the result validated
 *   again; anything invalid is reported, never rendered. Old JSON is never rewritten in place: a section is saved at
 *   the latest version only when someone edits it.
 *
 * `createRegistry` takes any list of definitions so the unit tests can exercise versions the real blocks do not have yet.
 */
import type { BlockDefinition } from "./block.ts";
import { ALL_BLOCKS } from "./blocks/index.ts";
import {
  BUILDER_LIMITS,
  contentSchemaOf,
  jsonDepth,
  LOCALES,
  parityIssues,
  settingsSchemaOf,
  type Content,
  type FieldIssue,
  type Locale,
  type Settings,
} from "./fields.ts";

export type Texts = Partial<Record<Locale, Content>>;

export type ValidateResult = { ok: true; settings: Settings; content: Texts } | { ok: false; issues: FieldIssue[] };

export type ReadResult =
  | { state: "ok"; settings: Settings; content: Texts; upcast: boolean }
  | { state: "unknown_type" }
  | { state: "not_storable" }
  | { state: "future_version"; stored: number; latest: number }
  | { state: "no_upcaster"; from: number }
  | { state: "invalid"; issues: FieldIssue[] };

/** Why a section can't be shown or edited, in the editor's words (never internal details). */
export function readProblem(result: Exclude<ReadResult, { state: "ok" }>): string {
  switch (result.state) {
    case "unknown_type":
      return "This section's block type is not known to this version of the admin.";
    case "not_storable":
      return "This section's block type cannot be stored on a page.";
    case "future_version":
      return `This section was saved with a newer block version (${result.stored}) than this admin knows (${result.latest}); it can't be edited here.`;
    case "no_upcaster":
      return `This section uses an old block version (${result.from}) that can't be upgraded automatically.`;
    case "invalid":
      return "This section's stored data doesn't match its block type.";
  }
}

const issuesOf = (error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }, prefix: string): FieldIssue[] =>
  error.issues.map((issue) => ({ path: [prefix, ...issue.path.map(String)].filter(Boolean).join("."), message: issue.message }));

export interface BlockRegistry {
  get(key: string): BlockDefinition | undefined;
  all(): readonly BlockDefinition[];
  validate(def: BlockDefinition, settings: unknown, content: Partial<Record<Locale, unknown>>): ValidateResult;
  read(key: string, version: number, settings: unknown, content: Partial<Record<Locale, unknown>>): ReadResult;
}

export function createRegistry(definitions: readonly BlockDefinition[]): BlockRegistry {
  const byKey = new Map<string, BlockDefinition>();
  for (const def of definitions) {
    if (byKey.has(def.key)) throw new Error(`Block ${def.key} is registered twice.`);
    byKey.set(def.key, def);
  }
  const schemas = new Map(definitions.map((def) => [def.key, { settings: settingsSchemaOf(def.settings), content: contentSchemaOf(def.settings, def.content) }]));

  function validate(def: BlockDefinition, rawSettings: unknown, rawContent: Partial<Record<Locale, unknown>>): ValidateResult {
    if (!def.storable) return { ok: false, issues: [{ path: "blockType", message: "This entry can't be stored as a section." }] };
    const schema = schemas.get(def.key);
    if (!schema || byKey.get(def.key) !== def) return { ok: false, issues: [{ path: "blockType", message: "Unknown block type." }] };
    const issues: FieldIssue[] = [];
    if (jsonDepth(rawSettings) > BUILDER_LIMITS.jsonDepth) issues.push({ path: "settings", message: "The settings are nested too deeply." });
    for (const locale of LOCALES) if (jsonDepth(rawContent[locale]) > BUILDER_LIMITS.jsonDepth) issues.push({ path: `content.${locale}`, message: "The text is nested too deeply." });
    if (issues.length) return { ok: false, issues };
    const settings = schema.settings.safeParse(rawSettings ?? {});
    if (!settings.success) issues.push(...issuesOf(settings.error, "settings"));
    const content: Texts = {};
    for (const locale of LOCALES) {
      const raw = rawContent[locale];
      if (raw === undefined || raw === null) continue;
      const parsed = schema.content.safeParse(raw);
      if (parsed.success) content[locale] = parsed.data as Content;
      else issues.push(...issuesOf(parsed.error, `content.${locale}`));
    }
    if (issues.length || !settings.success) return { ok: false, issues };
    const values = settings.data as Settings;
    issues.push(...parityIssues(def.settings, values, content));
    issues.push(...(def.check?.(values, content) ?? []));
    if (issues.length) return { ok: false, issues };
    const bytes = Buffer.byteLength(JSON.stringify({ settings: values, content }), "utf8");
    if (bytes > BUILDER_LIMITS.sectionBytes) {
      return { ok: false, issues: [{ path: "section", message: `This section holds too much (${Math.ceil(bytes / 1000)} KB of ${BUILDER_LIMITS.sectionBytes / 1000} KB). Split it into two sections.` }] };
    }
    return { ok: true, settings: values, content };
  }

  function read(key: string, version: number, rawSettings: unknown, rawContent: Partial<Record<Locale, unknown>>): ReadResult {
    const def = byKey.get(key);
    if (!def) return { state: "unknown_type" };
    if (!def.storable) return { state: "not_storable" };
    if (!Number.isInteger(version) || version < 1) return { state: "invalid", issues: [{ path: "schemaVersion", message: "Invalid schema version." }] };
    if (version > def.version) return { state: "future_version", stored: version, latest: def.version };
    let data = { settings: rawSettings, content: rawContent };
    for (let v = version; v < def.version; v++) {
      const step = def.upcasters[v];
      if (!step) return { state: "no_upcaster", from: v };
      try {
        data = step(structuredClone(data));
      } catch {
        return { state: "no_upcaster", from: v };
      }
    }
    const checked = validate(def, data.settings, data.content);
    if (!checked.ok) return { state: "invalid", issues: checked.issues };
    return { state: "ok", settings: checked.settings, content: checked.content, upcast: version !== def.version };
  }

  return {
    get: (key) => byKey.get(key),
    all: () => [...byKey.values()],
    validate,
    read,
  };
}

/** The registry of the page builder. */
export const REGISTRY: BlockRegistry = createRegistry(ALL_BLOCKS);

export const blockOf = (key: string) => REGISTRY.get(key);
