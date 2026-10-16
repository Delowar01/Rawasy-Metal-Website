"use client";
/**
 * What every field editor of the page builder needs from its editor (A5): the records and link targets the pickers offer,
 * the media cards the section names, the page's anchors, whether editing is allowed, and the last save's messages.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { BuilderLocale, BuilderModel } from "@/server/admin/actions/builder-model";
import type { MediaCardModel } from "@/server/admin/actions/media-model";

export interface FieldEnv {
  options: BuilderModel["options"];
  links: BuilderModel["links"];
  media: Record<string, MediaCardModel>;
  /** Keeps a just-chosen media item's card for display (the server checks the item again on save). */
  remember: (card: MediaCardModel) => void;
  canUpload: boolean;
  /** The in-page anchors a link may name. */
  anchors: string[];
  disabled: boolean;
  /** The last save's messages for this section (`path`: "settings.items.2.icon", "content.ar.title" …). */
  issues: { path?: string; message: string }[];
}

const FieldEnvContext = createContext<FieldEnv | null>(null);
export const FieldEnvProvider = ({ env, children }: { env: FieldEnv; children: ReactNode }) => <FieldEnvContext value={env}>{children}</FieldEnvContext>;

export function useEnv(): FieldEnv {
  const env = useContext(FieldEnvContext);
  if (!env) throw new Error("Field editors need a FieldEnvProvider.");
  return env;
}

/** The server's messages for a path and everything under it. */
export const issuesAt = (env: FieldEnv, path: string) => env.issues.filter((i) => i.path === path || i.path?.startsWith(`${path}.`)).map((i) => i.message);

export const textDir = (locale: BuilderLocale | null) => (locale === "ar" ? { dir: "rtl" as const, lang: "ar" } : locale === "en" ? { dir: "ltr" as const, lang: "en" } : {});
