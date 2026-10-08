/** A font file imported as a static asset: Turbopack returns its public URL (/_next/static/media/<name>.<hash>.woff2). */
declare module "*.woff2" {
  const url: string;
  export default url;
}
