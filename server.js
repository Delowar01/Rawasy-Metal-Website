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
