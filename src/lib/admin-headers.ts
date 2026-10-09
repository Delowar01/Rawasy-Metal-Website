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
