import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {observeSockets,ownedSocket} from './socket-isolation.mjs';

test('observing private sockets does not activate forwarding and flags every other endpoint',()=>{
  assert.equal(ownedSocket(new URL('ws://localhost:6891/ws'),6891),true);
  assert.equal(ownedSocket(new URL('ws://127.0.0.1:6892/ws'),6891),false);
  let handler;const violations=observeSockets({on(event,callback){assert.equal(event,'websocket');handler=callback;}},6891);
  handler({url:()=> 'ws://127.0.0.1:6891/ws'});assert.deepEqual(violations,[]);
  handler({url:()=> 'ws://127.0.0.1:6767/ws'});assert.deepEqual(violations,[{hostname:'127.0.0.1',port:'6767'}]);
});
for(const proxy of [false,true])test(proxy?'proxy control delays stream frames until the synchronous wait returns':'stream frames reach the browser while the driver blocks in a synchronous child',async(t)=>{
  // An independent child keeps emitting even while the test process is blocked.
  const serverCode=`const http=require('node:http'),crypto=require('node:crypto');
    const server=http.createServer((req,res)=>res.end('<script>window.framesSeen=[];window.socket=new WebSocket("ws://"+location.host+"/ws");socket.onmessage=e=>framesSeen.push({value:e.data,at:Date.now()});</script>'));
    server.on('upgrade',(req,socket)=>{const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: '+accept+'\\r\\n\\r\\n');let n=0;const timer=setInterval(()=>{const text=Buffer.from(String(++n));socket.write(Buffer.concat([Buffer.from([0x81,text.length]),text]));if(n===20)clearInterval(timer);},40);socket.on('error',()=>clearInterval(timer));socket.on('close',()=>clearInterval(timer));});server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`;
  const server=spawn(process.execPath,['-e',serverCode],{stdio:['ignore','pipe','pipe']});
  let browser;
  try{
    const port=await new Promise((resolve,reject)=>{server.stdout.once('data',data=>resolve(Number(data.toString().trim())));server.once('error',reject);server.once('exit',code=>reject(Error('fixture server exited '+code)));});
    const {chromium}=createRequire(new URL('../../../../.showcase/package.json',import.meta.url))('playwright-core');
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const page=await browser.newPage();const violations=observeSockets(page,port);
    if(proxy)await page.routeWebSocket('**',socket=>socket.connectToServer());
    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForFunction(()=>window.socket.readyState===1);
    const blockedAt=Date.now();execFileSync('/bin/sleep',['1.5']);
    await page.waitForFunction(()=>window.framesSeen.length===20);
    const frames=await page.evaluate(()=>window.framesSeen);
    assert.equal(frames.length,20);
    assert.deepEqual(violations,[]);
    const deliveredDuringWait=frames.filter(frame=>frame.at<blockedAt+1300).length;
    t.diagnostic(JSON.stringify({proxy,frames:frames.length,deliveredDuringWait,lastFrameDelayMs:frames.at(-1).at-blockedAt}));
    if(proxy)assert.ok(deliveredDuringWait<20,'proxy control must expose the forwarding dependency');
    else assert.equal(deliveredDuringWait,20,'all frames must arrive during the blocked driver interval');
  }finally{await browser?.close();server.kill('SIGTERM');}
});
