import { initializedRouter } from "./initialized-router.mjs";
const [port = "8086", serverId = "", agentId = "", action = "inspect"] = process.argv.slice(2);
const targetsResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
if (!targetsResponse.ok) throw new Error(`Metro targets ${targetsResponse.status}`);
const targets = await targetsResponse.json();
const target = targets.find((row) => row?.appId === "sh.paseo.debug" && row?.description?.includes("React Native Bridgeless")) ?? targets.find((row) => row?.appId === "sh.paseo.debug");
if (!target?.webSocketDebuggerUrl) throw new Error("app CDP target missing");
const inspectExpression = `(() => { const modules = globalThis.__r.getModules(); return JSON.stringify({ modules: modules.size, initialized: [...modules.values()].filter(m => m.isInitialized).length }); })()`;
const token = JSON.stringify(agentId);
const server = JSON.stringify(serverId);
const route = JSON.stringify(`/h/${serverId}/agent/${agentId}`);
const navigateExpression = `(() => { const token=${token}; const mark=(value)=>{globalThis.__bcBenchNavigationStatus=value+":"+token}; mark("pending"); let router=null; try { router=(${initializedRouter.toString()})(globalThis.__r.getModules()); } catch(e) { mark("error:"+String(e&&e.message||e)); return JSON.stringify({ok:false,error:String(e&&e.message||e)}); } if(!router) { mark("error:router-not-found"); return JSON.stringify({ok:false,error:"router-not-found"}); } const rt=globalThis.__paseoHostRuntimeStore; if(!rt||typeof rt.refreshWorkspaceDirectory!=="function") { mark("error:host-runtime-not-ready"); return JSON.stringify({ok:false,error:"host-runtime-not-ready"}); } try { rt.refreshWorkspaceDirectory({serverId:${server},subscribe:true}).then(()=>{try{router.push(${route});mark("pushed")}catch(e){mark("error:"+String(e&&e.message||e))}}).catch((e)=>mark("error:"+String(e&&e.message||e))); return JSON.stringify({ok:true,scheduled:true}); } catch(e) { mark("error:"+String(e&&e.message||e)); return JSON.stringify({ok:false,error:String(e&&e.message||e)}); } })()`;
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (!msg.id || !pending.has(msg.id)) return;
  const { resolve, reject, timer } = pending.get(msg.id);
  clearTimeout(timer);
  pending.delete(msg.id);
  if (msg.error) reject(new Error(JSON.stringify(msg.error)));
  else resolve(msg.result);
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("CDP open timeout")), 8000);
  ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
  ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP socket error")); }, { once: true });
});
const send = (method, params = {}) => {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
  });
};
await send("Runtime.enable");
const expression = action === "inspect" ? inspectExpression : navigateExpression;
const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: false });
if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
const value = result.result?.value ?? null;
if (action !== "inspect") {
  let scheduled;
  try { scheduled = JSON.parse(value); } catch { scheduled = null; }
  if (!scheduled?.ok) throw new Error(`navigation schedule failed: ${value}`);
  const deadline = Date.now() + 20000;
  let status = "";
  while (Date.now() < deadline) {
    const probe = await send("Runtime.evaluate", { expression: "String(globalThis.__bcBenchNavigationStatus || \"\")", returnByValue: true, awaitPromise: false });
    status = probe.result?.value ?? "";
    if (status === `pushed:${agentId}`) break;
    if (status.startsWith(`error:`)) throw new Error(`navigation failed: ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (status !== `pushed:${agentId}`) throw new Error(`navigation timed out: ${status}`);
}
ws.close();
process.stdout.write(JSON.stringify({ target: target.title, result: value }) + "\n");
