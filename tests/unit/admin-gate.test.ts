/** The pre-A9 admin gate (A2 Correction 1): ADMIN_ENABLED decides, fail-closed outside local development. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ADMIN_ENABLED_VALUE, isAdminEnabled } from "../../src/lib/admin-gate.ts";

const PRODUCTION_BUILD = { NODE_ENV: "production" };

describe("ADMIN_ENABLED", () => {
  test("A. local development: on when ADMIN_ENABLED is not set", () => {
    assert.equal(isAdminEnabled({ APP_ENV: "local", NODE_ENV: "production" }), true, "a production build run locally");
    assert.equal(isAdminEnabled({ NODE_ENV: "development" }), true, "next dev without APP_ENV");
    assert.equal(isAdminEnabled({ APP_ENV: "local", ADMIN_ENABLED: "" }), true, "an empty value counts as not set");
  });

  test("B. production: off when ADMIN_ENABLED is not set", () => {
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "production" }), false);
    assert.equal(isAdminEnabled(PRODUCTION_BUILD), false, "a production build without APP_ENV counts as production");
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "production", ADMIN_ENABLED: "   " }), false);
  });

  test("C. production: off with ADMIN_ENABLED=0", () => {
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "production", ADMIN_ENABLED: "0" }), false);
  });

  test("D. production: on with ADMIN_ENABLED=1", () => {
    assert.equal(ADMIN_ENABLED_VALUE, "1");
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "production", ADMIN_ENABLED: "1" }), true);
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, ADMIN_ENABLED: " 1 " }), true);
  });

  test("E. staging: the same explicit value is required", () => {
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "staging" }), false);
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "staging", ADMIN_ENABLED: "0" }), false);
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "staging", ADMIN_ENABLED: "1" }), true);
  });

  test("anything but the enabling value is off — also locally when it is set; DB settings never enable it", () => {
    for (const value of ["true", "yes", "on", "TRUE", "enabled", "2", "01", "1.0", "-1"]) {
      assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "production", ADMIN_ENABLED: value }), false, value);
      assert.equal(isAdminEnabled({ APP_ENV: "local", ADMIN_ENABLED: value }), false, `local, ${value}`);
    }
    assert.equal(isAdminEnabled({ APP_ENV: "local", ADMIN_ENABLED: "0" }), false, "a developer can turn it off");
    assert.equal(isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "prod" }), false, "an unknown APP_ENV is not local");
    assert.equal(
      isAdminEnabled({ ...PRODUCTION_BUILD, APP_ENV: "production", DB_HOST: "127.0.0.1", DB_NAME: "rawasy", DB_USER: "rawasy", AUTH_ENCRYPTION_KEY: "x" }),
      false,
    );
  });
});
