import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { iosEvaluate } from './ios-evaluate.mjs';
import { initializedRouter } from './initialized-router.mjs';
import { installNativeMeter } from './native-meter.mjs';
const root = process.env.BC_ROOT, home = process.env.BC_BENCH_HOME, cli = process.env.BC_PASEO_BIN;
const udid = process.env.BC_SIM_UDID, port = Number(process.env.METRO_PORT);
if (!root || !home?.includes('bench') || !cli || !udid || !port) throw Error('explicit private environment required');
const sh = (file, args, options = {}) => execFileSync(file, args, { encoding: 'utf8', timeout: 180000, maxBuffer:32*1024*1024, stdio: ['ignore','pipe','pipe'], ...options }).trim();
const paseo = (...args) => sh(cli, ['--home', home, ...args]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = expression => iosEvaluate(expression, port);
const json = async expression => JSON.parse(await evaluate(`JSON.stringify(${expression})`));
const load = () => Number(sh('/usr/sbin/sysctl',['-n','vm.loadavg']).replace(/[{}]/g,'').trim().split(/\s+/)[0]);
const server = readFileSync(`${home}/server-id`, 'utf8').trim();
const view = () => json('globalThis.__historyBench.describe()');
const snapshot = () => json('globalThis.__historyBench.snapshot()');
const reset = () => evaluate('globalThis.__historyBench.reset();true');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceShas = { candidate: '48a6646bebc42b34baf7db6268c759079faefb5d', before: '57f995d', baseline: '42b61d8', native: null };
async function mode(name) {
  const [current] = JSON.parse(paseo('plugin','ls','better-paseo','--json'));
  const [baseline] = JSON.parse(paseo('plugin','ls','beautiful-chat','--json'));
  if (baseline?.enabled && name!=='baseline') paseo('plugin','disable','beautiful-chat');
  if (name === 'native' || name==='baseline') { if(current.enabled) paseo('plugin','disable','better-paseo'); }
  if(name==='baseline') { if(!baseline.enabled) paseo('plugin','enable','beautiful-chat'); }
  else if(name!=='native') {
    sh('/bin/ln',['-sfn',`${root}/${name}`,'/tmp/bc-m0-o1/active']);
    if(!current.enabled) paseo('plugin','enable','better-paseo');
    paseo('plugin','reload','better-paseo');
  }
  const [plugin] = JSON.parse(paseo('plugin','ls',name==='baseline'?'beautiful-chat':'better-paseo','--json'));
  if (name === 'native' ? plugin.enabled : !plugin.enabled || plugin.status !== 'running') throw Error('plugin mode mismatch');
  return { plugin, sourceSha: sourceShas[name], entrySha256: name === 'native' ? null : sha(`${root}/${name}/index.client.tsx`) };
}
const drag = direction => sh('/opt/homebrew/bin/axe', ['drag','--udid',udid,'--start-x','200','--start-y',direction === 'older' ? '220' : '640',
  '--end-x','200','--end-y',direction === 'older' ? '640' : '220','--duration','0.3']);
async function run(scenario, name, rep, labelPrefix = '') {
  const label = `${labelPrefix}${scenario}-${name}-${rep}`;
  const output = `${root}/raw/${label}.json`;
  if (existsSync(output)) throw Error(`refusing to overwrite ${output}`);
  // A fresh agent per sample prevents a retained client timeline cache from becoming a cold-open result.
  sh(process.execPath,[`${root}/tools/seed.mjs`,scenario],{ env: { ...process.env, BC_SEED_LABEL: label } });
  const [seed] = JSON.parse(readFileSync(`${root}/raw/seeds-${label}.json`));
  const id = seed.agentId;
  const result = { protocolVersion:2, label, scenario, mode: name, rep, seed, phases: {}, startedAt: new Date().toISOString() };
  try {
    result.identity = await mode(name);
    while (load() > 4) { console.log('load gate',load()); await sleep(5000); }
    result.loadStart = load();
    try { sh('xcrun',['simctl','terminate',udid,'sh.paseo.debug']); } catch {}
    sh('xcrun',['simctl','launch',udid,'sh.paseo.debug','--initialUrl',`http://localhost:${port}`]);
    await sleep(8000);
    await evaluate(`(${installNativeMeter.toString()})();globalThis.__bcPerf?.enable();true`);
    await sleep(1500);
    // Directory synchronization is setup. Opening this fresh agent is the timed operation.
    await evaluate(`globalThis.__historyDirectoryReady=false;globalThis.__paseoHostRuntimeStore.refreshWorkspaceDirectory({serverId:${JSON.stringify(server)},subscribe:true}).then(()=>globalThis.__historyDirectoryReady=true);true`);
    for (let n=0;n<100;n++) { if (await evaluate('globalThis.__historyDirectoryReady')) break; await sleep(100); }
    const route = `/h/${server}/agent/${id}`;
    await evaluate(`globalThis.__historyBench.reset();globalThis.__historyBench.startReadyWatch(${JSON.stringify(id)});(${initializedRouter.toString()})(globalThis.__r.getModules()).push(${JSON.stringify(route)});true`);
    // No inspector stays connected during rendering or gestures.
    await sleep(6000);
    result.phases.open = await snapshot();
    if (result.phases.open.viewport?.agentId !== id || result.phases.open.readyMs === null) throw Error('fresh history did not become measured-ready');
    console.log(`${label} open ready=${result.phases.open.readyMs.toFixed(0)}ms gap=${result.phases.open.maxTimerGapMs.toFixed(0)}ms row=${result.phases.open.host.allRows.sum.toFixed(0)}ms`);
    if(process.env.BC_OPEN_ONLY==='1') { result.completed=true;result.loadEnd=load();return result; }
    if((name==='native' && result.phases.open.host.rows.plugin!==0) || (name!=='native' && result.phases.open.host.rows.plugin===0)) throw Error('client renderer mode mismatch');
    if(String(rep)==='1' || String(rep)==='1-1') sh('xcrun',['simctl','io',udid,'screenshot',`${root}/raw/${label}-open.png`]);
    const ui=JSON.parse(sh('/opt/homebrew/bin/axe',['describe-ui','--udid',udid]));
    if(name==='candidate') {
      let copies=0;
      const visit=node=>{if(node.AXLabel==='Copy reply')copies++;for(const child of node.children??[])visit(child);};
      ui.forEach(visit);
      sh('xcrun',['simctl','pbcopy',udid],{input:'BC-SYNTHETIC-COPY-SENTINEL',stdio:['pipe','pipe','pipe']});
      sh('/opt/homebrew/bin/axe',['tap','--udid',udid,'--label','Copy reply','--tap-style','physical']);
      await sleep(350);
      const copied=sh('xcrun',['simctl','pbpaste',udid]);
      const lines=readFileSync(`${root}/candidate/test/fixtures/streams/history-long-load.jsonl`,'utf8').trim().split('\n').slice(1).map(line=>JSON.parse(line));
      const expected=lines.map(line=>line.item).filter(item=>item.type==='assistant_message').sort((a,b)=>b.text.length-a.text.length)[0].text;
      result.copyGate={sentinelBeforeCopy:true,visibleCopyButtons:copies,copiedChars:copied.length,expectedChars:expected.length,exactMatch:copied===expected};
      if(copies!==1 || copied!==expected)throw Error('long reply copy gate failed');
      await sleep(1500);
    }
    // A native drag tests responsiveness at the same tail boundary in all modes.
    await reset();
    const before = await view();
    drag('older');
    await sleep(1500);
    result.phases.tailDrag = { before, ...await snapshot() };
    // Diagnostic preparation approaches the first loaded source row. Only the final HID drag
    // may trigger the measured older-history fetch. Preparation is retained separately.
    const preparation = [];
    let prepared = false;
    for (let n=0;n<70;n++) {
      const current = await view();
      if (!current?.hasOlder) break;
      const metrics = current.metrics;
      const remaining = metrics.contentHeight - metrics.viewportHeight - metrics.offsetY;
      preparation.push({ metrics, mounted: current.mounted, historyEnd: current.history.at(-1), progressKey: current.progressKey });
      const oldestMounted=current.mounted.some(row=>row.id===current.history.at(-1)?.id);
      if (oldestMounted && remaining <= 1000 && remaining > 350 && n > 0) { prepared=true;break; }
      await evaluate(`globalThis.__historyBench.prepareOffset(${Math.max(0, metrics.contentHeight - metrics.viewportHeight - 700)});true`);
      await sleep(350);
    }
    result.olderPreparation = { prepared, steps: preparation, after: await view() };
    if (prepared) {
      await sleep(1500);
      const before = await view();
      await reset();
      const actions = [];
      for (let n=0;n<12;n++) {
        drag('older');actions.push('native drag down 420pt / 0.3s');
        await sleep(700);
        const current = await view();
        if (current.progressKey !== before.progressKey || !current.hasOlder) break;
      }
      await sleep(1000);
      result.phases.older = { before, actions, ...await snapshot() };
      result.phases.older.fetchedOlder=result.phases.older.rpc.some(call=>call.request.direction==='before');
      result.phases.older.revealedOlder=result.phases.older.viewport.progressKey!==before.progressKey;
    }
    // Return to the tail through the existing viewport handle. This is preparation;
    // the timed remount is a native drag back across a recorded long-reply row boundary.
    await evaluate('globalThis.__historyBench.prepareOffset(0);true');
    await sleep(1500);
    const tail = await view();
    // FlatList retains its initial 12 rows permanently; pick a long-reply block outside that set.
    const initiallyRetained = new Set(tail.history.slice(0,12).map(row => row.id));
    const target = tail.mounted.findLast(row => row.blockIndex !== undefined && !initiallyRetained.has(row.id));
    const remountPreparation = [];
    if (target) {
      for(let n=0;n<30;n++) {
        drag('older');await sleep(250);
        const current = await view();
        remountPreparation.push({metrics: current.metrics, mountedIds: current.mounted.map(row=>row.id)});
        if(!current.mounted.some(row=>row.id===target.id)) break;
      }
      const away=await view();
      const unmounted=!away.mounted.some(row=>row.id===target.id);
      result.remountPreparation={target,unmounted,steps:remountPreparation};
      if(unmounted){
        await reset();
        const actions=[];
        for(let n=0;n<35;n++){
          const before=await view();
          drag('newer');await sleep(250);
          const after=await view();
          actions.push({gesture:'native drag up 420pt / 0.3s',before:before.metrics,after:after.metrics});
          if(after.mounted.some(row=>row.id===target.id))break;
        }
        await sleep(1000);
        result.phases.remount={target,actions,...await snapshot()};
        result.phases.remount.remounted=result.phases.remount.viewport.mounted.some(row=>row.id===target.id);
      }
    }
    else result.remountPreparation = { notApplicable: 'No mounted virtualized long-reply block outside FlatList initial retained rows' };
    result.loadEnd=load();
    result.completed=true;
    console.log(`${label} ready=${result.phases.open.readyMs.toFixed(0)}ms gap=${result.phases.open.maxTimerGapMs.toFixed(0)}ms row=${result.phases.open.host.allRows.sum.toFixed(0)}ms older=${!!result.phases.older} remount=${!!result.phases.remount}`);
  } catch(error) { result.error=String(error.stack??error); console.log(`${label} FAILED ${String(error)}`); }
  finally {
    writeFileSync(output,JSON.stringify(result,null,2));
    if(process.env.BC_KEEP_SEED!=='1') paseo('archive',id);
  }
  return result;
}
if(process.argv.includes('--smoke')) {
  await run('incident',process.argv[3]??'candidate',1,process.env.BC_RUN_PREFIX??'smoke-');
} else {
  for(const scenario of ['incident','multi-turn'])for(let rep=1;rep<=5;rep++){
    const names=rep%2?['candidate','candidate','before','baseline','native']:['native','baseline','before','candidate','candidate'];
    let candidateIndex=0;
    for(const name of names)await run(scenario,name,name==='candidate'?`${rep}-${++candidateIndex}`:rep);
  }
}
