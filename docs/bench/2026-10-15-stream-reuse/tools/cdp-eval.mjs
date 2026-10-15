// node cdp-eval.mjs <metroPort> <expression>
const [port, expression] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => /Hermes|React Native|sh\.paseo/i.test(`${t.title} ${t.description}`)) ?? targets[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== 1) return;
  console.log(JSON.stringify(message.result?.result?.value ?? message.result ?? message.error).slice(0, 4000));
  ws.close();
  process.exit(0);
});
setTimeout(() => { console.log("timeout"); process.exit(1); }, 8000);
