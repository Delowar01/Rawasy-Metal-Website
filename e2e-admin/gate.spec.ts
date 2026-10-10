/**
 * The pre-A9 admin gate (A2 Correction 1) on real servers: `node server.js` from this build, started here with each
 * combination of APP_ENV and ADMIN_ENABLED, its database settings pointing at a listener that counts connection
 * attempts (and answers none). Off: `/admin` is the public site's own locale redirect and 404, with no admin header and
 * no database access, and a forged admin Server Action runs nowhere. On: the admin answers with its nonce CSP.
 * Local development without ADMIN_ENABLED is the whole admin suite (e2e-admin/server.mjs sets APP_ENV=local only).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { expect, request as apiRequest, test } from "@playwright/test";

const ROOT = resolve(__dirname, "..");
const ADMIN_ORIGIN = "https://admin.example.test";

/** A stand-in database: counts connection attempts and closes each at once. */
async function countingListener(): Promise<{ port: number; attempts: () => number; close: () => Promise<void> }> {
  let attempts = 0;
  const server: Server = createServer((socket) => {
    attempts++;
    socket.destroy();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { port, attempts: () => attempts, close: () => new Promise((done) => server.close(() => done())) };
}

/** `node server.js` of this build with the given settings; resolves once it answers. */
async function startServer(port: number, dbPort: number, settings: Record<string, string>): Promise<{ base: string; stop: () => Promise<void> }> {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DB_HOST: "127.0.0.1",
    DB_PORT: String(dbPort),
    DB_USER: "gate_test",
    DB_PASSWORD: "",
    DB_NAME: "rawasy_gate_test",
    AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    AUTH_ENCRYPTION_KEY_VERSION: "1",
    TRUSTED_PROXY_HOPS: "0",
    ADMIN_BASE_URL: ADMIN_ORIGIN,
    ...settings,
  };
  const child: ChildProcess = spawn(process.execPath, [join(ROOT, "server.js")], { env, cwd: ROOT, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  const client = await apiRequest.newContext();
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await client.get(`${base}/robots.txt`, { timeout: 2000 })).ok()) break;
      } catch {
        // not listening yet
      }
      if (i > 150) throw new Error("server.js did not start");
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    await client.dispose();
  }
  return {
    base,
    stop: () =>
      new Promise((done) => {
        child.once("exit", () => done());
        child.kill("SIGTERM");
      }),
  };
}

/** The id of one of the admin's Server Actions in this build (from Next's own manifest). */
function actionId(name: string): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".next/server/server-reference-manifest.json"), "utf8")) as {
    node: Record<string, { exportedName?: string; filename?: string }>;
  };
  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === name && v.filename?.startsWith("src/server/admin/actions/"));
  if (!found) throw new Error(`No Server Action ${name} in the build.`);
  return found[0];
}

/**
 * A sign-in request as the admin's page sends it: React's reply encoding of the action's two arguments (the form
 * state, then the FormData as part 1). With the admin on, this request reaches the database (the "on" tests check it),
 * so the "off" tests' "no database" means the gate stopped it, not a malformed request.
 */
function signInRequest() {
  return {
    headers: {
      "next-action": actionId("signInAction"),
      origin: ADMIN_ORIGIN,
      "x-forwarded-host": new URL(ADMIN_ORIGIN).host,
      accept: "text/x-component",
    },
    multipart: {
      "0": '[{"status":"idle"},"$K1"]',
      "1_email": "owner@example.test",
      "1_password": "a password that is long",
      "1_next": "",
    },
    maxRedirects: 0,
  };
}

const OFF: Record<string, Record<string, string>> = {
  "production, ADMIN_ENABLED not set": { APP_ENV: "production" },
  "production, ADMIN_ENABLED=0": { APP_ENV: "production", ADMIN_ENABLED: "0" },
  "production build without APP_ENV": {},
  "staging, ADMIN_ENABLED not set": { APP_ENV: "staging" },
  "staging, ADMIN_ENABLED=0": { APP_ENV: "staging", ADMIN_ENABLED: "0" },
  "production, ADMIN_ENABLED=true (not the enabling value)": { APP_ENV: "production", ADMIN_ENABLED: "true" },
};

test.describe("the admin gate (ADMIN_ENABLED)", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let port = 3410;
  for (const [label, settings] of Object.entries(OFF)) {
    test(`off — ${label}: /admin is the public locale redirect and 404; no admin header, no database, no admin action`, async () => {
      const db = await countingListener();
      const server = await startServer(port++, db.port, settings);
      const client = await apiRequest.newContext({ baseURL: server.base });
      try {
        const redirect = async (path: string, headers: Record<string, string> = {}) => {
          const r = await client.get(path, { maxRedirects: 0, headers });
          return { status: r.status(), location: r.headers().location, headers: r.headers() };
        };
        // The public proxy's own locale handling, exactly as for any unknown address (as before A2).
        for (const path of ["/admin", "/admin/login", "/admin/users", "/admin/anything/at/all"]) {
          const r = await redirect(path);
          expect(r.status, path).toBe(307);
          expect(r.location, path).toBe(`/en${path}`);
          expect(r.headers["content-security-policy"], path).toBeUndefined();
          expect(r.headers["x-robots-tag"], path).toBeUndefined();
        }
        expect((await redirect("/admin", { "accept-language": "ar-SA,ar;q=0.9" })).location).toBe("/ar/admin");
        expect((await redirect("/admin", { cookie: "NEXT_LOCALE=ar" })).location).toBe("/ar/admin");
        const publicRedirect = await redirect("/about");
        expect(Object.keys((await redirect("/admin")).headers).sort()).toEqual(Object.keys(publicRedirect.headers).sort());
        // Where that leads: the localized public 404 (the same page as any unknown address).
        const notFound = await client.get("/en/admin");
        expect(notFound.status()).toBe(404);
        const unknown = await client.get("/en/not-a-page");
        const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1];
        expect(title(await notFound.text())).toBe(title(await unknown.text()));
        expect(notFound.headers()["content-security-policy"]).toBeUndefined();
        // A session cookie changes nothing, and no database is asked.
        expect((await redirect("/admin/login", { cookie: `__Host-rawasy_admin=${"A".repeat(43)}` })).location).toBe("/en/admin/login");
        // A forged admin Server Action — at its own address, or posted to a public page (Next forwards an action to the
        // page that has it) — runs nowhere: the same requests reach the database when the admin is on (below).
        const atAdmin = await client.post("/admin/login", signInRequest());
        expect(atAdmin.status()).toBe(307);
        expect(atAdmin.headers().location).toBe("/en/admin/login");
        await client.post("/en", signInRequest());
        expect(db.attempts(), "no database connection was attempted").toBe(0);
      } finally {
        await client.dispose();
        await server.stop();
        await db.close();
      }
    });
  }

  const ON: Record<string, Record<string, string>> = {
    "production, ADMIN_ENABLED=1": { APP_ENV: "production", ADMIN_ENABLED: "1" },
    "staging, ADMIN_ENABLED=1": { APP_ENV: "staging", ADMIN_ENABLED: "1" },
    "local, ADMIN_ENABLED not set": { APP_ENV: "local" },
  };
  for (const [label, settings] of Object.entries(ON)) {
    test(`on — ${label}: the admin answers with its nonce CSP and headers; its actions reach the database`, async () => {
      const db = await countingListener();
      const server = await startServer(port++, db.port, settings);
      const client = await apiRequest.newContext({ baseURL: server.base });
      try {
        const login = await client.get("/admin/login");
        expect(login.status()).toBe(200);
        expect(await login.text()).toContain("Administration of the RAWASY Metal website.");
        expect(login.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]{22}==' 'strict-dynamic'/);
        expect(login.headers()["x-robots-tag"]).toBe("noindex, nofollow");
        expect(login.headers()["cache-control"]).toBe("no-store");
        const dashboard = await client.get("/admin", { maxRedirects: 0 });
        expect(dashboard.status()).toBe(307);
        expect(dashboard.headers().location).toBe("/admin/login");
        // Deciding that the admin is on needed no database: nothing has connected yet.
        expect(db.attempts()).toBe(0);
        // The same forged sign-in as in the "off" tests reaches the database here (the stand-in refuses it: an error
        // answer), at the admin's address and posted to a public page alike — so "off" means the gate stopped it.
        const atAdmin = await client.post("/admin/login", signInRequest());
        expect(atAdmin.status()).toBe(500);
        const afterAdmin = db.attempts();
        expect(afterAdmin).toBeGreaterThan(0);
        await client.post("/en", signInRequest());
        expect(db.attempts()).toBeGreaterThan(afterAdmin);
      } finally {
        await client.dispose();
        await server.stop();
        await db.close();
      }
    });
  }
});
