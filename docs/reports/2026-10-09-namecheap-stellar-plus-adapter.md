# Namecheap Stellar Plus — hosting adapter (cPanel → Setup Node.js App)

Date: 2026-10-09 · Branch: `claude/new-session-5eijs6` · Status: **adapter prepared and proven locally; awaiting
independent review**. Nothing was uploaded to Namecheap, no domain was connected, DNS and nameservers were not touched,
no certificate was installed, `main` was not changed and the legal pages' pending notes are still in place. The site is
not online.

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
  build ✔ (109 pages), **full E2E against `server.js`: running when this draft was committed (result in the next commit)**.
- **Same build as the approved RC:** 1,221 of 1,224 build files byte-identical to the clean `422c397` build once the
  build ID and folder are normalised; the other 3 hold Next.js's random per-build keys.
- **`server.js` vs `next start` on the same build:** 184 / 184 HTTP answers identical in status, headers and bytes
  (102 sitemap pages, the brief's routes, redirects, locale cookie and language cases, 404s, metadata files, static
  files); 1,484 / 1,484 optimized images byte-identical; 42 browser captures with identical status, address, title,
  language, robots, canonical, heading, machine landing and console (39 pixel-identical; the other 3 also vary between
  captures from one and the same server).
- **Deployment rehearsal:** pending when this draft was committed (result in the next commit).

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

The commit that adds this report and the project-memory update, directly on top of `2043981` (documentation only; its
hash is given with the hand-off, since a commit cannot contain its own hash).

## 5. Files changed

| File | Change | Commit |
| --- | --- | --- |
| `server.js` | new, 42 lines | `2043981` |
| `package.json` | `scripts.start` only (1 line) | `2043981` |
| `README.md` | new "Namecheap Stellar Plus deployment" section; one sentence in "Next stages" (+56 −1) | `2043981` |
| `docs/reports/2026-10-09-namecheap-stellar-plus-adapter.md` | this report | report commit |
| `CLAUDE.md` | project memory (adapter status, gotchas) | report commit |
| `README.md` | the deployment section's update and rollback steps: delete the old `.next` before extracting another release | report commit |

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

- **Start:** Passenger starts the app on the first request after a start or an idle period (cold start: Next.js reads
  `next.config.ts` and its manifests; 1–4 s here), then keeps it running; it may run more than one process, which then
  share `.next`'s caches (item 10 note).
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
- **Memory:** optimizing the 1,484 images in one pass peaked at about 513 MB resident on either server; a `server.js`
  that had served the 102 pages and a few images (the first package trial) held about 263 MB. The image cache on disk
  (`.next/cache/images`) reached 28 MB.
- **Withheld project media:** no page or page data refers to any of the 10 withheld or held-back photos (the three
  AI-watermarked files and the seven photos of the five projects awaiting authorship or product confirmation): checked
  over all 102 sitemap pages and the 404s on `server.js`, and covered per project by the E2E suite. **But** the files
  themselves are in `public/media/projects/` (as in the approved RC), so a direct request for their address answers 200
  — on `next start` exactly as on `server.js`. Not changed here (website freeze); a decision for RAWASY (item 30).

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
| `E2E_PORT=3500 npm run test:e2e` | running when this draft was committed (result in the next commit) |

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

Running when this draft was committed: started 04:00 UTC with `E2E_PORT=3500 npm run test:e2e` in the clean clone, against
`server.js` (the only server listening on 3500: `node server.js`; no `next start` process). The exact totals replace this
paragraph in the next commit.

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
  packages in about 20 s: Next.js, React, `sharp` and their native packages, about 460 MB (11,720 files and folders).
  npm 10 installs both the glibc and the musl variants of the native packages, and `@playwright/test` (a dev dependency
  that is also an optional peer of Next.js, so the lockfile marks it `devOptional`; no browser is downloaded). TypeScript,
  ESLint, Tailwind and axe-core are not installed. **Development dependencies are not needed on the server** with the
  prebuilt `.next`: `next.config.ts` is compiled at start by Next.js's own SWC binary (a production dependency), and the
  pages, styles and images need nothing from the build tools (item 28, rehearsal). They would be needed only to build on
  the host, which this plan avoids.

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
    `https://www.rawasymetal.com/` addresses; `/robots.txt` names it; `/_next/image?url=%2Fmedia%2Fprojects%2Fclock-tower-1.webp&w=640&q=75`
    in a browser → WebP; `curl -sI …/en` shows `x-nextjs-prerender: 1` and `Cache-Control: s-maxage=31536000` (the
    production server's answer for a prebuilt page); the panel's log shows no error.
15. DNS and SSL: a separate, explicitly authorized step (items 24–25), then the same smoke checks over HTTPS on both
    names.

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

## Known limitations

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
