// Injected only into the dedicated synthetic-history simulator through CDP.
export function installNativeMeter() {
  const g = globalThis;
  if (g.__historyBench) return;
  const rt = g.__paseoHostRuntimeStore;
  if (!rt || !g.__hostPerf) throw Error('instrumented host not ready');
  const time = () => performance.now();
  let targetAgent = null, savedPane = null, savedTarget = null, savedWorkspace = null;
  const walkTree = (node, visit) => {
    if (!node) return;
    visit(node, node.type?.displayName || node.type?.name || String(node.type));
    walkTree(node.child, visit);
    walkTree(node.sibling, visit);
  };
  const fibers = visit => {
    const hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    for (const id of hook.renderers.keys()) for (const root of hook.getFiberRoots(id)) {
      walkTree(root.current, visit);
    }
  };
  const viewport = () => {
    let result;
    fibers((node, name) => { if (name === 'NativeStreamViewport' && (!targetAgent || node.memoizedProps?.agentId === targetAgent)) result = node; });
    return result;
  };
  const references = node => {
    const refs = [];
    for (let h = node?.memoizedState; h; h = h.next) {
      const current = h.memoizedState?.current;
      if (current && typeof current === 'object') refs.push(current);
    }
    return refs;
  };
  const describe = () => {
    const node = viewport(), props = node?.memoizedProps;
    if (!props) return null;
    const metric = references(node).find(r => r.containerKey === 'native-virtualized');
    const row = item => ({ id: item?.id, kind: item?.kind, blockIndex: item?.data?.blockIndex,
      textChars: item?.data?.text?.length ?? item?.text?.length ?? 0 });
    const mounted = [];
    walkTree(node.child, (n, name) => { if (name === 'HistoryStreamRow') mounted.push(row(n.memoizedProps.item)); });
    return { agentId: props.agentId, ready: props.isAuthoritativeHistoryReady,
      hasOlder: props.hasOlderHistory, loadingOlder: props.isLoadingOlderHistory,
      progressKey: props.olderHistoryProgressKey, metrics: metric ? { ...metric } : null,
      history: [...props.segments.historyVirtualized, ...props.segments.historyMounted].map(row), mounted };
  };
  let state, active = false, previous;
  const originalFetch = rt.fetchAgentTimeline;
  rt.fetchAgentTimeline = function(server, agent, request) {
    const capture = state;
    const call = { agentId: agent, request, startedMs: time() - capture.start };
    if (active) capture.rpc.push(call);
    return originalFetch.call(this, server, agent, request).then(page => {
      call.elapsedMs = time() - capture.start - call.startedMs;
      call.returned = page.entries.length;
      // Serialization is excluded from row CPU but retained in end-to-end latency.
      call.payloadChars = JSON.stringify(page).length;
      call.hasOlder = page.hasOlder;
      call.startCursor = page.startCursor;
      call.endCursor = page.endCursor;
      call.error = page.error ?? null;
      return page;
    });
  };
  const beat = () => {
    const current = time();
    if (active) {
      const gap = current - previous;
      state.maxTimerGapMs = Math.max(state.maxTimerGapMs, gap);
      state.timerTicks++;
      if (gap > 50) state.timerGapsOver50Ms.push(gap);
    }
    previous = current;
    setTimeout(beat, 16);
  };
  const frame = timestamp => {
    if (active) {
      if (state.lastFrame !== null) {
        const gap = timestamp - state.lastFrame;
        state.maxRafGapMs = Math.max(state.maxRafGapMs, gap);
        if (gap > 50) state.rafGapsOver50Ms.push(gap);
      }
      state.lastFrame = timestamp;
    }
    requestAnimationFrame(frame);
  };
  const reset = () => {
    state = { start: time(), rpc: [], timerTicks: 0, maxTimerGapMs: 0, maxRafGapMs: 0,
      timerGapsOver50Ms: [], rafGapsOver50Ms: [], lastFrame: null, readyMs: null };
    previous = time();
    g.__hostPerf.reset();
    g.__bcPerf?.reset();
    active = true;
  };
  reset();
  active = false;
  beat();
  requestAnimationFrame(frame);
  g.__historyBench = {
    reset, describe,
    startReadyWatch(agentId) {
      targetAgent = agentId;
      const capture = state;
      const check = () => {
        if (state !== capture || !active) return;
        const view = describe();
        if (view?.agentId === agentId && view.ready && view.metrics?.viewportHeight > 0 && view.mounted.length) {
          state.readyMs = time() - state.start;
        } else setTimeout(check, 100);
      };
      check();
    },
    prepareOffset(offset) {
      const list = references(viewport()).find(r => typeof r.scrollToOffset === 'function');
      if (!list) throw Error('timeline FlatList missing');
      list.scrollToOffset({ offset, animated: false });
    },
    snapshot() {
      return { ...state, elapsedMs: time() - state.start, viewport: describe(),
        host: g.__hostPerf.snapshot(), plugin: g.__bcPerf?.snapshot() ?? null };
    },
    sessionMounted() { return !!viewport(); },
    leaveSession() {
      fibers(node => { const value=node.memoizedProps?.value;
        if(value?.target?.kind==='agent'&&value.target.agentId===targetAgent&&typeof value.retargetCurrentTab==='function')savedPane=value;
      });
      if(!savedPane)throw Error('target session pane context missing');
      savedTarget={...savedPane.target};savedWorkspace=savedPane.workspaceId;savedPane.retargetCurrentTab({kind:'new_tab'});
    },
    returnSession() {
      if(!savedTarget)throw Error('saved target missing');let pane;
      fibers(node=>{const value=node.memoizedProps?.value;if(value?.workspaceId===savedWorkspace&&value.target?.kind==='new_tab'&&typeof value.retargetCurrentTab==='function')pane=value;});
      if(!pane)throw Error('live new-tab pane context missing');pane.retargetCurrentTab(savedTarget);
    },
    stop() { active = false; },
  };
}
