/**
 * The admin gate's test servers (shared by the A7 spec; the A6 spec keeps its own copy): `server.js` on the build in
 * production mode with a given admin setting, against a stand-in database that only counts connection attempts — so a
 * test can prove that, with the gate off, no request reached the database at all.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:net";
import { join, resolve } from "node:path";
import { request as apiRequest } from "@playwright/test";

const ROOT = resolve(__dirname, "..");

/** A stand-in database: counts connection attempts and closes each at once. */
export async function countingDatabase() {
  let attempts = 0;
  const db: Server = createServer((socket) => {
    attempts++;
    socket.destroy();
  });
  await new Promise<void>((done) => db.listen(0, "127.0.0.1", done));
  const address = db.address();
  return {
    port: typeof address === "object" && address ? address.port : 0,
    attempts: () => attempts,
    close: () => new Promise<void>((done) => db.close(() => done())),
  };
}

/** server.js on this build, in production mode with the given admin setting, against the counting stand-in. */
export async function startGateServer(port: number, dbPort: number, settings: Record<string, string>) {
  const child: ChildProcess = spawn(process.execPath, [join(ROOT, "server.js")], {
    cwd: ROOT,
    stdio: "ignore",
    env: {
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
      ADMIN_BASE_URL: "https://admin.example.test",
      ...settings,
    },
  });
  const client = await apiRequest.newContext({ baseURL: `http://127.0.0.1:${port}` });
  for (let i = 0; ; i++) {
    try {
      if ((await client.get("/robots.txt", { timeout: 2000 })).ok()) break;
    } catch {
      // not listening yet
    }
    if (i > 150) throw new Error("server.js did not start");
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    client,
    stop: async () => {
      await client.dispose();
      await new Promise<void>((done) => {
        child.once("exit", () => done());
        child.kill("SIGTERM");
      });
    },
  };
}
