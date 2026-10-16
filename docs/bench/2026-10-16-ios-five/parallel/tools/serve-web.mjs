// Static server for the instrumented Paseo web export (SPA fallback).
//   node serve-web.mjs <dist-dir> [port]
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
const lane = root.match(/^\/tmp\/bc-ios-five-parallel-20261016\/lane([234])\/web-dist$/)?.[1];
const port = Number(process.argv[3]);
if (!lane || port !== 8280 + Number(lane)) throw Error("explicit owned Web root and matching port required");
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
