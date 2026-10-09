/**
 * The A2 tables of the A1 schema (A1-DATABASE-SCHEMA §7, "Locales, users and access control"): locales, users, roles,
 * permissions, role_permissions, user_roles, sessions, auth_tokens, user_mfa, user_recovery_codes, login_attempts,
 * rate_limits and audit_events. Nothing of A3–A9 lives here. `locales` is part of A2 because `users.admin_locale`
 * refers to it.
 *
 * This file is the source of truth for `drizzle-kit generate` (never `push` or `pull`); the generated SQL in `drizzle/`
 * is reviewed (table options added: InnoDB, utf8mb4, utf8mb4_unicode_520_ci) and applied by `scripts/db-migrate.mjs`.
 * Queries use Drizzle's core builder only: no relations are declared and `drizzle()` never receives this schema.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  asciiColumn,
  binaryTextColumn,
  hashColumn,
  instant,
  jsonColumn,
  localeColumn,
  ulidColumn,
  varbinaryColumn,
} from "./columns.ts";

const now3 = sql`CURRENT_TIMESTAMP(3)`;

export const USER_STATUSES = ["invited", "active", "disabled"] as const;
export const SESSION_REVOKE_REASONS = [
  "logout",
  "revoked",
  "password_changed",
  "role_changed",
  "user_disabled",
  "rotated",
  "restore",
] as const;
export const TOKEN_PURPOSES = ["password_reset", "invitation", "email_change", "owner_setup"] as const;
export const LOGIN_FAILURE_REASONS = ["bad_credentials", "locked", "disabled", "mfa_failed", "rate_limited"] as const;
export const AUDIT_ACTOR_TYPES = ["user", "system", "cli"] as const;
export const AUDIT_OUTCOMES = ["success", "denied", "failed"] as const;

// ---------------------------------------------------------------------------------------------------------------------

export const locales = mysqlTable("locales", {
  code: localeColumn("code").primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  nativeName: varchar("native_name", { length: 60 }).notNull(),
  direction: mysqlEnum("direction", ["ltr", "rtl"]).notNull(),
  htmlLang: varchar("html_lang", { length: 16 }).notNull(),
  ogLocale: varchar("og_locale", { length: 16 }).notNull(),
  isDefault: boolean("is_default").notNull(),
  isEnabled: boolean("is_enabled").notNull(),
  isRequired: boolean("is_required").notNull(),
  sortOrder: smallint("sort_order").notNull(),
});

export const users = mysqlTable(
  "users",
  {
    id: ulidColumn("id").primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    emailNormalized: binaryTextColumn("email_normalized", { length: 254 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    status: mysqlEnum("status", USER_STATUSES).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    passwordChangedAt: instant("password_changed_at"),
    failedLoginCount: smallint("failed_login_count", { unsigned: true }).notNull().default(0),
    lockedUntil: instant("locked_until"),
    lastLoginAt: instant("last_login_at"),
    adminLocale: localeColumn("admin_locale"),
    disabledAt: instant("disabled_at"),
    disabledBy: ulidColumn("disabled_by"),
    createdAt: instant("created_at").notNull().default(now3),
    createdBy: ulidColumn("created_by"),
    updatedAt: instant("updated_at").notNull().default(now3),
    updatedBy: ulidColumn("updated_by"),
    deletedAt: instant("deleted_at"),
    deletedBy: ulidColumn("deleted_by"),
  },
  (t) => [
    uniqueIndex("uq_users_email").on(t.emailNormalized),
    index("ix_users_status").on(t.status),
    index("ix_users_deleted").on(t.deletedAt),
    foreignKey({ name: "fk_users_locale", columns: [t.adminLocale], foreignColumns: [locales.code] }).onDelete("set null"),
    foreignKey({ name: "fk_users_disabled_by", columns: [t.disabledBy], foreignColumns: [t.id] }).onDelete("set null"),
    foreignKey({ name: "fk_users_created_by", columns: [t.createdBy], foreignColumns: [t.id] }).onDelete("set null"),
    foreignKey({ name: "fk_users_updated_by", columns: [t.updatedBy], foreignColumns: [t.id] }).onDelete("set null"),
    foreignKey({ name: "fk_users_deleted_by", columns: [t.deletedBy], foreignColumns: [t.id] }).onDelete("set null"),
  ],
);

export const roles = mysqlTable(
  "roles",
  {
    key: asciiColumn("key", { length: 32 }).primaryKey(),
    name: varchar("name", { length: 60 }).notNull(),
    description: varchar("description", { length: 300 }),
    rank: smallint("rank").notNull(),
    isSystem: boolean("is_system").notNull(),
    createdAt: instant("created_at").notNull().default(now3),
    createdBy: ulidColumn("created_by"),
    updatedAt: instant("updated_at").notNull().default(now3),
    updatedBy: ulidColumn("updated_by"),
  },
  (t) => [
    foreignKey({ name: "fk_roles_created_by", columns: [t.createdBy], foreignColumns: [users.id] }).onDelete("set null"),
    foreignKey({ name: "fk_roles_updated_by", columns: [t.updatedBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

export const permissions = mysqlTable("permissions", {
  key: asciiColumn("key", { length: 64 }).primaryKey(),
  resource: asciiColumn("resource", { length: 32 }).notNull(),
  action: asciiColumn("action", { length: 32 }).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  isSensitive: boolean("is_sensitive").notNull(),
});

export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    roleKey: asciiColumn("role_key", { length: 32 }).notNull(),
    permissionKey: asciiColumn("permission_key", { length: 64 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleKey, t.permissionKey] }),
    index("ix_role_permissions_permission").on(t.permissionKey),
    foreignKey({ name: "fk_rp_role", columns: [t.roleKey], foreignColumns: [roles.key] }).onDelete("cascade"),
    foreignKey({ name: "fk_rp_permission", columns: [t.permissionKey], foreignColumns: [permissions.key] }).onDelete("cascade"),
  ],
);

export const userRoles = mysqlTable(
  "user_roles",
  {
    userId: ulidColumn("user_id").notNull(),
    roleKey: asciiColumn("role_key", { length: 32 }).notNull(),
    grantedBy: ulidColumn("granted_by"),
    grantedAt: instant("granted_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleKey] }),
    index("ix_user_roles_role").on(t.roleKey),
    foreignKey({ name: "fk_ur_user", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_ur_role", columns: [t.roleKey], foreignColumns: [roles.key] }).onDelete("restrict"),
    foreignKey({ name: "fk_ur_granted_by", columns: [t.grantedBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: ulidColumn("id").primaryKey(),
    userId: ulidColumn("user_id").notNull(),
    tokenHash: hashColumn("token_hash").notNull(),
    createdAt: instant("created_at").notNull(),
    lastSeenAt: instant("last_seen_at").notNull(),
    idleExpiresAt: instant("idle_expires_at").notNull(),
    absoluteExpiresAt: instant("absolute_expires_at").notNull(),
    reauthenticatedAt: instant("reauthenticated_at").notNull(),
    mfaVerifiedAt: instant("mfa_verified_at"),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    revokedAt: instant("revoked_at"),
    revokedReason: mysqlEnum("revoked_reason", SESSION_REVOKE_REASONS),
    replacedById: ulidColumn("replaced_by_id"),
  },
  (t) => [
    uniqueIndex("uq_sessions_token").on(t.tokenHash),
    index("ix_sessions_user").on(t.userId, t.revokedAt),
    index("ix_sessions_expiry").on(t.absoluteExpiresAt),
    foreignKey({ name: "fk_sessions_user", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  ],
);

export const authTokens = mysqlTable(
  "auth_tokens",
  {
    id: ulidColumn("id").primaryKey(),
    userId: ulidColumn("user_id").notNull(),
    purpose: mysqlEnum("purpose", TOKEN_PURPOSES).notNull(),
    tokenHash: hashColumn("token_hash").notNull(),
    newEmail: varchar("new_email", { length: 254 }),
    expiresAt: instant("expires_at").notNull(),
    usedAt: instant("used_at"),
    createdAt: instant("created_at").notNull(),
    createdBy: ulidColumn("created_by"),
    createdIp: varchar("created_ip", { length: 45 }),
  },
  (t) => [
    uniqueIndex("uq_auth_tokens_token").on(t.tokenHash),
    index("ix_auth_tokens_user").on(t.userId, t.purpose, t.usedAt),
    index("ix_auth_tokens_expiry").on(t.expiresAt),
    foreignKey({ name: "fk_auth_tokens_user", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
    foreignKey({ name: "fk_auth_tokens_created_by", columns: [t.createdBy], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

export const userMfa = mysqlTable(
  "user_mfa",
  {
    userId: ulidColumn("user_id").primaryKey(),
    totpSecretEnc: varbinaryColumn("totp_secret_enc", { length: 255 }).notNull(),
    keyVersion: tinyint("key_version", { unsigned: true }).notNull(),
    confirmedAt: instant("confirmed_at"),
    lastUsedStep: bigint("last_used_step", { mode: "number", unsigned: true }),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [foreignKey({ name: "fk_user_mfa_user", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade")],
);

export const userRecoveryCodes = mysqlTable(
  "user_recovery_codes",
  {
    id: ulidColumn("id").primaryKey(),
    userId: ulidColumn("user_id").notNull(),
    codeHash: hashColumn("code_hash").notNull(),
    usedAt: instant("used_at"),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    index("ix_recovery_codes_user").on(t.userId),
    foreignKey({ name: "fk_recovery_codes_user", columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  ],
);

export const loginAttempts = mysqlTable(
  "login_attempts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    attemptedAt: instant("attempted_at").notNull(),
    emailHash: hashColumn("email_hash").notNull(),
    userId: ulidColumn("user_id"),
    ip: varchar("ip", { length: 45 }),
    succeeded: boolean("succeeded").notNull(),
    failureReason: mysqlEnum("failure_reason", LOGIN_FAILURE_REASONS),
    userAgent: varchar("user_agent", { length: 255 }),
  },
  (t) => [
    index("ix_login_attempts_email").on(t.emailHash, t.attemptedAt),
    index("ix_login_attempts_ip").on(t.ip, t.attemptedAt),
    index("ix_login_attempts_time").on(t.attemptedAt),
    foreignKey({ name: "fk_login_attempts_user", columns: [t.userId], foreignColumns: [users.id] }).onDelete("set null"),
  ],
);

export const rateLimits = mysqlTable(
  "rate_limits",
  {
    keyHash: hashColumn("key_hash").notNull(),
    windowStart: instant("window_start").notNull(),
    count: int("count", { unsigned: true }).notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.keyHash, t.windowStart] }), index("ix_rate_limits_expiry").on(t.expiresAt)],
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    occurredAt: instant("occurred_at").notNull(),
    requestId: ulidColumn("request_id").notNull(),
    actorType: mysqlEnum("actor_type", AUDIT_ACTOR_TYPES).notNull(),
    actorUserId: ulidColumn("actor_user_id"),
    actorLabel: varchar("actor_label", { length: 200 }),
    actorRoles: varchar("actor_roles", { length: 100 }),
    sessionId: ulidColumn("session_id"),
    ip: varchar("ip", { length: 45 }),
    action: asciiColumn("action", { length: 64 }).notNull(),
    entityType: asciiColumn("entity_type", { length: 32 }),
    entityId: varchar("entity_id", { length: 64 }),
    entityLabel: varchar("entity_label", { length: 255 }),
    outcome: mysqlEnum("outcome", AUDIT_OUTCOMES).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    beforeRevisionId: ulidColumn("before_revision_id"),
    afterRevisionId: ulidColumn("after_revision_id"),
    changes: jsonColumn("changes"),
    prevHash: hashColumn("prev_hash"),
    hash: hashColumn("hash"),
  },
  (t) => [
    index("ix_audit_time").on(t.occurredAt),
    index("ix_audit_entity").on(t.entityType, t.entityId, t.occurredAt),
    index("ix_audit_actor").on(t.actorUserId, t.occurredAt),
    index("ix_audit_action").on(t.action, t.occurredAt),
    index("ix_audit_request").on(t.requestId),
  ],
);
