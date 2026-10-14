// Static server for the instrumented Paseo web export (SPA fallback).
//   node serve-web.mjs <dist-dir> [port]
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "/tmp/bcnp-web-dist");
const port = Number(process.argv[3] ?? 8092);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};
http
  .createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(root, "index.html");
    }
    res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  })
  .listen(port, "127.0.0.1", () => console.log("serving", root, "on", port));
