import { NextResponse, type NextRequest } from "next/server";
import { isAdminEnabled } from "@/lib/admin-gate";
import { ADMIN_PAGE_HEADERS, adminContentSecurityPolicy, createNonce, isAdminPath } from "@/lib/admin-headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";

/** Pick the best supported locale from an Accept-Language header. */
function negotiate(header: string | null): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

/**
 * Admin pages (A1-SECURITY-RBAC §4): a fresh nonce and the nonce-based CSP on the request (Next.js reads the nonce
 * from it while rendering) and on the response, plus the admin headers. Nothing else: no locale redirect, no public
 * routing, and no session or permission check — every admin page, action and handler checks those server-side.
 * Only while the admin is on (ADMIN_ENABLED, src/lib/admin-gate.ts): with it off, `/admin/**` is an unknown public
 * address like any other (the locale redirect, then the localized 404), as before A2; the admin's layout, pages and
 * actions check the gate again, so a request that reaches them some other way finds nothing either.
 */
function admin(request: NextRequest) {
  const nonce = createNonce();
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
  const policy = adminContentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === "development", https });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  for (const [name, value] of Object.entries(ADMIN_PAGE_HEADERS)) response.headers.set(name, value);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isAdminPath(pathname) && isAdminEnabled()) return admin(request);
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : negotiate(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next internals, public asset folders and metadata files.
    // Unknown URLs (even "/foo.php") are sent to /{locale}/… and get the localized 404.
    "/((?!_next/|api/|media/|brand/|og/|icon\\.svg$|apple-icon\\.png$|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$).*)",
  ],
};
