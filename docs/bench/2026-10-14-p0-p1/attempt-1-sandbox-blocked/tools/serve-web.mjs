import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { assertBenchTarget } from "./preflight.mjs";

assertBenchTarget();
const root = path.resolve(process.argv[2] ?? "/tmp/bcnp-web-dist");
if (root !== "/tmp/bcnp-web-dist") {
  throw new Error(`Refusing to serve an export other than /tmp/bcnp-web-dist: ${root}`);
}
const port = Number(process.env.BC_WEB_PORT ?? process.argv[3] ?? 8092);
if (!Number.isInteger(port) || port < 1024 || new Set([6767, 6868, 6869, 8082]).has(port)) {
  throw new Error(`Refusing invalid or reserved web-server port ${port}`);
}
if (!existsSync(root) || !statSync(root).isDirectory()) {
  throw new Error(`Instrumented web export is missing: ${root}`);
}
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
    let file = path.resolve(root, `.${decodeURIComponent(new URL(req.url, "http://x").pathname)}`);
    if (!file.startsWith(`${root}${path.sep}`) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(root, "index.html");
    }
    res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
    res.setHeader("cache-control", "no-store");
    res.end(readFileSync(file));
  })
  .listen(port, "127.0.0.1", () => console.log(`serving read-only ${root} on 127.0.0.1:${port}`));
