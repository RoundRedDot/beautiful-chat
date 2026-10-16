import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installWebHistoryMeter} from './web-meter.mjs';
test('Web history meter retains multi-second stalls and preserves expanded RPC pages',async()=>{
  let now=0;const timers=[],frames=[],page={entries:[{},{},{}],hasOlder:true,startCursor:{seq:1},endCursor:{seq:3}};
  const request={direction:'tail',limit:1};
  const runtime={fetchAgentTimeline(server,agent,input){assert.equal(this,runtime);assert.equal(input,request);return Promise.resolve(page);}};
  const context={performance:{now:()=>now},setTimeout:fn=>timers.push(fn),requestAnimationFrame:fn=>frames.push(fn),document:{querySelectorAll:()=>[]},__paseoHostRuntimeStore:runtime,__hostPerf:{reset(){},snapshot(){return {};}}};
  vm.runInNewContext(`(${installWebHistoryMeter.toString()})()`,context);
  context.__webHistory.reset();frames.shift()(0);now=2400;timers.shift()();frames.shift()(2400);
  assert.equal(context.__webHistory.snapshot().maxTimerGapMs,2400);
  assert.equal(context.__webHistory.snapshot().maxRafGapMs,2400);
  assert.equal(await runtime.fetchAgentTimeline('private','synthetic',request),page);
  const [call]=context.__webHistory.snapshot().rpc;assert.equal(call.returned,3);assert.equal(call.request.limit,1);
});
test('captures the first timeline request when the runtime is installed during page bootstrap',async()=>{
  const context={performance:{now:()=>0},setTimeout(){},requestAnimationFrame(){},document:{querySelectorAll:()=>[]}};
  vm.runInNewContext(`(${installWebHistoryMeter.toString()})()`,context);
  const runtime={fetchAgentTimeline(){return Promise.resolve({entries:[{}],hasOlder:false});}};
  context.__paseoHostRuntimeStore=runtime;
  await runtime.fetchAgentTimeline('private','fresh',{direction:'tail',limit:40});
  const result=context.__webHistory.snapshot();assert.equal(result.wrapped,true);assert.equal(result.rpc.length,1);assert.equal(result.rpc[0].returned,1);
});
test('distinguishes virtualized blocks from retained recent blocks for remount acceptance',()=>{
  const root={stateNode:{}};root.stateNode.current=root;
  const props={segments:{historyVirtualized:[{id:'old',data:{blockIndex:0}}],historyMounted:[{id:'recent',data:{blockIndex:1}}]},isAuthoritativeHistoryReady:true};
  const element={getClientRects:()=>[{}],clientHeight:600,scrollTop:0,scrollHeight:1200,
    querySelectorAll:()=>[{dataset:{historyRowId:'old'}},{dataset:{historyRowId:'recent'}}],
    __reactFiber$test:{return:{memoizedProps:props,return:root}}};
  const context={performance:{now:()=>0},setTimeout(){},requestAnimationFrame(){},document:{querySelectorAll:()=>[element]}};
  vm.runInNewContext(`(${installWebHistoryMeter.toString()})()`,context);
  const view=context.__webHistory.describe();
  assert.deepEqual(Array.from(view.virtualizedIds),['old']);assert.deepEqual(Array.from(view.retainedIds),['recent']);
  assert.equal(view.history.findLast(row=>row.blockIndex!==undefined&&view.virtualizedIds.includes(row.id)&&view.mountedIds.includes(row.id)).id,'old');
});
