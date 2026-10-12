// Control channel for the host probe on native (the patched Paseo polls GET /cmd).
//   node control-server.mjs <dump-dir> [port]
// POST /queue {"cmd":"reset"|"dump","label":"..."}  queue one command for the app
// GET  /cmd                                          the app takes the queued command
// POST /dump                                         the app posts a snapshot; written to <dump-dir>/<label>.json
// GET  /last-dump                                    {"label":..., "at":...} of the latest dump
// GET  /seen                                         ms since the app last polled
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? "/tmp/bcnp-ios-dumps");
const port = Number(process.argv[3] ?? 8099);
mkdirSync(dir, { recursive: true });

let queued = { cmd: "none" };
let lastDump = null;
let lastPoll = 0;

const body = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    if (req.method === "GET" && url.pathname === "/cmd") {
      lastPoll = Date.now();
      res.end(JSON.stringify(queued));
      queued = { cmd: "none" };
      return;
    }
    if (req.method === "POST" && url.pathname === "/queue") {
      queued = JSON.parse(await body(req));
      res.end("{}");
      return;
    }
    if (req.method === "POST" && url.pathname === "/dump") {
      const snapshot = JSON.parse(await body(req));
      const label = String(snapshot.label || `dump-${Date.now()}`).replace(/[^\w.-]/g, "_");
      writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(snapshot, null, 2));
      lastDump = { label, at: Date.now() };
      res.end("{}");
      return;
    }
    if (url.pathname === "/last-dump") return res.end(JSON.stringify(lastDump));
    if (url.pathname === "/seen") return res.end(JSON.stringify({ msAgo: Date.now() - lastPoll }));
    res.statusCode = 404;
    res.end("{}");
  })
  .listen(port, "127.0.0.1", () => console.log("control on", port, "->", dir));
