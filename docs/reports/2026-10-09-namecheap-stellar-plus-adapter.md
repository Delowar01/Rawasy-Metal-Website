# Namecheap Stellar Plus — hosting adapter (cPanel → Setup Node.js App)

Date: 2026-10-09 · Branch: `claude/new-session-5eijs6` · Status: **adapter prepared and proven locally; awaiting
independent review**. Nothing was uploaded to Namecheap, no domain was connected, DNS and nameservers were not touched,
no certificate was installed, `main` was not changed and the legal pages' pending notes are still in place. The site is
not online. One pre-existing Next.js 16.3.8 image-optimizer defect was found on the way (item 12): not caused by the
adapter, not changed, mitigation for RAWASY to decide.

**Correction 1** (production archive safety and image warm-up, the user's "NAMECHEAP ADAPTER — CORRECTION 1" brief) is
appended at the end. It supersedes item 23's archive command, the withheld-media note in item 12 and the matching known
limitation: the archive now leaves the ten held-back photos out, and the image cache is warmed after each start.
**Correction 2** (the three held-back Laser Engraving images, the user's "NAMECHEAP ADAPTER — CORRECTION 2" brief)
follows it: the archive leaves thirteen held-back files out.

## Summary

The approved release candidate (`422c397`) had no startup file and `"start": "next start"`. cPanel's Setup Node.js App
starts an application from a file (Namecheap's guidance: a custom `server.js`, startup file `server.js`, the app outside
`public_html`, mode Production). The adapter is the smallest change that gives it one:

- **`server.js`** (new, 42 lines, CommonJS, no dependency): hands every request to Next.js's own request handler —
  the same `getRequestHandlers()` that `next start` uses — so the proxy (`src/proxy.ts`), routing, the 404s and the
  image optimizer run unchanged. Port and address from `PORT` / `HOSTNAME` (defaults 3000 and `0.0.0.0`, as in the
  brief's shape); no domain and no host port written into it.
- **`package.json`:** `"start": "next start"` → `"node server.js"`. Nothing else in the file changed.
- **README:** a "Namecheap Stellar Plus deployment" section.

Implementation commit **`2043981`**; the website is otherwise frozen (no file under `src/`, `public/`, `e2e/`, no
config, no lockfile changed).

Proof, in short:

- **Clean clone at `2043981`:** `npm ci` ✔, `npm audit --omit=dev` **0 vulnerabilities**, lint ✔, typecheck ✔,
  build ✔ (109 pages), **full E2E against `server.js`: 612 / 612 passed** (0 failed, 0 skipped, 0 flaky).
- **Same build as the approved RC:** 1,221 of 1,224 build files byte-identical to the clean `422c397` build once the
  build ID and folder are normalised; the other 3 hold Next.js's random per-build keys.
- **`server.js` vs `next start` on the same build:** 184 / 184 HTTP answers identical in status, headers and bytes
  (102 sitemap pages, the brief's routes, redirects, locale cookie and language cases, 404s, metadata files, static
  files); 1,484 / 1,484 optimized images byte-identical; 42 browser captures with identical status, address, title,
  language, robots, canonical, heading, machine landing and console (39 pixel-identical; the other 3 also vary between
  captures from one and the same server).
- **Deployment rehearsal** (the README flow end to end: fresh clone, build, the README's `tar` command, extraction
  over a starter `server.js` in another folder, production-only install, start): ready in 482 ms, smoke 36 / 36, and
  the full E2E suite against that package: 610 / 612 on its cold image cache (two timeouts, the finding below), then
  **612 / 612** after a restart and an image-cache warm-up.
- **Finding (pre-existing, not the adapter):** in Next.js 16.3.8, an image size whose very first request is cancelled
  by the visitor can stay unanswered in that server process until it restarts — reproduced the same way on
  `next start` (27 of 300 cut-off variants) and `server.js` (26 of 300); cached sizes are immune. Mitigation
  options for RAWASY in item 12; nothing changed here.

## 1. Starting SHA

`422c397c56ec500afc270cf69a7e5a298c25f29f`, verified before any change: `git fetch origin`, local `HEAD` = origin
`claude/new-session-5eijs6` = `422c397`, clean working tree; `preserve/pre-stage-1j` = `f69e2facae3d2541daa55ff20aa75cc8631ec804`
(unchanged); `main` = `474f61f10f12981e41f9b7e7fd6065a0ec9da541`.

## 2. Preserve checkpoint

`preserve/pre-namecheap-adapter` → `422c397c56ec500afc270cf69a7e5a298c25f29f`, created and pushed (`* [new branch]`, no
force; it did not exist before). `git ls-remote` after the work: still `422c397`; `preserve/pre-stage-1j` still
`f69e2fa`.

## 3. Adapter implementation SHA

`2043981a066274e0a9cac68c5b7b4eff608561f0` — "Namecheap Stellar Plus hosting adapter: server.js and npm start"
(`server.js`, `package.json`, `README.md`). Pushed.

## 4. Branch HEAD

The last of the documentation commits on top of `2043981`: `3287c08` (draft report), `ee3277f` (E2E and rehearsal
results), `3b887df` (the image-optimizer finding), `37d8d5e` (final results), `ffdb66b` and `2429278` (line wrapping),
and the commit that carries this text — documentation only (this report, `CLAUDE.md`, `README.md`). Its hash is given
with the hand-off, since a commit cannot contain its own hash.

## 5. Files changed

| File | Change | Commit |
| --- | --- | --- |
| `server.js` | new, 42 lines | `2043981` |
| `package.json` | `scripts.start` only (1 line) | `2043981` |
| `README.md` | new "Namecheap Stellar Plus deployment" section; one sentence in "Next stages" (+56 −1) | `2043981` |
| `docs/reports/2026-10-09-namecheap-stellar-plus-adapter.md` | this report | report commits |
| `CLAUDE.md` | project memory (adapter status, gotchas) | report commits |
| `README.md` | the deployment section: delete the old `.next` before extracting another release (update and rollback steps); the image-optimizer known issue (item 12) | report commits |

`git diff 422c397 2043981 -- src public e2e next.config.ts playwright.config.ts tsconfig.json package-lock.json
.env.example .nvmrc` is empty: no page, content, image, test, configuration, dependency or lockfile change.

## 6. `server.js` implementation

```js
// Production server for hosts that start the app from a file (Namecheap cPanel → Setup Node.js App, which runs it
// under Phusion Passenger). Every request goes to Next.js's own request handler, the one `next start` uses: the proxy
// (src/proxy.ts), routes, 404s and the image optimizer are unchanged. Run `npm run build` first.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose: node and Passenger run this file as it is. */
const { createServer } = require("http");

// Production unless NODE_ENV says otherwise, as with `next start`: `npm start` never starts the dev server.
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

// dir: the folder holding this file, whatever folder the process starts in.
const app = next({ dev, dir: __dirname, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      // Next answers request errors itself; this only ends a request its handler failed, as `next start` does.
      handle(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      });
    })
      .once("error", (err) => {
        console.error(err);
        process.exit(1);
      })
      .listen(port, hostname, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
      });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

It is the brief's preferred shape with four small variations, each needed to keep `next start`'s behaviour (read in
`node_modules/next/dist/server/next.js` and `server/lib/start-server.js` of 16.3.8):

| Variation | Why | Proof |
| --- | --- | --- |
| `NODE_ENV` defaults to `production` before `require("next")` | `next start` does exactly this (`bin/next` sets `NODE_ENV` to `production` when it is unset, before loading the server). With the bare shape, `npm start` without `NODE_ENV` — the README's Windows `npm.cmd start` included — would start the **dev server** (it compiles on demand, needs the dev dependencies, shows the error overlay). An explicit `NODE_ENV` still decides (`development` → dev server). | `NODE_ENV` unset: production answers (`x-nextjs-prerender: 1`, `x-nextjs-cache: HIT`, no `.next/dev`), `/en` byte-identical to the `NODE_ENV=production` runs; `npm start` with nothing set → `node server.js` on `0.0.0.0:3000`, production. |
| `dir: __dirname` | The build is found whatever folder the process starts in (Next's own generated standalone server does the same). Passenger starts in the application root, so this is a safeguard, not a requirement. | The rehearsal ran from a different folder than the build; a stub of `next()` logged the folder passed. |
| `prepare().catch(…)` → print, exit 1 | §16: a startup failure must print and exit non-zero. Next installs its own `unhandledRejection` listener during `prepare()`, so without the catch a failure is only logged and the process exits **0**. | No build: `server.js` prints "Could not find a production build in the '.next' directory…" and exits **1**; the literal shape printed "Unhandled Rejection: …" and exited **0**. |
| `handle(req, res).catch(…)` → 500 | `next start`'s request listener catches a rejected handler, answers 500 and logs (`start-server.js`). Without it a rejected request is logged by Next's listener but never answered. Ordinary request errors are still handled by Next itself (its error pages). | Stub handler: a rejection before the headers → 500 and logged; after the headers → the response is ended; the server keeps answering. |

Plus one line for lint: `eslint-config-next/typescript` forbids `require()` (`@typescript-eslint/no-require-imports`);
the file disables that rule for itself only, with the reason (the lint configuration is unchanged).

What it does **not** do: no Express or other dependency, no route of its own, no `render()` calls, no locale or proxy
logic, no 404 of its own, no image settings, no domain, no fixed port, no headers of its own, no compression of its own
(Next compresses as before), no PM2 / daemon / signal handling (cPanel and Passenger manage the process; Node ends on
`SIGTERM`, checked).

Local checks (the main checkout's build, `NODE_ENV=production PORT=<port> node server.js`):

| Case | Listening | Result |
| --- | --- | --- |
| `PORT=3611` | `0.0.0.0:3611` | `/en` 200 (byte-identical in every case), `/` → 307 `/en` |
| `PORT=3622` | `0.0.0.0:3622` | same |
| `PORT=4733` | `0.0.0.0:4733` | same |
| no `PORT` | `0.0.0.0:3000` | same |
| no `NODE_ENV` (`PORT=3644`) | `0.0.0.0:3644` | production, as above |
| `HOSTNAME=127.0.0.1` (`PORT=3655`) | `127.0.0.1:3655` only | same |
| `npm start`, nothing set | `0.0.0.0:3000` (`node server.js`) | same |
| second server on a busy port (3666) | — | "listen EADDRINUSE", exit **1** |
| no `.next` build | — | clear message, exit **1** |

`PORT` is honoured; nothing assumes 3000. With `Host: www.rawasymetal.com` and `X-Forwarded-Proto: https` the
redirect stays relative (`Location: /en`): Next relativizes a same-origin redirect, so the internal host and port never
reach a response.

## 7. Package start change

```diff
-    "start": "next start",
+    "start": "node server.js",
```

No inline `NODE_ENV` (it does not work in ordinary PowerShell) and no `cross-env`. `dev`, `build`, `lint`, `typecheck`,
`test:e2e`, `assets:extract`, `assets:og`, `engines` and every dependency are unchanged. cPanel's Application mode
**Production** supplies `NODE_ENV=production` on the host; locally `server.js` itself defaults to production (item 6),
so `npm run build && npm start` (and `npm.cmd start`) behave as before. `npm run test:e2e` still starts `next start` on
port 3400 by itself unless a server already answers there (item 20 used that to test `server.js`).

## 8. Node version

Tested on **Node.js 22.22.2** with **npm 10.9.7** (`.nvmrc` `22.22.2`, `"engines": { "node": "22.22.2" }`, both
unchanged). The project stays on Node 22; nothing moved to Node 20. In cPanel choose the Node.js 22.x entry (the brief
expects 22.22 on the shared-server pool). If the panel's 22.x is not exactly 22.22.2, `npm install` prints an
`EBADENGINE` warning for `engines` and carries on (npm does not enforce `engines` unless `engine-strict` is set).
**If the account offers no Node.js 22.x at all: stop and report** (brief §11) — not checked here, there is no access to
the account.

## 9. Namecheap target assumptions

Given by the brief: Stellar Plus shared hosting; cPanel → Setup Node.js App; Node.js 22.x (22.22 in the pool);
Git / Terminal / SSH depending on the account; Passenger / cPanel application management; Namecheap's guidance (custom
`server.js`, startup file `server.js`, application outside `public_html`, mode Production, npm dependencies installed
through the application's environment).

Assumed for this adapter, **not verified on the account** (none of it can be seen from this environment):

1. The panel is CloudLinux's Node.js Selector running the app under Phusion Passenger (or the web server's
   Passenger-compatible Node.js support): the startup file is loaded with `require()`, and the first `listen()` call is
   redirected to a socket of Passenger's own, so `PORT` / `HOSTNAME` do not matter there. `server.js` calls `listen()`
   once and Next.js opens no server of its own (the process held exactly one listening socket in every run here),
   which Passenger's auto-install mode requires.
2. Application mode Production sets `NODE_ENV=production` (Passenger's application environment).
3. "Run NPM Install" installs the dependencies into the application's own environment and links `node_modules` into the
   application root; an uploaded `node_modules` folder is not wanted there.
4. The server's C library is glibc 2.28 or later: `sharp` 0.35.5's prebuilt Linux binaries (`@img/sharp-linux-x64`,
   `@img/sharp-libvips-linux-x64` 1.3.4) declare `glibc >= 2.28` (CloudLinux 8 or later). Check with `ldd --version`.
5. The account's limits leave room for one Node.js process of about 0.5 GB at its peak (item 12) and ~0.6 GB of disk
   for the application and its dependencies (item 23).
6. The app needs **no outbound network** at run time (no remote images, no API; the Google Maps frame loads in the
   visitor's browser) and no database.
7. Apache (or LiteSpeed) passes the visitor's `Host`; whether it adds `X-Forwarded-Proto` does not matter (redirects are
   relative). Passenger may add its own `X-Powered-By` / `Server` headers; Next.js adds none (`poweredByHeader: false`).

Passenger behaviour that matters here (brief §17; from the products' documented behaviour and this adapter's code — no
Passenger ran in this environment, and no Passenger file or `.htaccess` rule was written):

- **Start:** Passenger starts the app on the first request after a start or an idle period (Next.js loads
  `next.config.ts` and its manifests: "Ready" in 482 ms in the rehearsal; the session's very first start spent 3.5 s
  compiling `next.config.ts` on a cold disk), then keeps it running; it may run more than one process, which then share
  `.next`'s caches (item 10 note).
- **Port:** the socket is Passenger's; `server.js` still logs "Ready on http://0.0.0.0:3000" (harmless).
- **Mode:** `NODE_ENV` comes from Application mode; with Production, the production server runs (item 6).
- **Failure:** a start that fails (no build, missing dependency) prints the reason and exits 1, so Passenger reports the
  application as failed and its log holds the message, instead of a process that never answers.
- **Restart:** the panel's Restart (Stop / Start) button; nothing in the project depends on Passenger's own restart
  files.
- **Static files:** files that exist in the domain's document root may be answered by the web server before Passenger
  (hence item 28's step on an older site's files); the application's own `public/` is served by Next.js.

## 10. Custom-server route parity

Method: the clean clone's build (`2043981`) served twice, each server from its own copy of the deployment archive (so
neither sees the other's render or image cache): `next start -p 3601` (the approved way) and
`NODE_ENV=production PORT=3602 node server.js`. Every request went to both and was compared on status, every response
header except `Date` / `Connection` / `Keep-Alive`, and the body bytes.

**HTTP: 184 / 184 identical** — the 102 sitemap pages; the brief's routes and unknown routes; redirects; locale cookie
and Accept-Language cases; a request as a proxy forwards it; `HEAD`; gzip / brotli negotiation; page-data (RSC)
requests; `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `icon.svg`, `apple-icon.png`, `/favicon.ico` (404, as
before), the two share images; paths outside the proxy; the 22 static files `/en` loads.

| Route | Status | Robots | HTTP identical | Pixels differing 1440 / 390 |
| --- | --- | --- | --- | --- |
| `/` | 307 → `/en` | — | yes | 0 / 0 |
| `/en` | 200 | index | yes | 205 / 0 |
| `/ar` | 200 | index | yes | 0 / 0 |
| `/en/about` | 200 | index | yes | 0 / 0 |
| `/ar/about` | 200 | index | yes | 58 / 0 |
| `/en/services` | 200 | index | yes | 0 / 0 |
| `/en/services/laser-cutting` | 200 | index | yes | 0 / 0 |
| `/ar/services/laser-cutting` | 200 | index | yes | 0 / 0 |
| `/en/capabilities` | 200 | index | yes | 0 / 0 |
| `/en/capabilities#cnc-press-brake` | 200 (same document) | index | yes | 0 / 872 |
| `/en/projects` | 200 | index | yes | 0 / 0 |
| `/en/projects/clock-tower-landmark` (3 photos) | 200 | index | yes | 0 / 0 |
| `/en/projects/billboard-support-structure` (text only) | 200 | index | yes | 0 / 0 |
| `/en/certificates` | 200 | index | yes | 0 / 0 |
| `/en/contact` | 200 | index | yes | 0 / 0 |
| `/en/privacy` | 200 | index | yes | 0 / 0 |
| `/en/terms` | 200 | index | yes | 0 / 0 |
| `/en/not-a-page` | 404 | noindex | yes | 0 / 0 |
| `/ar/not-a-page` | 404 | noindex | yes | 0 / 0 |
| `/en/services/not-a-service` | 404 | noindex | yes | 0 / 0 |
| `/en/projects/not-a-project` | 404 | noindex | yes | 0 / 0 |

"index" = no robots `noindex` and a canonical on `https://www.rawasymetal.com/…` (all 34 rendered 200 pages; the 404s
carry `noindex` and no canonical). The metadata is part of the identical bytes: titles, descriptions, canonicals,
hreflang, Open Graph, JSON-LD.

**Rendered pages:** Chromium (light, reduced motion) at 1440 × 900 and 390 × 844, 21 routes × 2 sizes on each server:
all 42 pairs agree on status, address, title, `lang` / `dir`, robots, canonical, `h1`, scroll position, the active
machine and the console (no error except the 404 documents' own "404" resource line, the same on both). 39 pairs are
pixel-identical. The three others are capture noise, not the server: `/en` (205 px, at most 1 colour level, inside the
hero drawing) was identical in 9 / 9 later captures; `/ar/about` (58 px, 2 levels) is drawn one of two ways by each
server alike (`next start` 58 px from itself); the phone `#cnc-press-brake` landing (a 40 × 42 px patch in the machine
selector row) varies between captures on both servers (five captures each, once the row had stopped: `next start` 0 /
1,728 / 2,600 px from the first capture, `server.js` 0 / 872 / 2,600), with the row at the same position (`scrollLeft`
994, `scrollY` 2294, panel 88 px from the top) every time.

**Page data (RSC):** following Next's `_rsc` cache-key redirect, 15 of 16 payloads are byte-identical; the catch-all
404's page data carries a random React key per request (`next start` gives a different body on every request too,
same length).

**Build identity:** the clean `2043981` build against the clean `422c397` build from the release pre-flight: 1,224 files
compared, 1,221 identical after normalising the build ID and the build folder, none missing or added; the 3 others
(`prerender-manifest.json`, `server/server-reference-manifest.{js,json}`) differ only in the preview-mode and
server-action keys Next.js generates at random for every build.

Note on a shared `.next`: when the two servers first ran from one folder, 5 unknown-slug 404s differed only in
`x-nextjs-cache` (MISS / HIT) and `cache-control`: they share the render cache on disk, and whichever answers first
renders it. Alternating requests gave the same sequence whichever server began (MISS, HIT, HIT, HIT, HIT, STALE): Next.js's
own cache behaviour, not the server's. Several Passenger processes of one app would share that cache the same way.

## 11. Proxy / locale behaviour

All identical on both servers (item 10), with no proxy logic in `server.js`:

| Request | Answer |
| --- | --- |
| `/` | 307 → `/en` |
| `/` with an Arabic browser (`Accept-Language: ar-SA,ar;q=0.9,en;q=0.5`) | 307 → `/ar` |
| `/` with cookie `NEXT_LOCALE=ar` | 307 → `/ar` |
| `/` with cookie `NEXT_LOCALE=en` and an Arabic browser | 307 → `/en` (the cookie wins) |
| `/` with an invalid cookie (`xx`) and an Arabic browser | 307 → `/ar` (negotiated) |
| `/` as a proxy forwards it (`Host: www.rawasymetal.com`, `X-Forwarded-Proto: https`) | 307 → `/en` (relative) |
| `/?utm_source=x` | 307 → `/en?utm_source=x` |
| `/about`, `/capabilities`, `/projects/clock-tower-landmark` | 307 → `/en/…` |
| invalid locales `/fr`, `/fr/about`, `/de/projects`, `/EN` | 307 → `/en/fr`, `/en/fr/about`, `/en/de/projects`, `/en/EN`, each then the localized 404 (404, noindex) |
| `/en/`, `/en/about/`, `//en`, `/en//about` | 308 → `/en`, `/en/about` |
| `/theme-lab`, `/foo.php` | 307 → `/en/…` → localized 404 |
| `/en`, `/ar` and every sitemap page | 200 |
| every project page (68 in the sitemap) | 200; media-rich and text-only variants as built |
| `/en/capabilities#cnc-press-brake` | the same document; in the browser the CNC press brake panel is active and lands 88 px from the top (under the header) on both servers |
| unknown page / service / project, `/en/fr`, `/en/a/b/c`, `/ar/projects/<slug>/extra` | 404 with the localized page, `noindex` |
| `/api/x`, `/media/nope.webp`, `/_next/nope`, `/brand/nope.svg` (outside the proxy) | 404, as before |

The proxy sets no cookie in any answer (no `Set-Cookie` on either server); the language switch's cookie is written by
the page (covered by the E2E suite). The 12 cold machine addresses with late fonts, every machine link, the language
switch keeping the machine and the real 404 matrix are E2E tests that ran against `server.js` (item 20).

## 12. Image optimizer

Served by the real Next.js server (no `output: export`, no static conversion; `next.config.ts` unchanged):

- **`/_next/image` works:** every image the 102 sitemap pages reference — **1,484** distinct `/_next/image` URLs
  (16.2 MB optimized) — fetched from both servers with a browser's `Accept`, each server optimizing with its own empty
  cache: **1,484 / 1,484 identical** (status, headers, bytes), all `200 image/webp` (`x-nextjs-cache: MISS`); the second
  pass from each server's cache: 1,484 / 1,484 identical (`HIT`).
- **Negotiation:** a browser `Accept` gets WebP; a bare `*/*` gets the source's JPEG fallback (60 / 60 identical).
- **Refusals:** a remote URL (`url=https://example.com/x.png`) → **400**; a width outside the configured sizes
  (`w=641`) → 400; a missing local file → 404 (the same on both).
- **`sharp` is used:** after the image passes, the `server.js` process had `sharp-linux-x64-0.35.5.node` and
  `libvips-cpp.so.8.18.7` loaded (the same files as `next start`). If `sharp` cannot load on the host, image requests
  fail (Next.js 16 throws "Module `sharp` not found…" and suggests the WebAssembly build): the smoke checklist's image
  check catches that.
- **Memory** (resident, `/proc/<pid>/status`): optimizing the 1,484 images in one pass peaked at about 501 MiB on
  either server; a `server.js` that had served the 102 pages and a few images held about 263 MiB (the first package
  trial) or 268 MiB (the rehearsal), and 132 MiB just after start. The image cache on disk
  (`.next/cache/images`) reached 28 MB.
- **Withheld project media:** no page or page data refers to any of the 10 withheld or held-back photos (the three
  AI-watermarked files and the seven photos of the five projects awaiting authorship or product confirmation): checked
  over all 102 sitemap pages and the 404s on `server.js`, and covered per project by the E2E suite. **But** the files
  themselves are in `public/media/projects/` (as in the approved RC), so a direct request for their address answers 200
  — on `next start` exactly as on `server.js`. Not changed here (website freeze); a decision for RAWASY (item 30).

**Finding — an image size whose first request is cancelled can stay unanswered (Next.js 16.3.8; pre-existing).**

- **How it showed:** the E2E run against the deployment package (cold image cache) ended 610 / 612: two sweep tests
  timed out at 60 s on `/en/about` waiting for its photos (`commerce-company.spec.ts:479` for the images to decode,
  `stage-1c.spec.ts:129` for the page's `load`). On that server three variants never answered —
  `/_next/image?url=/media/machines/{fiber-laser-6kw,fiber-laser-3kw,press-brake}.webp&w=64&q=75` (no answer in 15 s);
  the other 359 of the page's 362 image URLs did.
- **Cause, reproduced:** for a local image the optimizer fetches the file through a mocked request bound to the
  visitor's own connection (`fetchInternalImage(href, req.originalRequest, …)`, `socket: _req.socket` in
  `server/image-optimizer.js`). When that connection closes in the first moments of an uncached variant's
  optimization, the optimization never finishes; the response cache keeps it as pending, and every later request for
  that variant waits on it. Test: 300 uncached variants, each requested and cut off after 0–30 ms, then requested
  normally (10 s limit): **27 hung on `next start`, 26 on `server.js`** — largely the same images (7 of the 8 listed
  for each server matched), every listed one cut off within 0–2 ms. A hung variant was still unanswered minutes later
  on both; after a restart of the process it answered in 0.13 s.
- **Not caused by the adapter:** identical on `next start` (the approved RC's way) and the same code path (both run
  Next's `getRequestHandlers()`; the one option `next start` passes and a custom server does not, `httpServer`, only
  wires WebSockets). Stage 1E saw a stuck variant on `next start` too (CLAUDE.md).
- **Cached sizes are immune:** after a warm-up, the same 300 variants cut off after 0–30 ms all answered `200 HIT`
  (300 / 300). A stale entry (after Next's default 4-hour `minimumCacheTTL`) is answered at once from the cache and
  refreshed in the background, so a hung refresh only keeps the old image.
- **Impact on the host:** a visitor whose browser cancels the very first request for an uncached photo size (fast
  navigation, a lazy image scrolled away) can leave that size blank for everyone served by that process until it
  restarts (the panel's Restart, or Passenger stopping an idle process).
- **Options — RAWASY's or the reviewer's decision; nothing changed here** (the brief forbids changing image
  optimization, and a dependency change needs authorization): **(a)** warm the image cache after every start or
  upload — request each image URL the pages use once (1,484 URLs, 27 s here; a scripted crawl of the sitemap's pages)
  — so no page photo goes through the vulnerable first optimization; the cache lives on disk in `.next/cache/images`
  and survives restarts, but an update that deletes `.next` empties it; **(b)** a later Next.js release that fixes it
  (not checked: no access to release notes from here); **(c)** accept it and restart when a photo stays blank.
  Recommended: (a) for launch, (b) when available.

## 13. Environment variables

The application needs one: **`NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com`**. It is read **at build time** (every
page is prerendered and Next.js inlines `NEXT_PUBLIC_*` values into the build), so it must be set for the build; setting
it in cPanel as well is harmless and records the intent. Its default is the same origin, so a build without it is
identical in every served file. No secret, key, database, AWS or other variable is configured in this project or this
adapter (`.env.example` unchanged, holding only that line). `NODE_ENV` (from cPanel's Application mode), `PORT` and
`HOSTNAME` are process settings that the panel or Passenger provides, not configuration to add.

## 14. Clean-clone result

A fresh `git clone` of `claude/new-session-5eijs6`, checked out at `2043981` (no `node_modules`, no `.next`, no cache;
Node 22.22.2, npm 10.9.7):

| Step | Result |
| --- | --- |
| `npm ci` | ✔ added 374 packages in 14 s (one deprecation notice: `eslint@9.39.5`) |
| `npm audit` | 5 high (item 15) |
| `npm audit --omit=dev` | **found 0 vulnerabilities** |
| `npm run lint` | ✔ no problems (12 s) |
| `npm run typecheck` | ✔ (`next typegen && tsc --noEmit`, 8 s) |
| `NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build` | ✔ 109 static pages, no warning (19 s) |
| deployment archive, right after the build | 17,499,009 bytes, 1,557 files (item 23) |
| `NODE_ENV=production PORT=3500 node server.js` | ✔ "Ready on http://0.0.0.0:3500" |
| `E2E_PORT=3500 npm run test:e2e` | **612 passed** (21.2 min), 0 failed, 0 skipped, 0 flaky |

## 15. npm audit

`npm audit` (with development dependencies): **5 high**, one chain used only by the linter: `braces` (GHSA-vfj7-8cjw-p6xm,
stack exhaustion through deeply nested patterns) ← `micromatch` ← `fast-glob` ← `@next/eslint-plugin-next` ←
`eslint-config-next`. The only fix offered is `npm audit fix --force`, which would install `eslint-config-next@14.2.35`,
a breaking downgrade: not run (as in Stage 1J). None of these packages is installed by a production install
(item 23) or reaches the server.

## 16. npm audit --omit=dev

**found 0 vulnerabilities** (clean clone, `2043981`).

## 17. Lint

`npm run lint`: no problems, in the clean clone and in the working checkout. `server.js` is linted with the rest
(ESLint covers `.js`); the one rule it disables for itself is explained in item 6.

## 18. Typecheck

`npm run typecheck` (`next typegen && tsc --noEmit`): passed. `server.js` is outside `tsconfig.json`'s `include`
(`.ts`, `.tsx`, `.mts` only), as Next.js runs it uncompiled.

## 19. Build

`npm run build` with `NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com`: passed, Next.js 16.3.8 (Turbopack), 109 static
pages, the catch-all route dynamic and the proxy (middleware), no warning. `.next` is 72 MB without its build cache
(122 MB with it). `server.js` is not part of the build; the output is the approved RC's (item 10, build identity).

## 20. Full E2E

**612 / 612 passed** — `E2E_PORT=3500 npm run test:e2e` in the clean clone (`2043981`), 04:00:00–04:21:11 UTC,
"612 passed (21.2m)": 0 failed, 0 skipped, 0 flaky, no retry (the configuration allows none), 3 workers. The server under
test was `NODE_ENV=production PORT=3500 node server.js` started in that clone (with `NEXT_PUBLIC_SITE_URL` set, as on
the host); Playwright's `webServer` found it answering and reused it (`reuseExistingServer`), so no `next start` ran: the
only listener on 3500 was `node server.js` (checked during the run) and no `next-server` process existed. `E2E_BASE_URL`
stayed unset, so the build-output tests (the fallback 404 read from `.next`) ran too. No test, helper or configuration
was changed; all 612 assertions are the approved suite's. The server answered the whole run without a restart (peak
resident memory 415 MiB).

**Second run, on the deployment package** (item 28's rehearsal): the same suite from the rehearsal's build clone against
`server.js` running from the extracted archive with production dependencies only (another folder, port 3510), cold
image cache: **610 passed, 2 failed** (22.0 min; 0 skipped, 0 flaky). Both failures are 60 s timeouts on `/en/about`
waiting for three image variants that never answered — the Next.js finding in item 12, not a difference of the
package (the clean clone's run, also on a cold cache, passed 612 / 612). **Third run**, after restarting that server
and warming its image cache (item 12, option a): **612 passed** (21.1 min, 05:11:00–05:32:09 UTC; 0 failed, 0 skipped,
0 flaky; peak resident memory 452 MiB; image cache 1,487 files, 26 MB).

## 21. Application-root plan

- **Application root:** `rawasy-app` in the account's home folder (`~/rawasy-app`; the panel shows the full path — no
  user name or home path is assumed here). **Never `public_html`** or a folder inside it.
- **After extraction it holds:** `server.js`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`,
  `next-env.d.ts`, `postcss.config.mjs`, `.nvmrc`, `src/`, `public/`, `.next/` — 78 MB, 1,557 files. "Run NPM Install"
  adds `node_modules` (in the application's environment, linked into the root; about 460 MB, 11,720 files and folders
  with production dependencies only, item 23). At run time Next.js adds `.next/cache/images` (optimized images, about
  28 MB for today's pages) and may write render-cache files under `.next/server/app` (unknown addresses).
- **The document root** (`public_html` for the primary domain, or the domain's own folder for an addon domain) keeps
  only what the panel puts there: its `.htaccess` lines for Passenger, `.well-known` for certificate checks and any
  existing site's files until they are backed up and moved out (item 28).

## 22. cPanel settings

| Setting | Value |
| --- | --- |
| Node.js version | **22.x** (the 22.22 entry expected; stop if there is no 22.x) |
| Application mode | **Production** |
| Application root | **`rawasy-app`** (outside `public_html`) |
| Application URL | **www.rawasymetal.com**, empty path (the domain entry the panel lists for it; `www` is normally served by the same site as `rawasymetal.com`) |
| Application startup file | **`server.js`** |
| Environment variables | **`NEXT_PUBLIC_SITE_URL`** = `https://www.rawasymetal.com` (nothing else) |

## 23. Deployment archive contents / exclusions

Made on a clean Linux build (item 14) right after `npm run build`, before any server runs in that folder (a running
server writes cache files into `.next`), with the README's command:

```bash
tar -czf ../rawasy-app.tar.gz --exclude=.next/cache server.js package.json package-lock.json next.config.ts \
  tsconfig.json next-env.d.ts postcss.config.mjs .nvmrc src public .next
```

- **Included:** the startup file, the package files (for "Run NPM Install"), `next.config.ts` (loaded at start),
  `tsconfig.json` / `next-env.d.ts` / `postcss.config.mjs` / `.nvmrc` and `src/` (the source, so the archive can be
  rebuilt; not read at run time), `public/` (served), `.next/` (the prebuilt application, without its build cache).
  `next-env.d.ts` is generated by `next build` (it is git-ignored), so it exists at that point.
- **Excluded:** `.git`, `node_modules` (never uploaded; least of all a Windows one), `.next/cache` (build cache, 50 MB;
  the image cache rebuilds itself), `e2e/`, `docs/`, `scripts/`, `README.md`, `CLAUDE.md`, `AGENTS.md`,
  `playwright.config.ts`, `eslint.config.mjs`, `test-results/`, `playwright-report/`, screenshots, evidence, logs and any
  `.env` file (none exists; there are no secrets).
- **The archive made in this check:** 17,499,009 bytes, 1,557 files (`.next` 1,229, `public` 148, `src` 172, 8 at the
  top), no `node_modules`, `.git`, `.next/cache`, test or `.env` entry (listed and checked). It stays in this session and
  is not for upload: it holds the build's random preview and server-action keys, so treat any real archive as private
  (it is never served: the application root is outside the document root).
- **Production install:** `NODE_ENV=production npm install` (what the panel's button is expected to run) added 30
  packages in about 20 s (7 s in the rehearsal, npm's cache warm): Next.js, React, `sharp` and their native packages,
  about 460 MB (11,720 files and folders). npm 10 installs both the glibc and the musl variants of the native packages,
  and `@playwright/test` (a dev dependency that is also an optional peer of Next.js, so the lockfile marks it
  `devOptional`; no browser is downloaded). TypeScript, ESLint, Tailwind and axe-core are not installed. **Development
  dependencies are not needed on the server** with the prebuilt `.next`: `next.config.ts` is compiled at start by
  Next.js's own SWC binary (a production dependency), and the pages, styles and images need nothing from the build
  tools (item 28, rehearsal). They would be needed only to build on the host, which this plan avoids.

## 24. DNS not changed

No DNS record, zone or nameserver was read or changed; no DNS tool or registrar was used. The current state is unknown
here. Before any DNS change, record: the registrar and current nameservers; MX, SPF, DKIM and DMARC records; existing A
and CNAME records (apex and `www`); the mail service in use (Namecheap Private Email, Google Workspace or another);
TTLs. Switching to `dns1.namecheaphosting.com` / `dns2.namecheaphosting.com` replaces the zone and can drop the mail
records; the alternative is to keep the current DNS host and change only the A / CNAME records — the owner's decision.

## 25. SSL not changed

Nothing purchased or installed. To check in the actual cPanel before launch: Security → **SSL/TLS Status** (AutoSSL) and
any Namecheap SSL tool the panel offers; a domain-validated certificate can be issued only once `rawasymetal.com` and
`www.rawasymetal.com` resolve to the hosting account (or validate by DNS), so it follows the DNS step. Before launch
verify HTTPS on both names (valid certificate covering both, no mixed content: every asset is same-origin). Decide the
apex ↔ `www` canonical redirect and HTTP → HTTPS redirect after seeing the domain setup (cPanel's Domains → Force HTTPS
Redirect and Redirects, or rules the panel generates); no `.htaccess` rule was written here. The application's canonical
origin stays `https://www.rawasymetal.com`.

## 26. main not changed

`main` = `474f61f10f12981e41f9b7e7fd6065a0ec9da541` before and after (`git ls-remote`). Not fast-forwarded; no pull
request opened. The release branch question waits until the Namecheap process is proven (brief §20).

## 27. Legal launch blocker remains

`src/content/legal.ts` is unchanged since `422c397`; the seven visible "Pending confirmation" notes are still on the
Privacy and Terms pages, among them:

- "RAWASY to confirm the hosting provider and its log settings before launch." — the provider is now known (Namecheap);
  the wording, and what the host's logs hold and for how long, are still to be confirmed by RAWASY;
- "RAWASY to confirm the Google Maps embed wording with its legal adviser before launch.";
- "This wording needs legal review before launch." (Terms);
- and the third-party, retention, request-handling and photo-licence notes.

**External production activation stays blocked until RAWASY resolves them.** The adapter can be reviewed and tested;
it must not go online with those notes visible.

## 28. Exact manual deployment steps

For later, only after the release approval, the legal decision and the DNS inventory. Nothing below was done.

**A. Build (a clean Linux machine or CI, Node.js 22.22.2):**

1. `git clone --branch claude/new-session-5eijs6 https://github.com/Delowar01/Rawasy-Metal-Website.git rawasy-build`,
   `cd rawasy-build`, `git checkout <approved commit>`.
2. `npm ci`
3. `NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build`
4. The `tar` command of item 23 (right after the build); note `sha256sum ../rawasy-app.tar.gz`.
5. Optional local proof, after packing: `NODE_ENV=production PORT=3400 node server.js` and `npm run test:e2e`.

**B. cPanel, first time:**

6. Back up the domain's document root and its `.htaccess` (and any existing site's database or mail settings) before
   changing anything there.
7. Setup Node.js App → Create Application: confirm a **Node.js 22.x** entry exists (otherwise stop and report); enter the
   item 22 settings; Create. The panel creates `~/rawasy-app` (possibly with a starter `server.js`) and writes its
   Passenger lines into the document root's `.htaccess` — leave those lines as generated.
8. Stop App.
9. File Manager → upload `rawasy-app.tar.gz` to the home folder → Extract into `rawasy-app`, replacing the starter files;
   then open `rawasy-app/server.js`: it must be the adapter (its first line reads "Production server for hosts that start
   the app from a file"). Do not upload `node_modules`.
10. Setup Node.js App → the application → **Run NPM Install**; wait for success (the panel shows the output).
11. Check the environment variable (`NEXT_PUBLIC_SITE_URL`) is listed; Save if changed.
12. **Start App**.
13. If an older site's files are in the document root, back them up and move them out (they could answer instead of the
    application); keep `.htaccess` and `.well-known`.
14. Smoke checks (README checklist): before DNS points to the host, from one computer with a hosts-file entry for
    `www.rawasymetal.com` → the server's address (not a DNS change; HTTPS may warn until the certificate exists):
    `/` → 307 `/en`; an Arabic browser → `/ar`; `/en`, `/ar`, a service, `/en/capabilities#cnc-press-brake`, a project
    page, `/en/contact`, `/en/privacy` → 200 with their page; `/en/not-a-page` → 404 page; `/sitemap.xml` 102
    `https://www.rawasymetal.com/` addresses; `/robots.txt` names it;
    `/_next/image?url=%2Fmedia%2Fprojects%2Fclock-tower-1.webp&w=640&q=75` in a browser → WebP; `curl -sI …/en`
    shows `x-nextjs-prerender: 1` and `Cache-Control: s-maxage=31536000` (the production server's answer for a
    prebuilt page); the panel's log shows no error.
15. DNS and SSL: a separate, explicitly authorized step (items 24–25), then the same smoke checks over HTTPS on both
    names.

**Rehearsed locally** (04:21–04:22 UTC; nothing uploaded): steps 1–4 on a fresh clone of `2043981` — `npm ci` 10 s;
`npm run build` 18 s, 109 pages (it created `next-env.d.ts`, absent before the build); the `tar` command verbatim:
17,496,992 bytes, 1,557 files, no forbidden entry — then steps 9–12 in a stand-in application root (another folder,
holding a starter `server.js`): the archive replaced the starter; `NODE_ENV=production npm install` added 30 packages in
7 s (no TypeScript, no ESLint; `sharp` present); `NODE_ENV=production PORT=3510 NEXT_PUBLIC_SITE_URL=… node server.js`
from that root was ready in 482 ms, answered its first `/en` in 69 ms and held 132 MiB; the same `server.js` started
from `/` by its absolute path also served `/en` (the `dir` safeguard). Step 14's checks as a script, **36 / 36**: the
four `/` redirects (plain, Arabic browser, cookie, proxied), `/about` and `/fr/about` → `/en/…`, `/en/` → 308; the 15
pages of the brief → 200, indexable with their canonical, the clock tower with its photos, the billboard without one;
the four unknown addresses → 404 with `noindex`; the sitemap's 102 addresses on `https://www.rawasymetal.com/`; the
robots line; a share image and the icon; an optimized photo as WebP and as JPEG; a remote image and a wrong width → 400;
a missing file → 404; no page (all 102, plus two 404s) referring to a withheld or held-back photo. Then the full E2E
suite against that server: 610 / 612 on a cold image cache, then **612 / 612** after a restart and a warm-up (item 20).

**C. Updates:** build a new archive (A); Stop App; keep the running release's archive (or compress `rawasy-app`
without `node_modules`); delete `rawasy-app/.next` (so no stale build files stay) and extract the new archive; Run NPM
Install when `package-lock.json` changed; Start / Restart; smoke checks.

Logs: the application's entry in Setup Node.js App (its log file where the panel offers one); CloudLinux usually writes
the application's own output to `stderr.log` in the application root; cPanel → Metrics → Errors for the web server. The
first request after a start or an idle spell takes a few seconds (Passenger starts the app on demand; a cold start read
`next.config.ts` in 3.5 s here, a warm one in 27–40 ms).

## 29. Rollback plan

- **Code:** the approved release candidate `422c397` (`preserve/pre-namecheap-adapter`, `preserve/pre-stage-1j` before
  1J). `422c397` itself has no startup file; `2043981` serves the same build (item 10) with one, so on Namecheap the unit
  of rollback is a **previously verified archive**, not a commit.
- **Namecheap:** keep the previous application archive (and its build) until the new release is verified in
  production. To roll back: Stop App → delete `rawasy-app/.next` (or restore the saved folder) → extract the previous
  archive → Run NPM Install → Start → smoke checks.
- **Existing site:** never delete an existing live site's files without a backup; restore them and the `.htaccess` from
  that backup if the domain must go back to it (and remove or disable the Node.js application in the panel).
- **DNS (later):** keep the recorded previous records; reverting a record takes up to its TTL.
- Because the current live domain state is unknown, the production rollback is finalised after the cPanel inspection.

## 30. Remaining inputs required from the owner

1. **Independent review and approval** of this adapter (and the release itself); the builder does not self-approve.
2. **Legal decision on the seven pending notes** (item 27) — the launch blocker; the hosting-provider note now needs
   Namecheap's log details.
3. **The cPanel facts:** the Node.js 22.x entries offered (exact version), the web server (Apache with Passenger or
   LiteSpeed), Terminal / SSH access, `ldd --version` (glibc ≥ 2.28), the account's limits (memory, processes, inodes,
   disk), and whether `rawasymetal.com` is the account's primary or an addon domain (its document root).
4. **The current domain state:** registrar, nameservers, MX / SPF / DKIM / DMARC / A / CNAME, the mail service, and
   whether a site is live on the domain now (what is in the document root, and its backup).
5. **SSL path** available in the panel, and the apex ↔ `www` and HTTP → HTTPS redirect decision.
6. **Who builds the archive** (a clean Linux machine or CI) and keeps the previous ones; whether `main` becomes the
   release branch later.
7. **The 10 withheld / held-back photos** in `public/media/projects/`: no page links them, but they answer at their
   direct addresses; decide whether to leave them out of the upload archive or remove them from `public/` in a content
   stage.
8. **Accept or revert the four `server.js` variations** (item 6); reverting to the literal preferred shape is a small
   change but brings back the dev-server start without `NODE_ENV` and exit code 0 on a failed start.
9. **The image-optimizer finding** (item 12): warm-up after each start (a), wait for a Next.js fix (b) or accept (c);
   a warm-up script for the live site would be a new file in the repository and needs your go-ahead.

## Known limitations

- **Next.js 16.3.8's image optimizer** can leave an image size unanswered after a cancelled first request, on
  `next start` and `server.js` alike, until the process restarts (item 12). Not fixed here; options for RAWASY.
- Nothing about the actual account was verified (no access): items 9 and 30 list what must be confirmed in the panel.
- The Passenger / CloudLinux behaviours in this report are the documented behaviour of those products, not observed.
- `server.js` prints "Ready on http://0.0.0.0:3000" under Passenger too (it does not know Passenger replaced the
  socket); harmless.
- A production install still pulls `@playwright/test` (no browsers) and both glibc and musl native packages (~460 MB).
- Directly addressed withheld photos stay reachable (item 12), as in the approved RC.
- Several Passenger processes of the app would share one `.next` render cache (item 10 note): the cache headers of an
  unknown address can differ between processes; status and page do not.
- The process peaks at about 0.5 GB while optimizing many new images at once (a cold image cache); whether the account's
  memory limit allows that is unknown until the panel is inspected (item 30).
- The smoke checklist is manual (README and item 28); the script used here stays in this session.

## How to run

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
NODE_ENV=production PORT=3400 node server.js     # or: npm start (production, port 3000)
npm run test:e2e                                  # another terminal: Playwright reuses the server on 3400
```

## Next steps

Independent review of this adapter → RAWASY's legal decision on the pending notes → cPanel inspection (items 9, 30) →
an explicitly authorized upload and smoke test → DNS and SSL as separate authorized steps. No Phase 2 work.

---

# Correction 1 — production archive safety and image warm-up

Date: 2026-10-09 · Branch: `claude/new-session-5eijs6` · Status: **correction prepared and proven locally; awaiting
independent review.** The brief: "NAMECHEAP ADAPTER — CORRECTION 1 / PRODUCTION ARCHIVE SAFETY + IMAGE WARM-UP
PROCEDURE". Only the deployment package and procedure changed (two commits, `e0d62b0` and `79cdff5`): no page,
content, style, test, `server.js`, `package.json`, lockfile, Node version, dependency or `legal.ts` change. Nothing
was uploaded to Namecheap, no application was created, DNS, nameservers and SSL were not touched, `main` was not
changed. The site is not online.

## Summary

- **Withheld media leave the package.** `scripts/package-namecheap.mjs` (new, deployment only) makes the archive the
  README describes, less the ten photos RAWASY has held back, and checks it. The ten files come from the website's own
  rules (`withheldMedia` and every photo of a project whose flags keep its photos off the website, in
  `src/content/projects.ts`), each mapped to its file through the media registry (`src/content/media.generated.ts`);
  they are exactly the ten IDs of the brief, all `.webp`. They stay in Git and in the source folder; only the archive
  leaves them out. The script fails, and deletes the archive, if a held-back file is in it, if any page refers to one,
  if a public file the build refers to is missing, if a sitemap page's HTML, page data or public files are missing, or
  if anything else is missing or added. A second commit leaves out the route cache a server writes into `.next`, which
  the first version packed (and passed) when the build folder had already been served.
- **Proven on the package:** extracted into a clean application root, production install, `node server.js`: the ten
  direct addresses answer **404** (the source folder still answers 200), every other public file **200** with the
  source bytes, all **102** sitemap pages 200, every project page shows exactly its allowed photos, all **1,484**
  optimized image sizes 200 WebP.
- **Gentle warm-up for the known Next.js 16.3.8 defect.** `scripts/warm-images.mjs` (new, deployment only, run by
  hand from another computer) asks once for every image size the pages offer, **at most 2 at a time** (never above 4),
  reading each answer to its end, never cancelling early; it stops on a busy host (429 / 503 / 508), after 5 problems in
  a row or 10 in all, or on Ctrl+C, and reports discovered / warmed / failed / timed out / not attempted, with
  `--retry=<report>` for exactly the sizes that did not warm. Measured with a counting proxy in front of the server:
  never more than 2 requests open.
- **The defect showed up again and the procedure fixed it:** the clean clone's first E2E run (cold image cache) ended
  610 / 612 — the same two `/en/about` photo tests as in item 12, one image size stuck after a cancelled first request.
  After a restart and the warm-up: **612 / 612**. The package after its warm-up: **612 / 612** (`e0d62b0`) and
  **612 / 612** (`79cdff5`).
- Clean clones at both commits: `npm ci` ✔, `npm audit --omit=dev` **0**, lint ✔, typecheck ✔, build ✔ (109 pages);
  each build equals the approved adapter's (1,221 of 1,224 files identical, the 3 others hold Next's per-build random
  keys).

## C1-1. Starting SHA

`5c0b2b6ddbce83f82c2d6aca0169e6a422d066dd` (as the brief expected; clean tree, equal to `origin`). Approved adapter
implementation `2043981a066274e0a9cac68c5b7b4eff608561f0`; checkpoint `preserve/pre-namecheap-adapter` →
`422c397c56ec500afc270cf69a7e5a298c25f29f` (unchanged).

## C1-2. Correction SHA

**`79cdff5bbd205e81499d14edd42d5f5260a36772`**, the correction's last code commit; the correction is two commits:

1. `e0d62b0211d885486c42f77c61c68969f4de5d98` — "Namecheap package: leave out the held-back photos; gentle image
   warm-up": `scripts/package-namecheap.mjs` (new), `scripts/warm-images.mjs` (new), `README.md` (the Namecheap
   section);
2. `79cdff5bbd205e81499d14edd42d5f5260a36772` — "Namecheap package: leave a server's route cache out of the archive":
   `scripts/package-namecheap.mjs` and one README sentence (C1-6, "Route cache").

`git diff 5c0b2b6 79cdff5` touches only those three files; `server.js`, `package.json`, `package-lock.json`, `src/`,
`public/`, `e2e/` and `next.config.ts` are identical to `2043981`.

## C1-3. Branch HEAD

The commit that adds this section (and the CLAUDE.md note), directly on top of `79cdff5`; its hash is given in the
hand-off message (a commit cannot contain its own hash).

## C1-4. The ten physical files excluded

Derived, not typed in: for every project record, the photos `projectDetailMedia(project)` does not show, plus
`withheldMedia`, each looked up in `mediaRegistry[id].src` (the script fails if an ID is not in the registry or its
file does not exist). Result — exactly the brief's ten IDs, 133,982 bytes in all:

| Media ID | Physical file (from the registry) | Bytes | Project | Why held back |
| --- | --- | ---: | --- | --- |
| `projects/billboard-structure-1` | `public/media/projects/billboard-structure-1.webp` | 18,812 | `billboard-support-structure` | withheldMedia |
| `projects/canopy-tree-1` | `public/media/projects/canopy-tree-1.webp` | 33,890 | `canopy-tree-sculpture` | project flag confirm-authorship |
| `projects/laser-cut-bench-1` | `public/media/projects/laser-cut-bench-1.webp` | 9,380 | `laser-cut-bench` | project flag render |
| `projects/lattice-cubes-1` | `public/media/projects/lattice-cubes-1.webp` | 23,294 | `illuminated-lattice-cubes` | project flag confirm-authorship |
| `projects/litter-bins-1` | `public/media/projects/litter-bins-1.webp` | 1,478 | `street-litter-bins` | project flag render |
| `projects/litter-bins-2` | `public/media/projects/litter-bins-2.webp` | 1,932 | `street-litter-bins` | project flag render |
| `projects/litter-bins-3` | `public/media/projects/litter-bins-3.webp` | 1,662 | `street-litter-bins` | project flag render |
| `projects/seed-sculpture-1` | `public/media/projects/seed-sculpture-1.webp` | 19,726 | `perforated-seed-sculpture` | project flag confirm-authorship |
| `projects/stainless-landmark-1` | `public/media/projects/stainless-landmark-1.webp` | 11,366 | `stainless-landmark-sculpture` | withheldMedia |
| `projects/wheat-monument-1` | `public/media/projects/wheat-monument-1.webp` | 12,442 | `wheat-stalks-monument` | withheldMedia |

`wheat-monument-2` and `-3` (the genuine workshop photos of the same monument) stay, as the website shows them.

## C1-5. Production archive command

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
node scripts/package-namecheap.mjs          # → ../rawasy-app.tar.gz and ../rawasy-app.tar.gz.txt (its listing)
```

The `tar` command the script ran (printed by it; GNU tar 1.35):

```bash
tar -czf ../rawasy-app.tar.gz --exclude=.next/cache --exclude=.next/server/route-cache \
  --exclude=public/media/projects/billboard-structure-1.webp --exclude=public/media/projects/canopy-tree-1.webp \
  --exclude=public/media/projects/laser-cut-bench-1.webp --exclude=public/media/projects/lattice-cubes-1.webp \
  --exclude=public/media/projects/litter-bins-1.webp --exclude=public/media/projects/litter-bins-2.webp \
  --exclude=public/media/projects/litter-bins-3.webp --exclude=public/media/projects/seed-sculpture-1.webp \
  --exclude=public/media/projects/stainless-landmark-1.webp --exclude=public/media/projects/wheat-monument-1.webp \
  server.js package.json package-lock.json next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs .nvmrc src \
  public .next
```

The included names are the approved archive's, unchanged (item 23); only the ten photo exclusions and the route cache
(C1-6) are new. `node
scripts/package-namecheap.mjs --check=<archive>` re-checks any archive against the folder's build (it never deletes
that archive). The script is deployment only: not in `package.json`, not imported by the site, not in the archive.

## C1-6. Archive verification

On the clean clone of `79cdff5` (C1-13), right after `npm run build`:

```
✓ the archive's build (_7siFLgs0uYOfa8M1utBY) is this folder's build (_7siFLgs0uYOfa8M1utBY)
✓ held-back files in the archive: 0 of 10
✓ every packed name is there: server.js package.json package-lock.json next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs .nvmrc src public .next
✓ nothing else left out: 1547 of 1547 files
✓ nothing added: 0 unexpected files
✓ no node_modules, .next/cache, route cache, .git, .env file, tests or docs
✓ pages, page data, styles or scripts referring to a held-back file: 0
✓ public files the build refers to, in the archive: 111 of 111 (media 108, og 2, brand 1; 637 files read)
✓ sitemap pages: 102, each with its HTML and page data and the 644 public file references they make (111 files) in the archive
PASS
```

- **The archive:** 17,362,492 bytes (16.6 MB), sha256 `1eae102010e3ccdc0383cedeb466bac71bf3a9f811a7fbfb48b9ccd3b2b6b233`,
  1,547 files (`.next` 1,229, `public` 138, `src` 172, 8 at the top); listing 2,156 entries (files and folders),
  written beside it. `public/media/projects/` holds 47 photos (57 in the source, less the 10). The `e0d62b0` clone's
  archive (17,363,394 bytes, sha256 `26992465…`) lists the same entries once the build ID is normalised.
- **"Production-used" files** are found in what the server sends: every prerendered page, page data and metadata body
  in `.next/server/app` (`.html`, `.rsc`, `.body`, the segment files) and the browser's styles and scripts in
  `.next/static` — 637 files; a public path counts as written (`/media/…`) or encoded in an optimized image's address
  (`url=%2Fmedia%2F…`). Server-only code is not read (it holds the whole media registry, held-back entries included,
  and is never sent).
- **Each sitemap page** (from the build's own `sitemap.xml`): its `.html` and `.rsc` are in the archive, and so is every
  public file they and the page's segment files refer to.
- **Negative tests (the check must fail):** an archive made with the previous README command from the same build →
  **FAIL** (held-back files 10 of 10; 10 unexpected files), exit 1. On the trial build: an archive missing one used photo
  (`clock-tower-1.webp`) → FAIL (nothing else left out, the used-file check, and 12 sitemap pages named); an archive
  with an `.env.production` and a `.next/cache` file → FAIL (both named); an archive of another build → FAIL (build
  ID); a missing archive, an unknown option or an output inside `src`, `public` or `.next` → refused (exit 2). In
  packing mode a failed check deletes the archive and its listing.
- **Route cache (commit `79cdff5`):** a server that runs on a build writes its route cache into
  `.next/server/route-cache` (`APP_PAGE` / `APP_ROUTE`: 724 files after the clone's two E2E runs, 796 on the package);
  outside it and `.next/cache`, a used `.next` stayed byte-identical to the fresh build (sha1 of every file, on the
  clone and on the package). The first version of the script, run on the used clone, packed 2,271 files (26.5 MB) and
  passed its own check, since it compared the archive with the same folder. Now: on the same used folder it packs 1,547
  files whose extracted contents equal the fresh archive's (`diff -r`: identical); `--check` of the fresh archive there
  passes (the first version failed it: 1,547 of 2,271); `--check` of the 2,271-file archive fails (724 unexpected files,
  route cache named).
- **Kept, as the brief says ("the remainder of `public/`"):** 27 public files no page refers to — 21 monochrome client
  logos (`*-mono.webp`), 2 brand SVGs, 1 certificate thumbnail, and the three laser-engraving photos the asset
  inventory flags (`services/engraving-nameplates.webp` — third-party brand, part and serial numbers —
  `engraving-rotary.webp`, `engraving-wood.webp`). They answer at their direct addresses, as the ten did before this
  correction; see C1-21.

## C1-7. Direct held-back URL result

Package server (`node server.js` from the extracted archive, C1-9): each of the ten addresses
`/media/projects/<file>.webp` answers **404** (`text/html`, Next.js's not-found page, the same answer as any address
under `/media/` with no file); its optimized forms `/_next/image?url=…&w=640&q=75` and `&w=3840&q=75` answer **400**
("The requested resource isn't a valid image."), at once (under 40 ms for each address), and serve no image. For
comparison, a server started in the source folder (the clone) still answers **200 `image/webp`** for all ten: the
source keeps them, the package does not.

## C1-8. Legitimate image result

Package server: **138 / 138** — every file in the package's `public/` answered 200 with bytes identical (sha256) to
the source file, among them the **47** project photos; every public file the pages refer to (111) answered 200 with
the source bytes. Optimized: after the warm-up, **1,484 / 1,484** — every `/_next/image` size the 102 pages offer
answered `200 image/webp` with a WebP body (`x-nextjs-cache: HIT`), from 108 source files; none of them is a held-back
file.

## C1-9. Sitemap / page smoke

Done twice, on the archive of each commit, with the same results; the numbers below are the final archive's
(`79cdff5`). The archive extracted into a new, empty application root; `NODE_ENV=production npm install` (added 30
packages in 9 s, 462 MB, "found 0 vulnerabilities"; no TypeScript or ESLint installed); `NODE_ENV=production PORT=3410
node server.js` ready in under a second (the first page answered 805 ms after the launch).

- **The adapter's 36-check smoke** (redirects, language, pages, 404s, sitemap, robots, images, refusals, held-back
  references): **36 / 36**.
- **All 102 sitemap pages:** 200 `text/html`, each with its own `lang`, its canonical address and one `h1`
  (102 / 102); the four 404 addresses (`/en/not-a-page`, `/ar/not-a-page`, an unknown service, an unknown project)
  404.
- **Project media safety:** no sitemap or 404 page refers to a held-back file (0 references on 106 pages); each of the
  68 project pages refers to exactly the photos `projectDetailMedia` allows (68 / 68); the projects with held-back
  photos show none of them.
- **The full E2E suite against the package** after its warm-up: **612 / 612** (`e0d62b0`), **612 / 612**
  (`79cdff5`) (C1-18).

## C1-10. Image optimizer mitigation

Unchanged code, as the brief requires: Next.js internals not patched, image optimization on, `next/image` usage and
every dependency unchanged. The mitigation is operational (README, "Image cache warm-up"): after the first start of
every new build, warm the image cache from another computer; a size that still fails is retried only after a restart.
A size in the cache (`.next/cache/images`, kept across restarts) is answered from there and is immune (item 12:
300 / 300 cut-off requests answered `200 HIT`). This session showed both halves again:

- **Cold:** the clean clone's server, cold cache, full E2E: **610 / 612** — `commerce-company.spec.ts:479` (images to
  decode on `/en/about`) and `stage-1c.spec.ts:129` (`/en/about`'s `load`) timed out at 60 s, the same two tests as
  item 12. A probe during the run found exactly one stuck size,
  `/_next/image?url=%2Fmedia%2Fmachines%2Flaser-welding.webp&w=64&q=75` (no answer in 8 s, on `/en/about` and
  `/ar/about`; every other size of the five company pages answered). Not caused by this correction: no website code
  changed and the build equals the adapter's.
- **The procedure:** restart (the size then answered in 0.25 s), warm-up (1,484 warmed: 679 new, 805 already cached by
  the first run; 0 failed, 0 timed out), the full suite again: **612 / 612**.

Recommendation unchanged: (a) the warm-up for launch, (b) a Next.js release that fixes the defect when one is available
(a dependency change, for RAWASY to authorize).

## C1-11. Warm-up method

`scripts/warm-images.mjs` (Node 18 or later, no dependency, not in `package.json`, never started by the app):

1. reads `/sitemap.xml` at the given address (the sitemap names `https://www.rawasymetal.com`; its paths are asked for
   at the given address, so it also works before the domain points to the app);
2. opens each page (`Accept: text/html`) and collects every `/_next/image` address in its `src`, `srcset` and
   `imagesrcset` attributes (React writes `srcSet` / `imageSrcSet`; matched without regard to case) — every size a
   browser may choose: **1,484** for this build, from 108 photos;
3. asks for each size once with a browser's `Accept` (`image/avif,image/webp,…`, so the WebP variant browsers get) and
   a `User-Agent` naming the script, reads the whole answer, and counts it warmed when it is `2xx`, `image/*` and not
   empty (new for `x-nextjs-cache: MISS`, already cached otherwise);
4. never cancels a request early; one that has not finished after `--timeout` (60 s) counts as timed out — it is never
   retried in the same run;
5. stops starting requests, letting the running ones finish, when the host answers 429, 503 or 508 (CloudLinux's
   "Resource Limit Is Reached"), after 5 problems in a row or 10 in all, or on Ctrl+C (a second Ctrl+C quits);
6. prints and writes the totals — **discovered, warmed (new / already cached), failed, timed out, not attempted** —
   with every failed, timed-out and not-attempted address in `warm-images-report.json`; exit 0 only when everything
   warmed;
7. `--retry=<report>` asks again for exactly the addresses that report lists (after looking at them; a timed-out size
   needs an app restart first).

Tested locally (first on a trial archive of the working checkout's build, then on the clean clone and the package):

| Case | Result |
| --- | --- |
| Cold cache, defaults | 1,484 discovered, 1,484 warmed (all new), 0 failed, 0 timed out; 101.7 s; median 21 ms, max 455 ms |
| The packages (C1-9), cold, defaults | 1,484 discovered, 1,484 warmed (1,483 new), 0 failed, 0 timed out; 103 s each |
| Run again (all cached), `--concurrency=4 --pause=0` | 1,484 already cached, 2.9 s |
| Two sizes made stuck first (a first request cut off after 0–1 ms), `--timeout=10` | 1,482 warmed, **2 timed out** (both named), exit 1; the run went on |
| `--retry` before a restart | the same 2 time out again (the defect holds until restart), exit 1 |
| `--retry` after a restart | 2 warmed, exit 0; a full run then: 1,484 already cached (the cache survived the restart) |
| Host at its limit (every image 508) | stopped after the 2 requests running, 19 not attempted, exit 1 |
| App stopped during discovery / during warming | stopped after 5 problems in a row (`ECONNREFUSED`), 1,415 / 1,375 not attempted; `--retry` after a restart resumed and warmed 1,380 |
| Every other image 500 | stopped at 10 problems in all (9 warmed, 10 failed, 21 not attempted) |
| Ctrl+C | stopped, waited, report written: 54 warmed, 1,430 not attempted, exit 1 |
| `--concurrency=5` or `0`, `--timeout=0`, unknown option, no or non-HTTP address | refused, exit 2 |

## C1-12. Warm-up concurrency

Default **2**, accepted **1 to 4**, anything else refused. Measured on the server's side with a counting proxy between
the script and the app: **at most 2 requests open at once** in every default run (trial: 1,484 images + 102 pages;
clean clone and both packages: 1,587 requests each — `maxOpen 2` every time), 4 with `--concurrency=4`. 100 ms pause
between one worker's requests. Server memory (resident peak, `VmHWM`), a fresh package server warming an empty cache:
**471 MiB at 2 at a time (103 s)**, **436 MiB at 1 at a time (208 s)**, from 130 MiB at start; the package server that
had first answered the page checks peaked at 562 MiB during its warm-up and stayed there through the full E2E suite.
`--concurrency=1` is the lighter choice if the account's memory limit is tight (C1-21).

On the host: watch cPanel → Metrics → **Resource Usage** (CPU, physical memory, entry processes, number of processes,
I/O) during and after the warm-up; the script stops on its own at a 508. Never loop it, schedule it, run several at
once or load-test the host.

## C1-13. Clean install

Fresh clones of `e0d62b0` and `79cdff5` (clean trees, no untracked file), Node 22.22.2, npm 10.9.7: `npm ci` added
374 packages (14 s and 11 s). Package roots: `NODE_ENV=production npm install` added 30 packages (8 s and 9 s), 462 MB,
"found 0 vulnerabilities"; no TypeScript or ESLint installed.

## C1-14. Production audit

`npm audit --omit=dev` (both clones): **found 0 vulnerabilities**. (With development dependencies: the known 5 high
entries of the lint-only `eslint-config-next` chain, unchanged; never fixed with `--force`.)

## C1-15. Lint

`npm run lint` (both clones): exit 0, no warning (13 s, 12 s); the two new scripts are linted with the rest.

## C1-16. Typecheck

`npm run typecheck` (both clones): exit 0 (9 s, 12 s).

## C1-17. Build

`NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build` (both clones): exit 0 (22 s each), 109 / 109 pages.
Each compared with the approved adapter's clean build (`2043981`, build ID and folder normalised), and with each other:
1,221 of 1,224 files identical; the other 3
(`prerender-manifest.json`, `server/server-reference-manifest.{js,json}`) differ only in Next.js's random per-build
keys (`previewModeId`, `previewModeSigningKey`, `previewModeEncryptionKey`, `encryptionKey`); no file only on one side.

## C1-18. E2E

| Run | Server | Result |
| --- | --- | --- |
| 1 | clean clone, `node server.js`, cold image cache | 610 / 612 (23.4 min) — the 2 `/en/about` photo timeouts (C1-10) |
| 2 | the same, after a restart and the warm-up | **612 / 612** (22.7 min) |
| 3 | the `e0d62b0` package, extracted, production install, `node server.js` on port 3410, after the warm-up | **612 / 612** (23.7 min) |
| 4 | the `79cdff5` package, the same way | **612 / 612** (23.7 min) |

No test changed or skipped.

## C1-19. Legal blocker unchanged

`src/content/legal.ts` is byte-identical to `422c397` (sha256 `2b6e5494…`); the seven visible pending notes are still on
the Privacy and Terms pages. **No public deployment until RAWASY resolves them.**

## C1-20. Nothing published

No upload to Namecheap, no cPanel application, no DNS or nameserver change, no SSL, no domain connected, `main` not
changed (`474f61f`), nothing published. Every server in this correction ran on this machine and was stopped.

## C1-21. Items needing RAWASY's confirmation

1. **Independent review** of this correction; the builder does not self-approve.
2. **The three flagged laser-engraving photos** (`public/media/services/engraving-nameplates.webp`,
   `engraving-rotary.webp`, `engraving-wood.webp`) and the 24 other unreferenced public files are still in the archive,
   as the brief says; no page shows them, but they answer at their direct addresses. Leaving the three flagged ones out
   too would be one more rule in the packaging script — your decision.
3. **The image-optimizer decision** (item 12): the warm-up is now the documented launch step; a Next.js upgrade that
   fixes the defect needs your authorization.
4. **The account's memory limit** (cPanel → Resource Usage, item 30): a cold warm-up peaked at 471 MiB at 2 requests
   at a time and 436 MiB at 1 (C1-12); if the limit is close to that, warm with `--concurrency=1`.
5. Everything item 30 lists (the legal notes, the cPanel facts, the domain state, SSL) still holds.

## C1-22. Known limitations

- The warm-up covers the sizes the pages offer to browsers that accept WebP (all current browsers); a client without
  WebP gets the source format, a separate cache entry, not warmed.
- A visitor can still meet a stuck size between a start and the end of the warm-up (about 1.5–2 minutes locally; longer
  on the host), and after a cache entry is lost (an update that deletes `.next`); the defect is Next.js's.
- The packaging script needs Node 22.18 or later (TypeScript content read by type stripping) and `tar`; the README's
  build machine is Linux.
- `--check` compares an archive with the build in the folder it runs in; it cannot check an archive of another build.

## C1-23. How to run

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
node scripts/package-namecheap.mjs                       # archive + checks
# after the app starts on the host (not now), from your own computer:
node scripts/warm-images.mjs https://www.rawasymetal.com
node scripts/warm-images.mjs https://www.rawasymetal.com --retry=warm-images-report.json   # only if needed, after a restart
```

Locally: `NODE_ENV=production PORT=3400 node server.js`, then `node scripts/warm-images.mjs http://localhost:3400` and
`npm run test:e2e`.

## C1-24. Next steps

Independent review of this correction → RAWASY's decisions (C1-21, item 30) → an explicitly authorized upload, smoke
test and warm-up → DNS and SSL as separate authorized steps. No Phase 2 work.

---

# Correction 2 — Laser Engraving deployment-media exclusion

Date: 2026-10-09 · Branch: `claude/new-session-5eijs6` · Status: **correction prepared and proven locally; awaiting
independent review.** The brief: "NAMECHEAP ADAPTER — CORRECTION 2 / EXCLUDE THE THREE HELD-BACK LASER-ENGRAVING
ASSETS". Package filtering only: the three files stay in Git and in the source folder; no page, content, media file,
service drawing, `server.js`, `package.json`, lockfile, Node, Next.js or React version, `warm-images.mjs` or `legal.ts`
changed. Nothing was uploaded to Namecheap, cPanel was not touched, DNS, nameservers and SSL were not changed, `main`
was not changed. The site is not online.

## Summary

- `scripts/package-namecheap.mjs` gains an explicit, deployment-only media-ID list, `HELD_BACK_MEDIA`, for the three
  Laser Engraving images the asset inventory keeps off every page (`docs/ASSET_INVENTORY.md`, item 12; decision D6).
  They are resolved through the media registry by the same code as the ten project photos; an ID the registry does not
  know, or whose file is missing, stops the run before anything is packed. The archive now leaves **13** files out, and
  every existing check covers all thirteen.
- Proven on a clean clone and on the extracted package: the thirteen addresses answer **404**, their optimized forms
  **400** with no image; the Laser Engraving page shows its approved drawn plate in both languages with no image to
  break; all 102 sitemap pages, 135 / 135 packaged public files, 68 / 68 project pages and 1,484 / 1,484 optimized sizes
  pass; warm-up 1,484 / 1,484 (0 failed, 0 timed out); full E2E against the package after the warm-up:
  **612 / 612**.
- The archive is Correction 1's minus exactly the three engraving files (entries compared with the build ID
  normalised); the build is Correction 1's (1,221 of 1,224 files identical, the 3 others hold Next.js's random
  per-build keys).

## C2-1. Starting SHA

`a6f33d13e535d15fff3d65b384bf19af8cf80688`, as the brief expected (clean tree, equal to `origin`). Approved adapter
`2043981a066274e0a9cac68c5b7b4eff608561f0`; Correction 1 implementation `79cdff5bbd205e81499d14edd42d5f5260a36772`.

## C2-2. Implementation SHA

**`c1841ef94e09c2a90049396566dbea4ef3f15b90`** — "Namecheap package: leave the three held-back Laser Engraving images
out": `scripts/package-namecheap.mjs` and `README.md` only. `git diff a6f33d1 c1841ef` touches those two files;
`src/`, `public/`, `e2e/`, `next.config.ts`, `server.js`, `package.json`, `package-lock.json` and
`scripts/warm-images.mjs` are identical to `a6f33d1`.

## C2-3. Final branch HEAD

The commit that adds this section (with the CLAUDE.md note and the Correction 1 erratum below), directly on top of
`c1841ef`; its hash is given in the hand-off message (a commit cannot contain its own hash).

## C2-4. The three media IDs

`services/engraving-nameplates`, `services/engraving-wood`, `services/engraving-rotary` — the list `HELD_BACK_MEDIA` in
`scripts/package-namecheap.mjs`, documented there: media the asset inventory keeps off every page that no content rule
derives (`docs/ASSET_INVENTORY.md`, open question 12; decision D6). `engraving-nameplates` shows third-party (HITACHI)
branding with legible part and serial numbers and awaits RAWASY's permission; `engraving-wood` and `engraving-rotary`
are renders; the Laser Engraving page and the services overview draw an engraved plate instead. An ID leaves the list
only once RAWASY approves showing that image. The list holds media IDs, not file names.

## C2-5. Registry-derived physical filenames

Resolved by `mediaRegistry[id].src`, exactly like the project photos (the same code path):

| Media ID | Registry `src` | Physical file | Bytes | Why |
| --- | --- | --- | ---: | --- |
| `services/engraving-nameplates` | `/media/services/engraving-nameplates.webp` | `public/media/services/engraving-nameplates.webp` | 16,000 | third-party branding, part and serial numbers; permission pending |
| `services/engraving-rotary` | `/media/services/engraving-rotary.webp` | `public/media/services/engraving-rotary.webp` | 5,290 | render |
| `services/engraving-wood` | `/media/services/engraving-wood.webp` | `public/media/services/engraving-wood.webp` | 8,412 | render |

Fail-closed, tested on the clean clone: with an ID the registry does not know added to the list,
"`services/engraving-missing: not in the media registry. FAIL: nothing was packed.`", exit 1, no archive written; with
`engraving-wood.webp` moved away, "`services/engraving-wood: public/media/services/engraving-wood.webp does not
exist. FAIL: nothing was packed.`", exit 1, no archive (the file was put back, same bytes, clean tree).

## C2-6. Total exclusion count

**13** files, 163,684 bytes: the 10 project photos from `projects.ts` (`withheldMedia` and every photo
`projectDetailMedia` leaves out; unchanged, Correction 1 item C1-4) and the 3 above. The script prints each with its
source:

```
Held back (13 files, through the media registry):
  public/media/projects/billboard-structure-1.webp  projects.ts
  public/media/projects/canopy-tree-1.webp          projects.ts
  public/media/projects/laser-cut-bench-1.webp      projects.ts
  public/media/projects/lattice-cubes-1.webp        projects.ts
  public/media/projects/litter-bins-1.webp          projects.ts
  public/media/projects/litter-bins-2.webp          projects.ts
  public/media/projects/litter-bins-3.webp          projects.ts
  public/media/projects/seed-sculpture-1.webp       projects.ts
  public/media/projects/stainless-landmark-1.webp   projects.ts
  public/media/projects/wheat-monument-1.webp       projects.ts
  public/media/services/engraving-nameplates.webp   asset inventory, item 12
  public/media/services/engraving-rotary.webp       asset inventory, item 12
  public/media/services/engraving-wood.webp         asset inventory, item 12
```

Not broadened: the other 24 public files no page refers to (21 monochrome client logos, 2 brand SVGs, 1 certificate
thumbnail) stay in the archive.

## C2-7. Archive size and hash

`rawasy-app.tar.gz` from the clean clone of `c1841ef`, packed right after `npm run build`: **17,333,572 bytes
(16.5 MB)**, sha256 **`cac7e95d6d61847585de596cc5207a39b41d8edb6186f67a85949590d2352678`**, build
`JLLK_IYfSLhpJYj2PVaU0`; 1,544 files (`.next` 1,229, `public` 135, `src` 172, 8 at the top), listing 2,153 entries. The
`tar` command it ran: Correction 1's, plus `--exclude=public/media/services/engraving-nameplates.webp
--exclude=public/media/services/engraving-rotary.webp --exclude=public/media/services/engraving-wood.webp`.

## C2-8. Archive verification

```
✓ the archive's build (JLLK_IYfSLhpJYj2PVaU0) is this folder's build (JLLK_IYfSLhpJYj2PVaU0)
✓ held-back files in the archive: 0 of 13
✓ every packed name is there: server.js package.json package-lock.json next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs .nvmrc src public .next
✓ nothing else left out: 1544 of 1544 files
✓ nothing added: 0 unexpected files
✓ no node_modules, .next/cache, route cache, .git, .env file, tests or docs
✓ pages, page data, styles or scripts referring to a held-back file: 0
✓ public files the build refers to, in the archive: 111 of 111 (media 108, og 2, brand 1; 637 files read)
✓ sitemap pages: 102, each with its HTML and page data and the 644 public file references they make (111 files) in the archive
PASS
```

- **Against Correction 1's archive** (`79cdff5`, build `_7siFLgs0uYOfa8M1utBY`): with the build ID normalised, the two
  listings differ in exactly three entries, the three engraving files.
- **Failure cases (each must fail):**
  - an archive made by Correction 1's script from this build → `--check`: **FAIL** — held-back files 3 of 13 and 3
    unexpected files, all three named; `--check` keeps the archive it was given;
  - an unknown ID or a missing file → exit 1, nothing packed (C2-5);
  - a copy of this build in which `/en/services/laser-engraving`'s HTML refers to `engraving-wood.webp` →
    **FAIL**, 3 checks: the held-back reference, the used-file check and the sitemap page named; the new archive and
    its listing were deleted, exit 1. (The clone's own page was untouched.)

## C2-9. Direct excluded URLs

On the extracted package (`node server.js`, port 3410), all **13** addresses `/media/…` answer **404** (`text/html`,
the same answer as any missing file under `/media/`). Each one's `/_next/image` form, at `w=640` and `w=3840`
(`q=75`), answers **400** with the 43-byte text "The requested resource isn't a valid image." — no image, no bytes of the
file; every answer within 35 ms. The files are still in the source folder and in Git (checked).

## C2-10. Legitimate Laser Engraving page

Checked in Chromium on the package at 1440 × 900, `/en/services/laser-engraving` and `/ar/services/laser-engraving`, light
and dark (4 views):

- **200**; `lang` `en` / `ar-SA`, `dir` `ltr` / `rtl`; one `h1`, "Laser Engraving" / "الحفر بالليزر"; titles "Laser
  Engraving | RAWASY" / "الحفر بالليزر | رواسي"; canonical `https://www.rawasymetal.com/{en,ar}/services/laser-engraving`;
  sections overview, scope, process, applications, why, related.
- **The approved drawing:** the hero holds the drawn engraved brass plate (`.sig-engrave`), 502 × 352 px, 124 drawn
  shapes, visible, after its sequence finished; screenshots reviewed.
- **No broken image:** the page has no `<img>` at all (as approved: no photographs on the engraving page), so none can
  break; 0 failed requests, 0 console errors.
- **No reference to the excluded files:** none of the 13 names appears in the page's HTML and none is requested; the
  page asks for no file under `/media/` and no `/_next/image` (only its scripts, styles and web fonts).
- The E2E suite's own Laser Engraving tests (no photographs, the hero drawing, the three IDs absent from the page and
  the services overview) passed in the run below.

## C2-11. Legitimate media regression

On the package: **135 / 135** public files answer 200 with bytes identical (sha256) to the source — by folder: brand 3,
certificates 8, clients 42, machines 6, projects 47, services 19, site 8, `og` 2; every public file the pages refer to,
**111 / 111**, answers 200 with the source bytes; after the warm-up, **1,484 / 1,484** optimized sizes answer `200
image/webp` with a WebP body (`x-nextjs-cache: HIT`), from 108 photos, none of them held back.

## C2-12. Sitemap and page smoke

The archive extracted into a new, empty application root; `NODE_ENV=production npm install` added 30 packages in 9 s
(462 MB, "found 0 vulnerabilities"); `NODE_ENV=production PORT=3410 node server.js` answered its first page 710 ms
after launch.

- The adapter's 36-check smoke (redirects, language, pages, 404s, sitemap, robots, images, refusals, held-back
  references, now for all 13): **36 / 36**.
- **102 / 102** sitemap pages answer 200 `text/html` with their own `lang`, canonical address and one `h1`; the four test
  404 addresses (`/en/not-a-page`, `/ar/not-a-page`, an unknown service, an unknown project) answer 404.

## C2-13. Project-media safety

Unchanged policy: `projects.ts` and the media registry are untouched, and the ten project files are the same as in
Correction 1. On 106 pages (102 sitemap pages and the four 404s) there are **0** references to any of the 13; each of
the **68 / 68** project pages refers to exactly the photos `projectDetailMedia` allows; the E2E suite's project, services
and homepage checks of the withheld and flagged media passed below.

## C2-14. Warm-up

`scripts/warm-images.mjs`, unchanged since Correction 1, defaults, through a counting proxy: **1,484 discovered, 1,484
warmed** (1,483 new, 1 already cached by the smoke), **0 failed, 0 timed out**, 0 not attempted; 102 of 102 pages read;
103.1 s; **at most 2 requests open** (measured on the server side). The server, having first answered the checks above,
peaked at 539 MiB resident.

## C2-15. npm audit --omit=dev

**found 0 vulnerabilities** (clean clone of `c1841ef`). With development dependencies: the known 5 high entries of the
lint-only `eslint-config-next` chain, unchanged.

## C2-16. Lint

`npm run lint`: exit 0, no warning (12 s).

## C2-17. Typecheck

`npm run typecheck`: exit 0 (9 s).

## C2-18. Build

`NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build`: exit 0 (24 s), 109 / 109 pages. Compared with
Correction 1's clean build (`79cdff5`), build ID and folder normalised: 1,221 of 1,224 files identical; the other 3
(`prerender-manifest.json`, `server/server-reference-manifest.{js,json}`) hold Next.js's random per-build keys; no file
only on one side.

## C2-19. Full E2E

Against the extracted package (`node server.js`, port 3410) after its warm-up: **612 / 612 passed** (24.2 min; 0
failed, 0 skipped, 0 flaky). No test was changed or skipped, and nothing was retried. The cold-cache image defect of
item 12 did not show: the suite ran after the warm-up, as the launch procedure prescribes.

## C2-20. Legal blocker unchanged

`src/content/legal.ts` is byte-identical to `422c397`; the seven visible "Pending confirmation" notes remain. Public DNS
activation stays blocked until RAWASY resolves them.

## C2-21. Nothing published

No upload, no cPanel application, no DNS, nameserver or record change, no SSL, `main` unchanged (`474f61f`), nothing
published. Every server in this correction ran on this machine and was stopped.

## Correction 1 erratum

Correction 1's item C1-6 said "23 monochrome client logos"; the count is **21** (21 logos + 2 brand SVGs + 1
certificate thumbnail + the 3 engraving images = 27, the total it gave). Corrected in place.

## Items needing RAWASY's confirmation

1. Independent review of this correction.
2. When RAWASY approves showing one of the three engraving images (or supplies its own engraving photos), take its ID
   out of `HELD_BACK_MEDIA` in the same change that puts it on a page; the packaging check fails if a page refers to a
   held-back file, so the two cannot drift apart silently.
3. Everything Correction 1 (C1-21) and item 30 list still holds: the legal notes, the cPanel facts and memory limit, the
   domain and mail state, SSL, and a later Next.js upgrade for the image defect (separate review).

## Known limitations

- Unchanged from Correction 1 (C1-22): the warm-up covers WebP-capable browsers; a stuck image size remains possible
  between a start and the end of the warm-up; the packaging script needs Node 22.18 or later and `tar`.
- The 24 other unreferenced public files (logos, brand SVGs, a certificate thumbnail) stay reachable by direct address,
  as the brief keeps them.

## How to run

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://www.rawasymetal.com npm run build
node scripts/package-namecheap.mjs          # 13 files held back; the archive is checked and deleted on any failure
```

Launch order (README, unchanged warm-up): Start App → smoke checklist → `node scripts/warm-images.mjs
https://www.rawasymetal.com` until it reports 0 failed and 0 timed out → normal traffic; after a timeout, Restart and
`--retry=warm-images-report.json`.

## Next steps

Independent review of Correction 2 → RAWASY's decisions (legal notes, cPanel facts) → an explicitly authorized upload,
smoke test and warm-up → DNS and SSL as separate authorized steps. No Phase 2 work.
