/**
 * Response headers of the admin (A1-SECURITY-RBAC §4), as plain strings. Read by the proxy's admin branch; no session,
 * permission or database code is involved here (the proxy is a header boundary only).
 */

/** `/admin` and everything below it — never `/administrator` or `/en/admin`. */
export const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

/**
 * The nonce-based policy of admin pages: scripts only with this request's nonce (and what they load), styles from the
 * site's own files or with the nonce (no inline style attributes), no framing, no plugins, forms to the site only.
 * `'unsafe-eval'` only in `next dev` (React's development tooling); `upgrade-insecure-requests` only over HTTPS.
 */
export function adminContentSecurityPolicy(nonce: string, options: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** The page builder's private preview (A5): `/admin/preview/…` — its own policy below; every other admin page keeps the one above. */
export const isPreviewPath = (pathname: string) => pathname.startsWith("/admin/preview/");

/** The players and maps a preview may frame (A5 brief §19–§20): typed ids and address searches only, never an embed code. */
export const PREVIEW_FRAME_SOURCES = ["https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.google.com"] as const;

/**
 * The preview's policy (A5 brief §37–§38): the admin's nonce-based script and style rules, plus what the real public
 * components need to render as they will — inline style attributes (the components set custom properties such as a
 * reveal's delay; never a person's CSS: block settings are typed tokens), the allowlisted video and map frames, the quote
 * form's `mailto:` hand-off — and framing by the admin itself only (`frame-ancestors 'self'`). The admin's own pages are
 * not loosened: they keep `adminContentSecurityPolicy`.
 */
export function previewContentSecurityPolicy(nonce: string, options: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${PREVIEW_FRAME_SOURCES.join(" ")}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' mailto:",
    "frame-ancestors 'self'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const ADMIN_PAGE_HEADERS: Readonly<Record<string, string>> = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
};

/** A fresh nonce: 16 random bytes, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

/** The preview's headers: the admin's, framed by the same origin only (the builder's canvas). */
export const PREVIEW_PAGE_HEADERS: Readonly<Record<string, string>> = { ...ADMIN_PAGE_HEADERS, "X-Frame-Options": "SAMEORIGIN" };

/** The preview's view settings, taken from its address by the proxy and handed to the root layout as request headers. */
export const PREVIEW_HEADERS = { locale: "x-preview-locale", theme: "x-preview-theme" } as const;
