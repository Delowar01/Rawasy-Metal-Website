/**
 * What the approved public components can draw (A9 acceptance review, M-1). One definition for the two places that
 * need it:
 *
 * - the read model (`decode.ts`) leaves out a record its components cannot draw, so no page draws it half: its own page
 *   answers 404 and every list leaves it out;
 * - publication (`../publishing/validate.ts`) refuses a version the approved composition shows in a fixed place unless
 *   it can be drawn there (the homepage's two laser services, the Projects collage, the Industries strip: their pages
 *   would answer 500 otherwise), and warns for any other record that would be left out.
 *
 * Each rule answers why a record can't be drawn, or null. Media are judged present or absent here; whether a present one
 * is delivered is publication's media check (`mediaIssues`) and the read model's own registry.
 *
 * Framework-free (`.ts` imports): the integration tests and the publication services read it directly.
 */
import { serviceLooks } from "../../components/commerce/services/looks.ts";

/** A service needs its approved page design (by its address) and, unless that design shows no photograph, its two photos. */
export function serviceDrawProblem(slug: string, has: { cover: boolean; supporting: boolean }): string | null {
  const look = (serviceLooks as Record<string, { hero: string } | undefined>)[slug];
  if (!look) return "a service has an approved page design only at one of today's six service addresses";
  if (look.hero !== "plate" && !(has.cover && has.supporting)) return "its page needs its cover photo and its supporting photo";
  return null;
}

/** A machine is drawn with its photo (and with a live main service, which publication checks as a linked record). */
export const machineDrawProblem = (has: { photo: boolean }) => (has.photo ? null : "it is drawn with its photo");

/** A client is drawn as its logo. */
export const clientDrawProblem = (has: { logo: boolean }) => (has.logo ? null : "it is drawn as its logo");

/** An industry is drawn with its photo. */
export const industryDrawProblem = (has: { photo: boolean }) => (has.photo ? null : "it is drawn with its photo");

/** A certificate is drawn as its thumbnail, and its card and dialog show its first redacted preview. */
export const certificateDrawProblem = (has: { thumb: boolean; previews: number }) =>
  has.thumb && has.previews > 0 ? null : "it is drawn as its thumbnail and its first redacted preview";

/** The Projects page's collage draws a project's first photo. */
export const collageDrawProblem = (has: { photos: number }) => (has.photos > 0 ? null : "the Projects page's collage draws its first photo");
