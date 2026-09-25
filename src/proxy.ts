import { NextResponse, type NextRequest } from "next/server";
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
 * Theme lab: isolated design previews at /theme-lab/{locale}/modern-commerce-{a|a-v2|b|c}.
 * Never indexed, never in the sitemap or navigation; removed once a theme is chosen.
 */
const LAB = "/theme-lab";
const LAB_DEFAULT = "modern-commerce-a-v2";

function themeLab(request: NextRequest, locale: () => Locale) {
  const rest = request.nextUrl.pathname.slice(LAB.length).split("/").filter(Boolean);
  if (isLocale(rest[0]) && rest.length > 1) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const url = request.nextUrl.clone();
  const target = isLocale(rest[0]) ? rest[0] : locale();
  const page = isLocale(rest[0]) ? rest.slice(1) : rest;
  url.pathname = `${LAB}/${target}/${page.length ? page.join("/") : LAB_DEFAULT}`;
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const pick = () => {
    const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
    return isLocale(cookie) ? cookie : negotiate(request.headers.get("accept-language"));
  };
  if (pathname === LAB || pathname.startsWith(`${LAB}/`)) return themeLab(request, pick);

  const locale = pick();
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
