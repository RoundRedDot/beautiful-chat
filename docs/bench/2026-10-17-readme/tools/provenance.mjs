import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='/tmp/bc-readme-20261017',target=`${root}/parallel-v2/provenance.json`;
if(existsSync(target))throw Error('provenance already captured');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8'}).trim();
const entries=(directory)=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?entries(`${directory}/${entry.name}`):[`${directory}/${entry.name}`]);
const lanes=[];
for(let lane=1;lane<=4;lane++){
  const directory=`${root}/parallel-v2/lane${lane}`,env=JSON.parse(readFileSync(`${directory}/raw/environment.json`));
  const hostHashes=Object.fromEntries(['packages/app/src/agent-stream/view.tsx','packages/app/metro.config.cjs','packages/app/src/debug/host-perf.ts'].map(path=>[path,hash(`${env.BC_HOST}/${path}`)]));
  const hostPatch=sh('git',['-C',env.BC_HOST,'diff']);
  const webAssets=entries(`${directory}/web-dist`).filter(path=>path.endsWith('.js')).map(path=>({path:path.slice(`${directory}/web-dist/`.length),sha256:hash(path)}));
  const fixtureHashes=Object.fromEntries(entries(`${directory}/fixtures`).filter(path=>path.endsWith('.jsonl')).map(path=>[path.split('/').at(-1),hash(path)]));
  lanes.push({lane,environment:env,hostSha:sh('git',['-C',env.BC_HOST,'rev-parse','HEAD']),hostHashes,hostPatchSha256:createHash('sha256').update(hostPatch).digest('hex'),webAssets,fixtureHashes});
}
if(lanes.some(lane=>JSON.stringify(lane.hostHashes)!==JSON.stringify(lanes[0].hostHashes)||lane.hostPatchSha256!==lanes[0].hostPatchSha256))throw Error('host instrumentation differs between lanes');
const harnessFiles=['tools/replay-parallel.mjs','tools/resources.mjs','tools/ios-evaluate.mjs','tools/ios-navigate.mjs','tools/initialized-router.mjs','history/tools/run-web.mjs','history/tools/run-native.mjs','history/tools/seed.mjs','history/tools/web-meter.mjs','history/tools/native-meter.mjs'];
const dependencies=['react','react-native','esbuild','@shikijs/core','@shikijs/engine-javascript','@shikijs/langs','@shikijs/themes','remend'].map(name=>({name,version:JSON.parse(readFileSync(`${root}/candidate/node_modules/${name}/package.json`)).version}));
const result={capturedAt:new Date().toISOString(),candidateSha:'b9dfae6e31453b962d90f7d3c7ca972c0e523cb3',parentSha:'2fc6476acbdf75e8802668b0260cfd128513c990',upstreamSha:'42b61d8301b5400a67821bbbfcf99fa8b681dc37',hostname:sh('hostname',[]),os:sh('sw_vers',[]),cpu:sh('/usr/sbin/sysctl',['-n','machdep.cpu.brand_string']),cores:Number(sh('/usr/sbin/sysctl',['-n','hw.ncpu'])),memoryBytes:Number(sh('/usr/sbin/sysctl',['-n','hw.memsize'])),node:process.version,dependencies,lanes,harnessHashes:Object.fromEntries(harnessFiles.map(path=>[path,hash(`${root}/${path}`)])),note:'Harness hashes were captured after parallel startup and before history/native phases; serial diagnostic evidence remains separate'};
writeFileSync(target,JSON.stringify(result,null,2));console.log(JSON.stringify({lanes:lanes.length,hostHashesMatch:true,webAssets:lanes.map(l=>l.webAssets.length)}));
