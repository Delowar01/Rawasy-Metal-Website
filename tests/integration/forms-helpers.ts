/**
 * Helpers for the A7 (forms and enquiries) integration tests: the change context, the form's input built from the
 * stored working copy, the submission service wired to the test database with a fixed token key and a temporary private
 * file store, and a valid synthetic submission. Synthetic data only ("Test …", example.test addresses).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Actor } from "../../src/server/auth/types.ts";
import type { FormsChange } from "../../src/server/forms/common.ts";
import { readForm, saveForm, setUpForm, type FormInput, type FormModel } from "../../src/server/forms/forms.ts";
import { FORM_IDS, type DeliveryMode } from "../../src/server/forms/registry.ts";
import { issueToken } from "../../src/server/enquiries/token.ts";
import { submitEnquiry, type SubmissionDeps, type SubmissionInput, type SubmissionResult } from "../../src/server/enquiries/submission.ts";
import { MediaStore } from "../../src/server/media/storage.ts";
import { query } from "./cms-helpers.ts";
import { meta, type TestEnv } from "./helpers.ts";

export const QUOTE = FORM_IDS.quote;
export const SITE_ORIGIN = "https://rawasy.example.test";
export const TOKEN_KEY = Buffer.alloc(32, 7);

export const formsChange = (env: TestEnv, actor: Actor): FormsChange => ({ deps: env.deps, actor, meta: meta() });

/** The form's full state as its page sends it. */
export function formInputOf(model: FormModel): FormInput & { settings: FormModel["settings"] } {
  return {
    expectedVersion: model.lockVersion,
    settings: structuredClone(model.settings),
    copy: { en: structuredClone(model.copy.en), ar: structuredClone(model.copy.ar) },
    fields: model.fields.map((f) => ({ id: f.id, isRequired: f.isRequired, minLength: f.minLength, maxLength: f.maxLength, texts: { en: structuredClone(f.texts.en), ar: structuredClone(f.texts.ar) } })),
    complete: { en: model.status.en === "complete", ar: model.status.ar === "complete" },
    otherUnaffected: false,
  } as FormInput & { settings: FormModel["settings"] };
}

export const quote = async (env: TestEnv) => (await readForm(env.deps.db, { id: QUOTE }))!;

/** The quote form set up (by the given Owner) and, optionally, storing submissions. */
export async function storingForm(env: TestEnv, owner: Actor, mode: DeliveryMode = "store", change: (input: ReturnType<typeof formInputOf>) => void = () => {}): Promise<FormModel> {
  const model = await quote(env);
  if (!model.setUp) await setUpForm(formsChange(env, owner), QUOTE);
  const input = formInputOf(await quote(env));
  input.settings.deliveryMode = mode;
  if (mode === "store_and_notify" && !input.settings.notificationEmails.length) input.settings.notificationEmails = ["test.office@example.test"];
  change(input);
  const saved = await saveForm(formsChange(env, owner), QUOTE, input);
  if (saved.kind !== "ok") throw new Error(`storingForm: ${JSON.stringify(saved)}`);
  return quote(env);
}

export interface SubmissionEnv {
  deps: SubmissionDeps;
  dataDir: string;
  store: MediaStore;
  close(): void;
}

export async function submissionEnv(env: TestEnv): Promise<SubmissionEnv> {
  const dataDir = mkdtempSync(join(tmpdir(), "rawasy-enquiry-test-"));
  const store = await MediaStore.open(dataDir);
  return {
    deps: { pool: env.pool, db: env.deps.db, clock: env.deps.clock, tokenKey: TOKEN_KEY, siteOrigin: SITE_ORIGIN, adminUrl: "http://localhost:3401", store: async () => store },
    dataDir,
    store,
    close: () => rmSync(dataDir, { recursive: true, force: true }),
  };
}

let ipCounter = 10;
/** A distinct documentation address per call (each submission its own rate-limit bucket unless one is given). */
export const nextIp = () => `198.51.100.${(ipCounter = (ipCounter % 250) + 1)}`;

/** A valid synthetic submission: a token issued a minute before the clock, today's required fields filled. */
export function validInput(env: TestEnv, overrides: Partial<SubmissionInput> & { fields?: Record<string, unknown> } = {}): SubmissionInput {
  const issued = new Date(env.deps.clock().getTime() - 60_000);
  const { fields, ...rest } = overrides;
  return {
    formKey: "quote",
    locale: "en",
    origin: SITE_ORIGIN,
    secFetchSite: "same-origin",
    contentLength: 2048,
    ip: nextIp(),
    userAgent: "integration-test",
    sourcePath: "/en/contact",
    files: [],
    ...rest,
    fields: {
      token: issueToken(TOKEN_KEY, "quote", issued),
      website: "",
      fullName: "Test Person",
      company: "Test Company",
      email: `test.visitor.${Math.random().toString(36).slice(2, 8)}@example.test`,
      phone: "+966 50 123 4567",
      service: "laser-cutting",
      projectType: "custom-piece",
      requirement: "Test plates, 3 mm",
      location: "Test City",
      message: "A synthetic request for the integration tests only.",
      ...fields,
    },
  };
}

export async function submit(env: TestEnv, sub: SubmissionEnv, overrides: Parameters<typeof validInput>[1] = {}): Promise<SubmissionResult> {
  return submitEnquiry(sub.deps, validInput(env, overrides));
}

export async function received(env: TestEnv, sub: SubmissionEnv, overrides: Parameters<typeof validInput>[1] = {}): Promise<{ reference: string; enquiryId: string }> {
  const result = await submit(env, sub, overrides);
  if (result.kind !== "received") throw new Error(`received: ${JSON.stringify(result)}`);
  return result;
}

export const enquiryRow = async (env: TestEnv, id: string) => (await query<Record<string, unknown>>(env, "SELECT * FROM enquiries WHERE id = ?", [id]))[0];
export const versionOf = async (env: TestEnv, id: string) => Number((await enquiryRow(env, id)).lock_version);

/** A valid one-page PDF (header and end-of-file marker). */
export function testPdf(label = "Synthetic enquiry attachment"): Buffer {
  return Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n% ${label}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, "latin1");
}
/** The first bytes of a PNG (signature and IHDR): enough for the signature check. */
export function testPng(): Buffer {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([head, Buffer.alloc(64, 1)]);
}
