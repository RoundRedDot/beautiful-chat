import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixtures} from './report.mjs';

const root='/tmp/bc-readme-20261017';
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8'}).trim();
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const fixtureAudit=fixtures.map(([name])=>{
  const candidate=hash(`${root}/candidate/test/fixtures/streams/${name}.jsonl`);
  const parent=hash(`${root}/parent/test/fixtures/streams/${name}.jsonl`);
  const provider=hash(`/tmp/bc-v5/latest/test/fixtures/streams/${name}.jsonl`);
  if(candidate!==parent||candidate!==provider)throw Error(`fixture mismatch: ${name}`);
  return {name,candidate,parent,provider};
});
const old=JSON.parse(readFileSync('/tmp/bc-readme-20261016/raw/environment.json'));
const webAssets=old.webAssets.map(asset=>({path:asset.path,sha256:hash(`${root}/web-dist/${asset.path}`)}));
if(webAssets.some((asset,index)=>asset.sha256!==old.webAssets[index].sha256))throw Error('retained Web export changed');
const patch=sh('git',['-C','/tmp/bc-ios/paseo','diff']);
const hostSha=sh('git',['-C','/tmp/bc-ios/paseo','rev-parse','HEAD']);
if(hostSha!==old.hostSha)throw Error('host baseline changed');
writeFileSync(`${root}/raw/host.patch`,patch+'\n');
const environment={capturedAt:new Date().toISOString(),candidateSha:'b9dfae6e31453b962d90f7d3c7ca972c0e523cb3',parentSha:'2fc6476acbdf75e8802668b0260cfd128513c990',hostname:sh('hostname',[]),os:sh('sw_vers',[]),cpu:sh('/usr/sbin/sysctl',['-n','machdep.cpu.brand_string']),cores:Number(sh('/usr/sbin/sysctl',['-n','hw.ncpu'])),memoryBytes:Number(sh('/usr/sbin/sysctl',['-n','hw.memsize'])),node:process.version,hostSha,webAssets,webExport:'retained production profiling export; hash verified against prior campaign',privateHome:'/Users/rrd/.paseo-bench-p0p1',daemonPort:6871,simulator:old.simulator,fixtureAudit,hostProbe:{path:'packages/app/src/debug/host-perf.ts',sha256:hash('/tmp/bc-ios/paseo/packages/app/src/debug/host-perf.ts')},providerGeneratedDirectory:readFileSync('/tmp/bc-v5/latest/tools/bench-provider/server/fixtures-dir.generated.ts','utf8')};
writeFileSync(`${root}/raw/environment.json`,JSON.stringify(environment,null,2));
writeFileSync(`${root}/raw/simulator-inventory-before.json`,sh('xcrun',['simctl','list','devices','--json']));
writeFileSync(`${root}/raw/protected-avds-before.json`,JSON.stringify(sh('/bin/ps',['-axo','pid=,command=']).split('\n').filter(line=>line.includes('qemu-system')&&line.includes('-avd')),null,2));
console.log(JSON.stringify({hostSha,fixtures:fixtureAudit.length,webAssets,hostname:environment.hostname}));
