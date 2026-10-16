export async function iosEvaluate(expression, port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(row => row.appId === 'sh.paseo.debug' && row.description?.includes('Bridgeless')) ?? targets.find(row => row.appId === 'sh.paseo.debug');
  if (!target?.webSocketDebuggerUrl) throw new Error('iOS CDP target missing');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP evaluate timeout')), 15000);
      socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message)));
        else resolve(message.result.result.value);
      });
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: false } }));
    });
  } finally { socket.close(); }
}
