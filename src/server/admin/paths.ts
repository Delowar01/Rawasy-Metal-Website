/** Admin paths shared by pages and actions. */

const ENTRY = /^\/admin\/(login|reset|invite)(\/|$)/;

/** Where to go after signing in: only an admin page of this site (never another origin, never the sign-in pages). */
export function safeNext(value: unknown, fallback = "/admin"): string {
  if (typeof value !== "string" || value.length > 200) return fallback;
  if (!/^\/admin(\/[A-Za-z0-9._~-]+)*\/?$/.test(value) || value.includes("..") || ENTRY.test(value)) return fallback;
  return value;
}

export const loginPath = (next?: string) => {
  const target = safeNext(next, "");
  return target && target !== "/admin" ? `/admin/login?next=${encodeURIComponent(target)}` : "/admin/login";
};
