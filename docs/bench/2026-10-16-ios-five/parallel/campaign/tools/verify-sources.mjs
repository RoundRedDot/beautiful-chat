import {readFileSync,readlinkSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='/tmp/bc-ios-five-parallel-20261016';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8'}).trim();
const result={at:new Date().toISOString(),executionRegime:'concurrent-max4',lanes:[],failures:[]};
const harnessHashes={};
for(const lane of [2,3,4]){
 const dir=`${root}/lane${lane}`,environment=JSON.parse(readFileSync(`${dir}/raw/environment-core.json`));
 const entry={lane,sources:[],host:{},harnessSamplesChecked:0};
 for(const variant of ['parent','fixed']){
  const bytes=readFileSync(`${root}/raw/${variant}-source.json`),manifest=JSON.parse(bytes),mismatches=[];
  for(const file of manifest.files){
   const path=`${dir}/${variant}/${file.path}`,data=file.mode==='120000'?Buffer.from(readlinkSync(path)):readFileSync(path);
   const actual=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
   if(actual!==file.hash)mismatches.push(file.path);
  }
  const source={variant,sourceSha:manifest.sourceSha,tree:manifest.tree,files:manifest.files.length,manifestSha256:hash(bytes),mismatches};
  if(mismatches.length||source.manifestSha256!==environment.sources[variant].manifestSha256)result.failures.push(`lane${lane}/${variant}: source changed`);
  entry.sources.push(source);
 }
 entry.host={sha:sh('git',['-C',`${dir}/host`,'rev-parse','HEAD']),patchSha256:hash(sh('git',['-C',`${dir}/host`,'diff'])),probeSha256:hash(readFileSync(`${dir}/host/packages/app/src/debug/host-perf.ts`))};
 if(entry.host.sha!==environment.hostSha||entry.host.patchSha256!==environment.hostPatchSha256||entry.host.probeSha256!==environment.hostProbeSha256)result.failures.push(`lane${lane}: host changed`);
 for(const phase of ['core','risk','web-risk'])for(const file of readdirSync(`${dir}/raw/${phase}`).filter(f=>f.endsWith('.json'))){
  const sample=JSON.parse(readFileSync(`${dir}/raw/${phase}/${file}`));
  for(const [name,expected]of Object.entries({...sample.environment.harnessHashes,...sample.environment.webHarnessHashes})){
   harnessHashes[name]??=hash(readFileSync(`${root}/tools/${name}`));
   if(harnessHashes[name]!==expected)result.failures.push(`lane${lane}/${phase}/${file}: harness changed ${name}`);
  }
  entry.harnessSamplesChecked++;
 }
 result.lanes.push(entry);
}
result.harnessHashes=harnessHashes;
result.chromeVersion=sh('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString','/Applications/Google Chrome.app/Contents/Info.plist']);
writeFileSync(`${root}/raw/final-source-verification.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({at:result.at,lanes:result.lanes.length,failures:result.failures}));
if(result.failures.length)process.exitCode=1;
