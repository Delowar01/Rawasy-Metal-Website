/**
 * The client's IP address for rate limits, lockout evidence and the session list (A1-SECURITY-RBAC §3.4).
 *
 * Behind the host's web server the socket address is always the proxy's, so the address comes from X-Forwarded-For:
 * each trusted proxy appends the address it received the request from, so with `hops` trusted proxies the client is the
 * `hops`-th entry from the right. Entries further left were written by the client and are never trusted.
 *
 * `hops = 0` (local development, no proxy): Next.js writes the socket address into X-Forwarded-For only when the
 * request carries none (`base-server.js`, `??=`), so the right-most entry is used — a client that sends the header
 * itself chooses its address there, which is why staging and production must configure the real hop count.
 */
import { isIP } from "node:net";

/**
 * One header value (several headers are joined with commas by Node). The entry is picked by its raw position first and
 * only then validated: dropping malformed entries before counting would let a client-written entry slide into the
 * trusted position when a proxy writes something that is not an address (e.g. "unknown"). Returns null when the entry
 * at that position is not a usable address, or when there are fewer entries than trusted proxies.
 */
export function resolveClientIp(forwardedFor: string | null | undefined, hops: number): string | null {
  if (!forwardedFor) return null;
  const entries = forwardedFor.split(",");
  const index = hops === 0 ? entries.length - 1 : entries.length - hops;
  if (index < 0) return null; // fewer entries than trusted proxies: the request did not come through them
  return normalizeIp(entries[index] ?? "");
}

/** Trims, removes a port or brackets, unwraps IPv4-mapped IPv6 (::ffff:1.2.3.4), and validates. */
export function normalizeIp(raw: string): string | null {
  let value = raw.trim().replace(/^"|"$/g, "");
  if (!value) return null;
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];
  if (isIP(value) === 0) return null;
  return value.toLowerCase().slice(0, 45);
}
