/**
 * Password rules (A1-SECURITY-RBAC §3.2, after NIST SP 800-63B): 12 to 128 characters, any characters, no composition
 * rules and no forced expiry; refused when it is a known common or breached password (bundled list), a run of one
 * character, a simple sequence, or built from the account's own email or name. No third-party breach service is called.
 */
import { COMMON_PASSWORDS } from "./common-passwords.generated.ts";
import { normalizePassword } from "./password.ts";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export type PasswordProblem = "too_short" | "too_long" | "common" | "repetitive" | "sequence" | "personal";

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  too_short: `Use at least ${PASSWORD_MIN} characters. A few unrelated words make a strong, memorable password.`,
  too_long: `Use at most ${PASSWORD_MAX} characters.`,
  common: "This password appears in lists of common or leaked passwords. Choose another one.",
  repetitive: "This password repeats the same few characters. Choose something less predictable.",
  sequence: "This password is a simple sequence (like 123456… or qwerty…). Choose something less predictable.",
  personal: "Don't build the password from your name, your email address or the company name.",
};

let common: Set<string> | null = null;
const commonSet = () => (common ??= new Set(COMMON_PASSWORDS));

const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "01234567890",
  "qwertyuiopasdfghjklzxcvbnm",
  "1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p",
];

function isSequence(value: string): boolean {
  const compact = value.replace(/[\s._-]/g, "");
  if (compact.length < 8) return false;
  for (const base of SEQUENCES) {
    const forward = base + base;
    const backward = [...forward].reverse().join("");
    if (forward.includes(compact) || backward.includes(compact)) return true;
  }
  return false;
}

/** Checks a candidate password. Returns the first problem found, or null when it may be used. */
export function checkPassword(password: string, context: { email?: string; name?: string } = {}): PasswordProblem | null {
  const normalized = normalizePassword(password);
  const length = [...normalized].length;
  if (length < PASSWORD_MIN) return "too_short";
  if (length > PASSWORD_MAX) return "too_long";
  const lower = normalized.toLowerCase();
  if (commonSet().has(lower)) return "common";
  if (new Set(lower).size <= 3) return "repetitive";
  if (isSequence(lower)) return "sequence";
  const compact = lower.replace(/[\s._-]/g, "");
  const personal = ["rawasy", "rawasymetal"];
  const local = context.email?.split("@")[0]?.toLowerCase().replace(/[\s._+-]/g, "");
  if (local && local.length >= 4) personal.push(local);
  for (const part of context.name?.toLowerCase().split(/\s+/) ?? []) if (part.length >= 4) personal.push(part);
  // Refused when the password is a personal word plus at most a few other characters (e.g. "rawasymetal2026").
  for (const word of personal) if (compact.includes(word) && compact.length - word.length <= 6) return "personal";
  return null;
}
