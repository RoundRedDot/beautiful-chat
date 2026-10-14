// Build identity for one iOS simulator run, read through Metro's inspector proxy.
//
//   node ios-identity.mjs --port 8085 [--expect native|fork|upstream] [--dump file.json]
//
// Fork 9f270c6 publishes `imageRpc` on `globalThis.__bcPerf.snapshot()`.
// Upstream 42b61d8 does not; on web its client installs #beautiful-chat-frosted.
// That element is never created off the DOM, so on iOS the equivalent proof that
// the upstream client is the one painting is a host-probe dump whose rows come
// from the plugin (`rows.plugin > 0`) while the fork marker is absent.
// Native is neither marker, and the dump's rows are all host-drawn.
//
// Prints one JSON object. Exit 0 matches --expect, 2 means the app is not ready
// yet, 1 is a hard mismatch or a CDP failure. With no --expect, exit 0 when a
// host context was found.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const port = flag("--port", process.env.METRO_PORT || "8085");
const expect = flag("--expect");
const dumpPath = flag("--dump");
const checkFile = flag("--check-file");

const EXPRESSION = `(() => {
  const g = globalThis;
  let fork = false;
  let snapError = null;
  try {
    const fn = g.__bcPerf && g.__bcPerf.snapshot;
    const snap = typeof fn === "function" ? fn.call(g.__bcPerf) : null;
    fork = !!snap && Object.prototype.hasOwnProperty.call(snap, "imageRpc");
  } catch (error) {
    snapError = String(error && error.message || error);
  }
  let upstream = false;
  let documentMissing = true;
  try {
    documentMissing = typeof document === "undefined" || document == null;
    if (!documentMissing) upstream = document.getElementById("beautiful-chat-frosted") != null;
  } catch {
    upstream = false;
  }
  const host = !!(g.__hostPerf && typeof g.__hostPerf.reset === "function");
  return JSON.stringify({ fork, upstream, host, documentMissing, snapError });
})()`;

function finish(status, body) {
  const payload = { status, ...body };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(status === "match" ? 0 : status === "pending" ? 2 : 1);
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
}

async function targets() {
  const urls = [`http://127.0.0.1:${port}/json/list`, `http://127.0.0.1:${port}/json`];
  let lastError = null;
  for (const url of urls) {
    try {
      const body = await readJson(url);
      const list = Array.isArray(body) ? body : body?.targets || body?.pages || [];
      const found = list.filter((item) => item && item.webSocketDebuggerUrl);
      if (found.length) return found;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const contexts = [];
  let next = 1;
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.method === "Runtime.executionContextCreated" && message.params?.context) {
      contexts.push(message.params.context);
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  const opened = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cdp open timeout")), 8000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("cdp socket error"));
    });
  });
  return {
    contexts,
    ready: opened,
    send(method, params) {
      const id = next++;
      socket.send(JSON.stringify({ id, method, params: params ?? {} }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`timeout ${method}`));
        }, 8000);
        pending.set(id, { resolve, reject, timer });
      });
    },
    close() {
      socket.close();
    },
  };
}

function parseValue(result) {
  if (!result) return null;
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed";
    return { fork: false, upstream: false, host: false, documentMissing: true, snapError: text };
  }
  const value = result.result?.value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") return value;
  return null;
}

async function evaluate(client, contextId) {
  const params = { expression: EXPRESSION, returnByValue: true, awaitPromise: false };
  if (contextId != null) params.contextId = contextId;
  return parseValue(await client.send("Runtime.evaluate", params));
}

async function readTarget(target) {
  const client = connect(target.webSocketDebuggerUrl);
  try {
    await client.ready;
    await client.send("Runtime.enable").catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 300));
    const readings = [];
    const seen = new Set();
    const ids = [undefined, ...client.contexts.map((context) => context.id)];
    for (const contextId of ids) {
      if (contextId != null && seen.has(contextId)) continue;
      if (contextId != null) seen.add(contextId);
      try {
        const reading = await evaluate(client, contextId);
        if (reading) readings.push({ ...reading, contextId: contextId ?? null, title: target.title || target.appId || "" });
      } catch {
        // A context can vanish between the event and the evaluate.
      }
    }
    return readings;
  } finally {
    client.close();
  }
}

function merge(readings) {
  const merged = {
    fork: false,
    upstream: false,
    host: false,
    documentMissing: true,
    contexts: readings.length,
  };
  for (const reading of readings) {
    if (reading.fork) merged.fork = true;
    if (reading.upstream) merged.upstream = true;
    if (reading.host) merged.host = true;
    if (reading.documentMissing === false) merged.documentMissing = false;
  }
  return merged;
}

function rowsOf(dump) {
  if (!dump) return null;
  const probe = dump.probe ?? dump;
  const plugin = probe?.rows?.plugin;
  const native = probe?.rows?.native;
  if (typeof plugin !== "number" || typeof native !== "number") return null;
  return { plugin, native };
}

// A finished dump is trusted from its stamp, so a resume does not need Metro.
if (checkFile) {
  let stamped;
  try {
    stamped = JSON.parse(readFileSync(checkFile, "utf8"));
  } catch (error) {
    finish("error", { error: `unreadable dump: ${error.message}`, fork: false, upstream: false, host: false });
  }
  const identity = stamped.identity;
  const rows = rowsOf(stamped) ?? identity?.rows ?? null;
  if (!identity || identity.status !== "match" || identity.host !== true || !rows) {
    finish("mismatch", { error: "dump has no passing identity stamp", fork: false, upstream: false, host: false, rows });
  }
  const verdict = judge(expect, identity, rows);
  finish(verdict.status, {
    fork: identity.fork,
    upstream: identity.upstream,
    host: identity.host,
    documentMissing: identity.documentMissing,
    rows,
    reason: verdict.reason,
  });
}

// `proven` is false when upstream still cannot be told from a plugin that has
// not loaded: no DOM, and no dump yet. The caller treats that as pending.
function judge(mode, seen, rows) {
  if (!seen.host) return { status: "pending", reason: "host probe missing" };
  if (seen.fork && seen.upstream) return { status: "mismatch", reason: "both markers" };
  if (mode === "fork") {
    if (seen.upstream && !seen.fork) return { status: "mismatch", reason: "upstream marker" };
    if (!seen.fork) return { status: "pending", reason: "fork marker missing" };
    if (rows && rows.plugin <= 0) return { status: "mismatch", reason: "fork marker but no plugin rows" };
    return { status: "match", reason: "imageRpc" };
  }
  if (mode === "upstream") {
    if (seen.fork) return { status: "mismatch", reason: "fork marker" };
    if (seen.upstream) {
      if (rows && rows.plugin <= 0) return { status: "mismatch", reason: "frosted marker but no plugin rows" };
      return { status: "match", reason: "beautiful-chat-frosted" };
    }
    if (!rows) return { status: "pending", reason: "no DOM marker yet" };
    if (rows.plugin > 0) return { status: "match", reason: "plugin rows without imageRpc" };
    return { status: "mismatch", reason: "no plugin rows" };
  }
  if (mode === "native") {
    if (seen.fork || seen.upstream) return { status: "mismatch", reason: "plugin marker" };
    if (rows && (rows.plugin > 0 || rows.native <= 0)) {
      return { status: "mismatch", reason: "native dump painted plugin rows or nothing" };
    }
    return { status: "match", reason: "no plugin marker" };
  }
  return { status: "mismatch", reason: `unknown mode ${mode}` };
}

let dump = null;
let rows = null;
if (dumpPath) {
  try {
    dump = JSON.parse(readFileSync(dumpPath, "utf8"));
    rows = rowsOf(dump);
    if (!rows) finish("error", { error: "dump has no rows", fork: false, upstream: false, host: false });
  } catch (error) {
    finish("error", { error: `dump unreadable: ${error.message}`, fork: false, upstream: false, host: false });
  }
}

let readings = [];
try {
  const list = await targets();
  if (!list.length) finish("pending", { error: "no metro targets", fork: false, upstream: false, host: false, rows });
  for (const target of list) {
    try {
      readings.push(...(await readTarget(target)));
    } catch (error) {
      readings.push({
        fork: false,
        upstream: false,
        host: false,
        documentMissing: true,
        snapError: String(error.message || error),
        title: target.title || "",
      });
    }
  }
} catch (error) {
  finish("pending", { error: String(error.message || error), fork: false, upstream: false, host: false, rows });
}

const usable = readings.filter((reading) => reading.host || reading.fork || reading.upstream);
const merged = usable.length ? merge(usable) : merge(readings);
if (!expect) {
  finish(merged.host ? "match" : "pending", { ...merged, rows, readings: readings.slice(0, 6) });
}
const verdict = judge(expect, merged, rows);
finish(verdict.status, { ...merged, rows, reason: verdict.reason, readings: readings.slice(0, 6) });
