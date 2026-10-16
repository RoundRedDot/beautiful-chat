import{readFileSync,writeFileSync}from'node:fs';import{createRequire}from'node:module';
const root='/tmp/bc-ios-five-parallel-20261016',lane=2,dir=`${root}/lane${lane}`,server=readFileSync('/Users/rrd/.paseo-bench-ios-five-lane2/server-id','utf8').trim();
const sample=JSON.parse(readFileSync(`${dir}/raw/web-smoke/lane2-parent-mixed-turn-r0.json`)),base='http://127.0.0.1:8282',url=`${base}/h/${server}/agent/${sample.agentId}`;
const{chromium}=createRequire('/tmp/bc-v5/tools/package.json')('playwright-core'),context=await chromium.launchPersistentContext(`${dir}/web-bootstrap-diagnostic-profile`,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,locale:'zh-CN'}),page=context.pages()[0];
await page.routeWebSocket('**',ws=>{const u=new URL(ws.url());if(['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='6882')ws.connectToServer();else ws.close();});
const result={at:new Date().toISOString(),lane,executionRegime:'setup'};
const snapshot=()=>page.evaluate(server=>{const store=globalThis.__paseoHostRuntimeStore,s=store?.getSnapshot(server);return{url:location.href,hostPerf:!!globalThis.__hostPerf,serverId:s?.serverId,endpoint:s?.activeConnection?.endpoint,status:s?.connectionStatus,body:document.body.innerText.slice(0,300)};},server);
try{
 await page.goto(url);await page.waitForTimeout(8000);result.freshDeepLink=await snapshot();
 await page.goto(base);await page.waitForFunction(server=>globalThis.__paseoHostRuntimeStore?.getSnapshot(server)?.connectionStatus==='online',server,{timeout:60000});result.bootstrap=await snapshot();
 await page.goto(url);await page.waitForFunction(()=>!!globalThis.__hostPerf,undefined,{timeout:60000});result.afterBootstrap=await snapshot();
}catch(e){result.error=String(e.stack??e);}finally{writeFileSync(`${dir}/raw/web-bootstrap-diagnostic.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();}
