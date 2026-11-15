/**
 * The admin's texts about the public website for this release (src/server/admin/public-effect.ts): chosen once by the
 * build's content source, which `@/content/load` resolves at build (A9.4).
 */
import { contentIsStatic } from "@/content/load";
import { publicEffectTexts } from "@/server/admin/public-effect";

export const PUBLIC_EFFECT = publicEffectTexts(!contentIsStatic);
