/**
 * Column types of the A1 schema (A1-DATABASE-SCHEMA §2–§3) that Drizzle 0.45 cannot express directly.
 *
 * Drizzle cannot declare a column's character set or collation, so ASCII keys are custom types whose SQL type carries
 * `CHARACTER SET ascii COLLATE ascii_bin`. Its `binary()` column decodes values as UTF-8 text, which corrupts hashes,
 * so binary columns are custom types that keep Buffers. MariaDB's JSON is LONGTEXT with a JSON_VALID check and may come
 * back as a string, so the JSON type parses defensively. Text columns take the table's utf8mb4_unicode_520_ci (added to
 * every CREATE TABLE in the reviewed migration; checked by `db-migrate.mjs`).
 */
import { customType, datetime } from "drizzle-orm/mysql-core";

/** ULID entity id: CHAR(26) ASCII, case-sensitive. */
export const ulidColumn = customType<{ data: string; driverData: string }>({
  dataType: () => "char(26) CHARACTER SET ascii COLLATE ascii_bin",
});

/** Registry keys (KEY32 / KEY64) and other exact ASCII identifiers. */
export const asciiColumn = customType<{ data: string; driverData: string; config: { length: number }; configRequired: true }>({
  dataType: (config) => `varchar(${config.length}) CHARACTER SET ascii COLLATE ascii_bin`,
});

/** Locale code (LOCALE): 'en', 'ar'. */
export const localeColumn = customType<{ data: string; driverData: string }>({
  dataType: () => "varchar(10) CHARACTER SET ascii COLLATE ascii_bin",
});

/** Exact (binary) Unicode comparison: the normalized email, the login key. */
export const binaryTextColumn = customType<{ data: string; driverData: string; config: { length: number }; configRequired: true }>({
  dataType: (config) => `varchar(${config.length}) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
});

const toBuffer = (value: unknown): Buffer => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError("Expected binary data from the database.");
};

/** SHA-256 value (HASH): BINARY(32). */
export const hashColumn = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "binary(32)",
  toDriver: (value) => {
    if (value.length !== 32) throw new RangeError("A hash column takes exactly 32 bytes.");
    return value;
  },
  fromDriver: toBuffer,
});

/** Variable binary data (an encrypted secret). */
export const varbinaryColumn = customType<{ data: Buffer; driverData: Buffer; config: { length: number }; configRequired: true }>({
  dataType: (config) => `varbinary(${config.length})`,
  toDriver: (value) => value,
  fromDriver: toBuffer,
});

/** JSON, parsed whether the driver returns an object or a string (MariaDB: LONGTEXT + JSON_VALID). */
export const jsonColumn = customType<{ data: unknown; driverData: string }>({
  dataType: () => "json",
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value),
});

/** An instant (DT): DATETIME(3) in UTC (every connection runs SET time_zone = '+00:00'). */
export const instant = (name: string) => datetime(name, { mode: "date", fsp: 3 });
