/**
 * Warms the image cache of a freshly started production server, gently. Deployment only: run it by hand from your own
 * computer once the app answers on a new build; nothing in the website runs or imports it.
 *
 *   node scripts/warm-images.mjs https://www.rawasymetal.com
 *   node scripts/warm-images.mjs https://www.rawasymetal.com --retry=warm-images-report.json
 *
 * Why: with Next.js 16.3.8 a request that is cancelled in its first milliseconds, while it is the very first request
 * for one image size, can leave that size unanswered until the app restarts. A size already in the image cache
 * (.next/cache/images, kept across restarts) is answered from there, so asking once for every size the pages offer,
 * before visitors do, closes that gap. See the README's "Namecheap Stellar Plus deployment".
 *
 * It reads the sitemap, opens each page and collects every optimized image address the page offers (src, srcset and
 * imagesrcset: every size a browser may choose), then asks for each one as a browser would (WebP accepted), with at most
 * --concurrency requests at a time, each read to its end before that worker's next request. It never cancels a request
 * early: one that has not finished after --timeout seconds counts as timed out. It stops starting requests (and waits
 * for those running) when the host answers 429, 503 or 508 (busy or at its resource limit), after 5 problems in a row or
 * 10 in all, or on Ctrl+C (a second Ctrl+C quits at once).
 *
 * Totals: discovered, warmed (new, or already cached), failed, timed out, not attempted. The report (--report, default
 * warm-images-report.json) lists every failed, timed-out and not-attempted address; --retry=<report> asks again for
 * exactly those, once you know why they failed (a size that timed out needs an app restart first). Exit 0 when every
 * image was warmed, 1 otherwise.
 *
 * Options: --concurrency=2 (1 to 4), --timeout=60 (seconds), --pause=100 (milliseconds between one worker's requests),
 * --report=<file>, --retry=<report>. Needs Node 18 or later; no dependencies.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const USAGE =
  "Usage: node scripts/warm-images.mjs <site address> [--concurrency=2] [--timeout=60] [--pause=100] [--report=<file>] [--retry=<report>]";
const fail = (message) => {
  console.error(message);
  process.exit(2);
};
const option = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const positional = args.filter((a) => !a.startsWith("--"));
if (positional.length !== 1 || args.some((a) => a.startsWith("--") && !/^--(?:concurrency|timeout|pause|report|retry)=./.test(a))) fail(USAGE);
let base;
try {
  base = new URL(positional[0]);
} catch {
  fail(USAGE);
}
if (!/^https?:$/.test(base.protocol)) fail(USAGE);
const concurrency = Number(option("concurrency", "2"));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) fail("--concurrency must be 1 to 4: this is shared hosting.");
const timeout = Number(option("timeout", "60"));
if (!(timeout > 0)) fail("--timeout must be a number of seconds above 0.");
const pause = Number(option("pause", "100"));
if (!(pause >= 0)) fail("--pause must be 0 or more milliseconds.");
const reportFile = resolve(option("report", "warm-images-report.json"));
const retryFile = option("retry");

const BUSY = new Set([429, 503, 508]);
const ROW_LIMIT = 5;
const TOTAL_LIMIT = 10;
const AGENT = "rawasy-warm-images (one-off image cache warm-up, scripts/warm-images.mjs)";
const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

const started = Date.now();
let stopped = null;
let inRow = 0;
let problems = 0;
let inFlight = 0;
let maxInFlight = 0;

const stop = (reason) => {
  if (stopped) return;
  stopped = reason;
  console.log(`\nStopping: ${reason}. Waiting for the requests already running…`);
};
process.on("SIGINT", () => {
  if (stopped) process.exit(130);
  stop("Ctrl+C");
});
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** One request, read to its end. Never cancelled early: only the time limit ends it. */
async function get(url, accept) {
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  const t0 = Date.now();
  try {
    const response = await fetch(url, { headers: { "user-agent": AGENT, accept }, signal: AbortSignal.timeout(timeout * 1000) });
    const body = Buffer.from(await response.arrayBuffer());
    return { status: response.status, type: response.headers.get("content-type") ?? "", cache: response.headers.get("x-nextjs-cache"), body, ms: Date.now() - t0 };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    return { timedOut, error: timedOut ? `no complete answer in ${timeout} s` : (error?.cause?.code ?? error?.message ?? String(error)), ms: Date.now() - t0 };
  } finally {
    inFlight -= 1;
  }
}

/** Runs `work` over `items` with `concurrency` workers; nothing new starts once stopped. Returns the items not started. */
async function pool(items, work) {
  let next = 0;
  const worker = async () => {
    while (!stopped && next < items.length) {
      const item = items[next++];
      await work(item);
      if (pause && !stopped && next < items.length) await sleep(pause);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return items.slice(next);
}

/** Counts a problem towards the limits; a busy answer stops at once. */
function problem(status) {
  inRow += 1;
  problems += 1;
  if (BUSY.has(status)) stop(`the host answered ${status} (busy or at its resource limit)`);
  else if (inRow >= ROW_LIMIT) stop(`${ROW_LIMIT} problems in a row`);
  else if (problems >= TOTAL_LIMIT) stop(`${TOTAL_LIMIT} problems in all`);
}

// The sitemap names the public domain; its pages are asked for at the given address (the same, or the app's address
// before the domain points to it).
const at = (address) => {
  const url = new URL(address, base);
  return new URL(url.pathname + url.search, base).href;
};
const pathOf = (href) => {
  const url = new URL(href);
  return url.pathname + url.search;
};

let images = [];
const pages = { listed: 0, read: 0, failed: [] };
if (retryFile) {
  const previous = JSON.parse(readFileSync(resolve(retryFile), "utf8"));
  images = [...previous.failed.map((f) => f.url), ...previous.timedOut, ...previous.notAttempted].map(at);
  console.log(`Retrying ${images.length} images from ${retryFile} (failed ${previous.failed.length}, timed out ${previous.timedOut.length}, not attempted ${previous.notAttempted.length}) at ${base.origin}`);
  if (previous.pages?.failed?.length) console.log(`  ${previous.pages.failed.length} pages could not be read in that run: run a full warm-up for their images.`);
} else {
  console.log(`Reading ${at("/sitemap.xml")}`);
  const sitemap = await get(at("/sitemap.xml"), "application/xml");
  if (sitemap.status !== 200) {
    console.error(`The sitemap did not load (${sitemap.status ?? sitemap.error}); nothing was requested.`);
    process.exit(1);
  }
  const pageUrls = [...new Set([...sitemap.body.toString("utf8").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => at(m[1])))];
  pages.listed = pageUrls.length;
  const found = new Set();
  const notRead = await pool(pageUrls, async (url) => {
    const page = await get(url, "text/html");
    if (page.status !== 200) {
      pages.failed.push({ url: pathOf(url), status: page.status ?? null, error: page.error ?? null });
      problem(page.status);
      return;
    }
    inRow = 0;
    pages.read += 1;
    const html = page.body.toString("utf8");
    // React writes srcSet and imageSrcSet; HTML attribute names are case-insensitive.
    for (const attribute of html.matchAll(/\s(?:src|srcset|imagesrcset)="([^"]*)"/gi)) {
      for (const m of attribute[1].replaceAll("&amp;", "&").matchAll(/(?:https?:\/\/[^/\s",]+)?\/_next\/image\?[^\s",]+/g)) found.add(at(m[0]));
    }
  });
  for (const url of notRead) pages.failed.push({ url: pathOf(url), status: null, error: "not attempted" });
  images = [...found];
  console.log(`Pages: ${pages.read} of ${pages.listed} read · images discovered: ${images.length}`);
}

const result = { new: 0, cached: 0, failed: [], timedOut: [], times: [] };
let done = 0;
let lastLine = Date.now();
const progress = () => {
  console.log(`  ${done} / ${images.length} · warmed ${result.new + result.cached} · failed ${result.failed.length} · timed out ${result.timedOut.length}`);
  lastLine = Date.now();
};
console.log(`Warming at most ${concurrency} at a time (time limit ${timeout} s, pause ${pause} ms)…`);
const notAttempted = stopped
  ? images
  : await pool(images, async (url) => {
      const answer = await get(url, IMAGE_ACCEPT);
      done += 1;
      result.times.push(answer.ms);
      if (answer.timedOut) {
        result.timedOut.push(pathOf(url));
        problem(null);
      } else if (answer.status >= 200 && answer.status < 300 && answer.type.startsWith("image/") && answer.body.length > 0) {
        inRow = 0;
        if (answer.cache === "MISS") result.new += 1;
        else result.cached += 1;
      } else {
        result.failed.push({ url: pathOf(url), status: answer.status ?? null, error: answer.error ?? (answer.status ? `not an image: ${answer.type || "no type"}` : null) });
        problem(answer.status);
      }
      if (done % 100 === 0 || Date.now() - lastLine > 10000) progress();
    });
progress();

const sorted = [...result.times].sort((a, b) => a - b);
const pct = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const totals = {
  discovered: images.length,
  warmed: result.new + result.cached,
  new: result.new,
  alreadyCached: result.cached,
  failed: result.failed.length,
  timedOut: result.timedOut.length,
  notAttempted: notAttempted.length,
};
const report = {
  address: base.origin,
  mode: retryFile ? `retry of ${retryFile}` : "full",
  started: new Date(started).toISOString(),
  finished: new Date().toISOString(),
  seconds: Math.round((Date.now() - started) / 100) / 10,
  settings: { concurrency, timeoutSeconds: timeout, pauseMs: pause },
  maxInFlight,
  stopped,
  pages,
  totals,
  responseMs: { median: pct(50), p95: pct(95), max: sorted.at(-1) ?? 0 },
  failed: result.failed,
  timedOut: result.timedOut,
  notAttempted: notAttempted.map(pathOf),
};
writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

console.log(`
${retryFile ? "Retried" : "Discovered"} ${totals.discovered} · warmed ${totals.warmed} (new ${totals.new}, already cached ${totals.alreadyCached}) · failed ${totals.failed} · timed out ${totals.timedOut} · not attempted ${totals.notAttempted}
${retryFile ? "" : `Pages read ${pages.read} of ${pages.listed} · `}at most ${maxInFlight} request${maxInFlight === 1 ? "" : "s"} at once · ${report.seconds} s · response median ${report.responseMs.median} ms, p95 ${report.responseMs.p95} ms, max ${report.responseMs.max} ms${stopped ? `\nStopped: ${stopped}` : ""}
Report: ${reportFile}`);
for (const f of result.failed.slice(0, 10)) console.log(`  failed ${f.status ?? f.error}: ${f.url}`);
for (const url of result.timedOut.slice(0, 10)) console.log(`  timed out: ${url}`);
const clean = !stopped && !pages.failed.length && !totals.failed && !totals.timedOut && !totals.notAttempted;
if (!clean) console.log("Not every image was warmed: look at the report before retrying (--retry=<report>); restart the app first if any timed out.");
process.exit(clean ? 0 : 1);
