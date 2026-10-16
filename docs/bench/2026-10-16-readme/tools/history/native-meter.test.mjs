import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { installNativeMeter } from './native-meter.mjs';

test('retains a multi-second JS stall instead of treating it as suspension', () => {
  let time=0;
  const timers=[], frames=[];
  const context={ performance:{now:()=>time}, setTimeout:fn=>timers.push(fn), requestAnimationFrame:fn=>frames.push(fn),
    __paseoHostRuntimeStore:{fetchAgentTimeline:()=>Promise.resolve({entries:[]})},
    __hostPerf:{reset(){},snapshot(){return {}}},
    __REACT_DEVTOOLS_GLOBAL_HOOK__:{renderers:new Map(),getFiberRoots:()=>[]},
  };
  vm.runInNewContext(`(${installNativeMeter.toString()})()`,context);
  context.__historyBench.reset();
  frames.shift()(0);
  time=2400;
  timers.shift()();
  frames.shift()(2400);
  const result=context.__historyBench.snapshot();
  assert.equal(result.maxTimerGapMs,2400);
  assert.equal(result.maxRafGapMs,2400);
  assert.equal(result.timerGapsOver50Ms.length,1);
  context.__historyBench.reset();
  assert.equal(context.__historyBench.snapshot().maxTimerGapMs,0);
});

test('RPC wrapper preserves receiver, request and returned page while counting expanded pages', async()=>{
  const page={entries:[{},{},{}],hasOlder:true,startCursor:{seq:1},endCursor:{seq:5}};
  const request={direction:'tail',limit:1};
  const runtime={fetchAgentTimeline(server,agent,input){
    assert.equal(this,runtime);assert.equal(input,request);return Promise.resolve(page);
  }};
  const context={performance:{now:()=>0},setTimeout(){},requestAnimationFrame(){},__paseoHostRuntimeStore:runtime,
    __hostPerf:{reset(){},snapshot(){return {}}},__REACT_DEVTOOLS_GLOBAL_HOOK__:{renderers:new Map(),getFiberRoots:()=>[]}};
  vm.runInNewContext(`(${installNativeMeter.toString()})()`,context);
  context.__historyBench.reset();
  assert.equal(await runtime.fetchAgentTimeline('private','synthetic',request),page);
  const [rpc]=context.__historyBench.snapshot().rpc;
  assert.equal(rpc.request.limit,1);assert.equal(rpc.returned,3);assert.equal(rpc.error,null);
});

test('mounted-row readback belongs only to the selected agent viewport',()=>{
  const row=id=>({type:{name:'HistoryStreamRow'},memoizedProps:{item:{id,kind:'plugin',data:{blockIndex:16}}}});
  const viewport=(agent,id)=>({type:{name:'NativeStreamViewport'},memoizedState:{memoizedState:{current:{containerKey:'native-virtualized',viewportHeight:575}}},
    memoizedProps:{agentId:agent,isAuthoritativeHistoryReady:true,segments:{historyVirtualized:[],historyMounted:[]}},child:row(id)});
  const selected=viewport('selected','selected-row'), other=viewport('other','other-row');
  selected.sibling=other;
  const context={performance:{now:()=>0},setTimeout(){},requestAnimationFrame(){},
    __paseoHostRuntimeStore:{fetchAgentTimeline(){}},__hostPerf:{reset(){},snapshot(){return {}}},
    __REACT_DEVTOOLS_GLOBAL_HOOK__:{renderers:new Map([[1,{}]]),getFiberRoots:()=>[{current:selected}]}};
  vm.runInNewContext(`(${installNativeMeter.toString()})()`,context);
  context.__historyBench.reset();
  context.__historyBench.startReadyWatch('selected');
  const result=context.__historyBench.describe();
  assert.equal(result.agentId,'selected');
  assert.equal(result.mounted.length,1);
  assert.equal(result.mounted[0].id,'selected-row');
});
