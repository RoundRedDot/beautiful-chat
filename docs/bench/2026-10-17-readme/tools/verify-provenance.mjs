import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export function verifyProvenance(root){
  const formal=`${root}/parallel-v2`,before=JSON.parse(readFileSync(`${formal}/provenance.json`)),failures=[];
  const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
  const amendmentFile=`${formal}/provenance-history-amendment.json`;
  const amendment=existsSync(amendmentFile)?JSON.parse(readFileSync(amendmentFile)):null;
  const expectedHashes={...before.harnessHashes};
  if(amendment){
    if(amendment.formalHistoryBefore!==0)failures.push('history amendment followed formal collection');
    for(const [path,expected]of Object.entries(amendment.beforeHashes)){
      if(!['history/tools/web-meter.mjs','history/tools/native-meter.mjs','history/tools/run-web.mjs','history/tools/run-native.mjs'].includes(path)||before.harnessHashes[path]!==expected)failures.push(`unrecognized history amendment: ${path}`);
      expectedHashes[path]=amendment.afterHashes[path];
    }
  }
  const preparationFile=`${formal}/provenance-history-preparation-amendment.json`;
  const preparation=existsSync(preparationFile)?JSON.parse(readFileSync(preparationFile)):null;
  if(preparation){
    if(preparation.formalHistoryBefore!==0)failures.push('preparation amendment followed the new formal collection');
    for(const [path,expected]of Object.entries(preparation.beforeHashes)){
      if(!['history/tools/run-web.mjs','history/tools/run-native.mjs'].includes(path)||expectedHashes[path]!==expected)failures.push(`unrecognized preparation amendment: ${path}`);
      expectedHashes[path]=preparation.afterHashes[path];
    }
  }
  const displayPolicyFile=`${formal}/provenance-replay-display-policy-amendment.json`;
  const displayPolicy=existsSync(displayPolicyFile)?JSON.parse(readFileSync(displayPolicyFile)):null;
  if(displayPolicy){
    for(const [path,expected]of Object.entries(displayPolicy.beforeHashes)){
      if(path!=='tools/replay-parallel.mjs'||expectedHashes[path]!==expected)failures.push(`unrecognized display-policy amendment: ${path}`);
      expectedHashes[path]=displayPolicy.afterHashes[path];
    }
    for(const [path,expected]of Object.entries(displayPolicy.additionalHarnessHashes??{}))expectedHashes[path]=expected;
    for(const sample of displayPolicy.samples??[])if(!/^parallel-v2\/lane[1-4]\/raw\/ios\/ios-[^/]+\.json$/.test(sample.path)||hash(`${root}/${sample.path}`)!==sample.sha256)failures.push(`original native sample changed: ${sample.path}`);
  }
  for(const [path,expected]of Object.entries(expectedHashes))if(hash(`${root}/${path}`)!==expected)failures.push(`harness changed: ${path}`);
  const reportingFile=`${formal}/history-reporting-policy.json`;
  const reporting=existsSync(reportingFile)?JSON.parse(readFileSync(reportingFile)):null;
  const reportingFinalFile=`${formal}/history-reporting-final.json`;
  const reportingFinal=existsSync(reportingFinalFile)?JSON.parse(readFileSync(reportingFinalFile)):null;
  if(reporting){
    if(reportingFinal&&(hash(reportingFile)!==reportingFinal.previousPolicySha256||Object.entries(reportingFinal.beforeHashes).some(([path,expected])=>reporting.reportingHashes[path]!==expected)))failures.push('reporting final amendment does not match previous source');
    const reportingHashes={...reporting.reportingHashes,...reportingFinal?.afterHashes};
    for(const [path,expected]of Object.entries(reportingHashes))if(!['history/tools/report.mjs','tools/aggregate.mjs'].includes(path)||hash(`${root}/${path}`)!==expected)failures.push(`reporting source changed: ${path}`);
    if(hash(`${formal}/${reporting.sourceArchive}`)!==reporting.sourceArchiveSha256)failures.push('reporting source archive changed');
    if(hash(`${root}/${reporting.retainedFailedSample.path}`)!==reporting.retainedFailedSample.sha256)failures.push('retained history failure changed');
  }
  for(const lane of before.lanes){
    for(const [path,expected]of Object.entries(lane.hostHashes))if(hash(`${lane.environment.BC_HOST}/${path}`)!==expected)failures.push(`lane ${lane.lane}: host source changed: ${path}`);
    const patch=execFileSync('git',['-C',lane.environment.BC_HOST,'diff'],{encoding:'utf8'}).trim();
    if(createHash('sha256').update(patch).digest('hex')!==lane.hostPatchSha256)failures.push(`lane ${lane.lane}: host patch changed`);
    for(const asset of lane.webAssets)if(hash(`${formal}/lane${lane.lane}/web-dist/${asset.path}`)!==asset.sha256)failures.push(`lane ${lane.lane}: Web asset changed: ${asset.path}`);
  }
  const result={at:new Date().toISOString(),failures,lanes:before.lanes.length,harnessFiles:Object.keys(expectedHashes).length,historyAmendment:amendment,preparationAmendment:preparation,displayPolicyAmendment:displayPolicy,historyReportingPolicy:reporting,historyReportingFinal:reportingFinal};
  mkdirSync(`${formal}/raw`,{recursive:true});writeFileSync(`${formal}/raw/provenance-after.json`,JSON.stringify(result,null,2));
  if(failures.length)throw Error(failures.join('\n'));
  return result;
}
