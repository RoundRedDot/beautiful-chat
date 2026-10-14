import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertBenchTarget } from "./preflight.mjs";

assertBenchTarget();

const PROFILE = resolve(process.env.BC_CHROME_PROFILE ?? "");
const DEBUG_PORT = Number(process.env.BC_CHROME_DEBUG_PORT ?? 9231);
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!PROFILE.startsWith("/tmp/bc-perf-p0p1/") || PROFILE === "/tmp/bcnp-web-profile") {
  throw new Error(`Refusing non-task Chrome profile: ${PROFILE || "unset"}`);
}
if (!Number.isInteger(DEBUG_PORT) || DEBUG_PORT < 1024 || new Set([6767, 6868, 6869, 8082]).has(DEBUG_PORT)) {
  throw new Error(`Refusing invalid Chrome debugging port ${DEBUG_PORT}`);
}

async function assertFreePort(port) {
  await new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolvePromise));
  });
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
  return response.json();
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.on("message", (buffer) => {
      const message = JSON.parse(buffer.toString());
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
  }

  async send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 60000);
      this.pending.set(id, { resolve: resolvePromise, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const existing = this.listeners.get(method) ?? [];
    existing.push(listener);
    this.listeners.set(method, existing);
  }
}

const WEBSOCKET_GUARD = `(() => {
  const Original = window.WebSocket;
  const blocked = new Set(["6767", "6868", "6869"]);
  const attempts = [];
  Object.defineProperty(window, "__bcBlockedWsAttempts", { value: attempts, configurable: false });
  window.WebSocket = new Proxy(Original, {
    construct(target, args, newTarget) {
      const url = new URL(String(args[0]), location.href);
      if (blocked.has(url.port)) {
        attempts.push(url.href);
        throw new DOMException("blocked by Phase B isolation guard", "SecurityError");
      }
      return Reflect.construct(target, args, newTarget);
    }
  });
})();`;

export async function startBrowser() {
  await assertFreePort(DEBUG_PORT);
  mkdirSync(PROFILE, { recursive: true });
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      `--user-data-dir=${PROFILE}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let target;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Chrome exited with ${child.exitCode}`);
    try {
      const targets = await readJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      target = targets.find((candidate) => candidate.type === "page");
      if (target?.webSocketDebuggerUrl) break;
    } catch {
      await sleep(200);
    }
  }
  if (!target?.webSocketDebuggerUrl) {
    child.kill("SIGTERM");
    throw new Error("Chrome did not expose a page CDP target");
  }

  const { default: WebSocket } = await import("ws");
  const socket = new WebSocket(target.webSocketDebuggerUrl, { origin: "http://127.0.0.1" });
  await new Promise((resolvePromise, reject) => {
    socket.once("open", resolvePromise);
    socket.once("error", reject);
  });
  const cdp = new CDP(socket);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
  await cdp.send("HeapProfiler.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 900,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [
      { name: "prefers-color-scheme", value: "light" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ],
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: WEBSOCKET_GUARD });
  const exceptions = [];
  cdp.on("Runtime.exceptionThrown", (event) => {
    exceptions.push(event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text ?? "unknown exception");
  });

  async function evaluate(expression) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "page evaluation failed");
    }
    return result.result?.value;
  }

  async function navigate(url) {
    await cdp.send("Page.navigate", { url });
    for (let attempt = 0; attempt < 150; attempt++) {
      const state = await evaluate("document.readyState").catch(() => "loading");
      if (state === "complete") return;
      await sleep(100);
    }
    throw new Error(`Navigation did not complete: ${url}`);
  }

  async function metrics() {
    const { metrics } = await cdp.send("Performance.getMetrics");
    return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
  }

  async function screenshot(file) {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(data, "base64"));
  }

  async function close() {
    try {
      socket.close();
    } finally {
      child.kill("SIGTERM");
      await new Promise((resolvePromise) => {
        if (child.exitCode !== null) return resolvePromise();
        child.once("exit", resolvePromise);
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
          resolvePromise();
        }, 5000);
      });
    }
  }

  return { cdp, evaluate, navigate, metrics, screenshot, exceptions, close, chromePid: child.pid };
}

export { sleep };
