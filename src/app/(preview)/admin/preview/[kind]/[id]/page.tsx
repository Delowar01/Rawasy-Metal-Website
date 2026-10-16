import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewCanvas } from "@/components/builder/PreviewCanvas";
import { authDeps, guarded } from "@/server/admin/context";
import { requireActor } from "@/server/admin/guards";
import { loadPreview, type PreviewDevice, type PreviewKind } from "@/server/builder/preview";

/*
 * /admin/preview/{page|service|reusable}/{id} (A5 brief §36–§40): a working page, service page or reusable section as the
 * website would draw it after the A9 cutover. Private: the admin must be on (the layout), the person signed in with every
 * step done (`requireActor`: otherwise the sign-in page — a new tab needs the session too; no bearer link exists) and
 * holding `content.view` and `preview.use` (the registry's permissions, never a role name). An unknown kind or id, or a
 * record in the Trash, is "not found". `locale`, `theme`, `device` and `frame` (the builder's canvas) come from the
 * address; `device` leaves out the sections hidden on that screen size.
 */

const KINDS: readonly PreviewKind[] = ["page", "service", "reusable"];
const DEVICES: readonly PreviewDevice[] = ["desktop", "tablet", "mobile"];
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const metadata: Metadata = { title: "Preview" };

export default async function PreviewPage({ params, searchParams }: PageProps<"/admin/preview/[kind]/[id]">) {
  const { actor } = await requireActor();
  if (!actor.permissions.has("content.view") || !actor.permissions.has("preview.use")) notFound();
  const { kind, id } = await params;
  if (!(KINDS as readonly string[]).includes(kind) || !ULID.test(id)) notFound();
  const query = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const locale = one(query.locale) === "ar" ? "ar" : "en";
  const device = (DEVICES as readonly string[]).includes(one(query.device) ?? "") ? (one(query.device) as PreviewDevice) : "desktop";
  const frame = one(query.frame) === "1";
  const model = await guarded(() => loadPreview(authDeps().db, kind as PreviewKind, id, { locale, device }));
  if (!model) notFound();
  return <PreviewCanvas model={model} frame={frame} />;
}
