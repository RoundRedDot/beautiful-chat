import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import{installWebHistoryMeter}from'./web-meter.mjs';import{installNativeMeter}from'./native-meter.mjs';
for(const platform of ['web','ios'])test(`${platform}: session return uses the live pane after the old context unmounts`,()=>{
  let present=true,oldCalls=0,newCalls=0;const root={stateNode:{}};root.stateNode.current=root;
  const target={kind:'agent',agentId:'synthetic'},props={agentId:'synthetic',segments:{historyVirtualized:[],historyMounted:[{id:'row'}]},isAuthoritativeHistoryReady:true};
  const metric={containerKey:'native-virtualized',viewportHeight:400};
  const viewport={type:{displayName:'NativeStreamViewport'},memoizedProps:props,memoizedState:{memoizedState:{current:metric}}};
  viewport.child={type:{displayName:'HistoryStreamRow'},memoizedProps:{item:{id:'row'}}};
  const agentPane={memoizedProps:{value:{workspaceId:'owned',target,retargetCurrentTab(value){oldCalls++;assert.equal(oldCalls,1);assert.equal(value.kind,'new_tab');present=false;root.child=newPane;}}},child:viewport,return:root};
  const newPane={memoizedProps:{value:{workspaceId:'owned',target:{kind:'new_tab'},retargetCurrentTab(value){newCalls++;assert.equal(value.agentId,'synthetic');present=true;root.child=agentPane;}}},return:root};
  root.child=agentPane;viewport.return=agentPane;
  const element={getClientRects:()=>[{}],clientHeight:400,scrollTop:0,scrollHeight:800,querySelectorAll:()=>[{dataset:{historyRowId:'row'}}],__reactFiber$probe:{return:viewport}};
  const sidebar={__reactFiber$probe:{return:root}};
  const host={reset(){},snapshot(){return {};}};
  const context={performance:{now:()=>0},setTimeout(){},requestAnimationFrame(){},__hostPerf:host,
    __paseoHostRuntimeStore:{fetchAgentTimeline(){return Promise.resolve({entries:[]});}},
    document:{querySelectorAll:selector=>selector==='div'?[sidebar]:present?[element]:[]},
    __REACT_DEVTOOLS_GLOBAL_HOOK__:{renderers:new Map([[1,{}]]),getFiberRoots:()=>new Set([{current:root}])}};
  vm.runInNewContext(`(${(platform==='web'?installWebHistoryMeter:installNativeMeter).toString()})()`,context);
  const meter=platform==='web'?context.__webHistory:context.__historyBench;
  if(platform==='ios')meter.startReadyWatch('synthetic');
  assert.equal(meter.sessionMounted(),true);meter.leaveSession();assert.equal(meter.sessionMounted(),false);
  meter.returnSession();assert.equal(meter.sessionMounted(),true);assert.equal(oldCalls,1);assert.equal(newCalls,1);
});
