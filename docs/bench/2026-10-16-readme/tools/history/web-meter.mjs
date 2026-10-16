// Browser-only probe; no application source changes or forced pagination callbacks.
export function installWebHistoryMeter() {
  if(globalThis.__webHistory)return;
  let state,previous=performance.now(),framePrevious=null;
  const rows=()=>{
    const el=[...document.querySelectorAll('[data-testid="agent-chat-scroll"]')].find(node=>node.getClientRects().length&&node.clientHeight>0);
    if(!el)return null;
    let fiber=el[Object.keys(el).find(key=>key.startsWith('__reactFiber$'))];
    if(!fiber)throw Error('React DOM fiber missing');
    let top=fiber;while(top.return)top=top.return;
    if(top.stateNode.current!==top)fiber=fiber.alternate;
    let props;
    for(let node=fiber;node;node=node.return)if(node.memoizedProps?.segments&&'isAuthoritativeHistoryReady'in node.memoizedProps){props=node.memoizedProps;break;}
    if(!props)throw Error('Web timeline input missing');
    const history=[...props.segments.historyVirtualized,...props.segments.historyMounted];
    const mountedIds=[...el.querySelectorAll('[data-history-row-id]')].map(node=>node.dataset.historyRowId);
    return {agentId:props.agentId,ready:props.isAuthoritativeHistoryReady,hasOlder:props.hasOlderHistory,progressKey:props.olderHistoryProgressKey,
      history:history.map(item=>({id:item.id,kind:item.kind,blockIndex:item.data?.blockIndex,textChars:item.data?.text?.length??item.text?.length??0})),mountedIds,
      virtualizedIds:props.segments.historyVirtualized.map(item=>item.id),
      retainedIds:props.segments.historyMounted.map(item=>item.id),
      metrics:{scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}};
  };
  const reset=()=>{state={start:performance.now(),maxTimerGapMs:0,maxRafGapMs:0,readyMs:null,rpc:[]};previous=performance.now();framePrevious=null;globalThis.__hostPerf?.reset();};
  reset();
  const beat=()=>{const now=performance.now();state.maxTimerGapMs=Math.max(state.maxTimerGapMs,now-previous);previous=now;setTimeout(beat,16);};beat();
  const frame=now=>{if(framePrevious!==null)state.maxRafGapMs=Math.max(state.maxRafGapMs,now-framePrevious);framePrevious=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  let wrapped=false;
  const seen=new WeakSet();
  const wrap=rt=>{
    if(!rt||seen.has(rt))return;
    if(typeof rt.fetchAgentTimeline!=='function')throw Error('timeline runtime contract changed');
    seen.add(rt);
    const original=rt.fetchAgentTimeline;
    rt.fetchAgentTimeline=function(server,agent,request){
      const capture=state,call={agentId:agent,request,startedMs:performance.now()-capture.start};capture.rpc.push(call);
      return original.call(this,server,agent,request).then(page=>{Object.assign(call,{returned:page.entries.length,payloadChars:JSON.stringify(page).length,hasOlder:page.hasOlder,startCursor:page.startCursor,endCursor:page.endCursor,error:page.error??null,elapsedMs:performance.now()-capture.start-call.startedMs});return page;});
    };wrapped=true;
  };
  let runtime=globalThis.__paseoHostRuntimeStore;
  Object.defineProperty(globalThis,'__paseoHostRuntimeStore',{configurable:true,get:()=>runtime,set:value=>{runtime=value;wrap(value);}});
  wrap(runtime);
  const watch=()=>{
    try{const view=rows();if(view)state.probeError=null;if(state.readyMs===null&&view?.ready&&view.mountedIds.length&&view.metrics.clientHeight>0)state.readyMs=performance.now()-state.start;}catch(error){state.probeError=String(error);}
    setTimeout(watch,100);
  };watch();
  globalThis.__webHistory={reset,describe:rows,snapshot:()=>({...state,wrapped,elapsedMs:performance.now()-state.start,viewport:rows(),host:globalThis.__hostPerf?.snapshot()})};
}
