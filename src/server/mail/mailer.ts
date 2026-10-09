/**
 * Outgoing mail for A2 (invitations, password resets, security notices). A real SMTP transport is not part of A2
 * (no production mail credentials exist or are requested); the transports are:
 *
 * - `disabled` (default, and the only one outside local development): nothing is sent, `send` reports
 *   `delivered: false`, and the admin says so — it never claims that an email went out.
 * - `sink` (APP_ENV=local only: development and tests): each message is written as a JSON file to MAIL_SINK_DIR.
 *   These files hold the links the messages carry, so the sink never runs anywhere but a developer's machine.
 *
 * Message text never contains a password, TOTP secret or code; reset and invitation links carry a single-use token
 * (only its hash is stored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MailTransport } from "../config/env.ts";
import { ulid } from "../security/ids.ts";

export type MailKind = "invitation" | "password_reset" | "security_notice";

export interface MailMessage {
  kind: MailKind;
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  readonly transport: MailTransport;
  /** True when messages actually leave the app (to the local sink in development). */
  readonly configured: boolean;
  send(message: MailMessage): Promise<{ delivered: boolean }>;
}

export const disabledMailer: Mailer = {
  transport: "disabled",
  configured: false,
  async send() {
    return { delivered: false };
  },
};

let sinkSequence = 0;

export function sinkMailer(directory: string, clock: () => Date = () => new Date()): Mailer {
  return {
    transport: "sink",
    configured: true,
    async send(message) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const at = clock();
      // Time, then a per-process sequence: file names sort in sending order even within one millisecond.
      const file = join(directory, `${at.getTime()}-${String(++sinkSequence).padStart(6, "0")}-${ulid(at.getTime())}.json`);
      writeFileSync(file, JSON.stringify({ ...message, sentAt: at.toISOString() }, null, 2), { mode: 0o600 });
      return { delivered: true };
    },
  };
}

/** Sends a notice without letting a mail problem fail the operation that triggered it (nothing about it is logged). */
export async function sendQuietly(mailer: Mailer, message: MailMessage): Promise<{ delivered: boolean }> {
  try {
    return await mailer.send(message);
  } catch {
    return { delivered: false };
  }
}

export function createMailer(config: { transport: MailTransport; sinkDir: string }, clock?: () => Date): Mailer {
  return config.transport === "sink" ? sinkMailer(config.sinkDir, clock) : disabledMailer;
}

const SIGNATURE = "\n\n— RAWASY Metal admin\nIf you did not expect this message, you can ignore it.";

export const mailTemplates = {
  invitation: (to: string, name: string, link: string, expiresHours: number): MailMessage => ({
    kind: "invitation",
    to,
    subject: "Your invitation to the RAWASY admin",
    text: `Hello ${name},\n\nYou have been invited to the RAWASY Metal website admin. Choose your password here (the link works once and expires in ${expiresHours} hours):\n\n${link}${SIGNATURE}`,
  }),
  ownerSetup: (to: string, name: string, link: string, expiresMinutes: number): MailMessage => ({
    kind: "invitation",
    to,
    subject: "Set up the RAWASY admin Owner account",
    text: `Hello ${name},\n\nChoose the Owner account's password here (the link works once and expires in ${expiresMinutes} minutes):\n\n${link}${SIGNATURE}`,
  }),
  passwordReset: (to: string, name: string, link: string, expiresMinutes: number): MailMessage => ({
    kind: "password_reset",
    to,
    subject: "Reset your RAWASY admin password",
    text: `Hello ${name},\n\nSomeone asked to reset the password of this admin account. Choose a new password here (the link works once and expires in ${expiresMinutes} minutes):\n\n${link}\n\nAll your signed-in sessions end when the password changes.${SIGNATURE}`,
  }),
  securityNotice: (to: string, name: string, what: string): MailMessage => ({
    kind: "security_notice",
    to,
    subject: "Security change on your RAWASY admin account",
    text: `Hello ${name},\n\n${what}\n\nIf this was not you, contact the site Owner at once.${SIGNATURE}`,
  }),
};
