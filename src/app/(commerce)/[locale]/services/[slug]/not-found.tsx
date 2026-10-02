/*
 * An unknown service (/{locale}/services/{unknown}) gets this design's localized 404 — the same page as any unknown
 * address (the (missing) group's not-found.tsx), with a real 404 status. A not-found boundary must sit above the page
 * that calls notFound(); here it covers the six service pages only (Next.js carries a boundary's 404 page in the page
 * data of every page under it), never the homepage or the other pages.
 */
export { default, generateMetadata } from "../../(missing)/not-found";
