/*
 * An unknown project (/{locale}/projects/{unknown}) gets this design's localized 404 — the same page as any unknown
 * address (the (missing) group's not-found.tsx), with a real 404 status. Like the service pages' boundary, it sits
 * above the project pages only, so its 404 page rides in their page data and in no other page's.
 */
export { default, generateMetadata } from "../../(missing)/not-found";
