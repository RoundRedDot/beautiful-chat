import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const directory=process.argv[2];
if(!directory)throw Error('raw directory required');
if(!existsSync(`${directory}/incident-candidate-1-1.json`))throw Error('Uncompressed samples required. Run tools/unpack.mjs into a fresh review directory first.');
const failures=[],samples=[];
const structuralOnly=process.argv.includes('--structural-only');
const display=structuralOnly?null:JSON.parse(readFileSync(`${directory}/metro-errors.json`));
const baselineDiagnosticOnly=display?.lines.some(line=>line.includes('.$beautiful-chat/'))??false;
const blockingDisplayErrors=display?.lines.some(line=>!line.includes('.$beautiful-chat/'))??false;
if(blockingDisplayErrors)failures.push('Metro contains error lines outside the historical baseline namespace');
for(const scenario of ['incident','multi-turn'])for(let rep=1;rep<=5;rep++)for(const [mode,suffix] of [['candidate',`${rep}-1`],['candidate',`${rep}-2`],['before',String(rep)],['baseline',String(rep)],['native',String(rep)]]){
  const label=`${scenario}-${mode}-${suffix}`,file=`${directory}/${label}.json`;
  let sample;
  try{sample=JSON.parse(readFileSync(file));}catch{failures.push(`${label}: missing sample`);continue;}
  if(sample.protocolVersion!==2)failures.push(`${label}: wrong protocol version`);
  if(!sample.completed||sample.error)failures.push(`${label}: incomplete/error`);
  if(!(sample.loadStart<=4))failures.push(`${label}: start load above gate`);
  if(sample.seed.entries!==(scenario==='incident'?810:832)||sample.seed.footers!==(scenario==='incident'?1:12))failures.push(`${label}: canonical shape mismatch`);
  const expectedKinds={user_message:scenario==='incident'?12:23,assistant_message:scenario==='incident'?140:151,reasoning:260,tool_call:398};
  for(const [kind,count] of Object.entries(expectedKinds))if(sample.seed.kinds[kind]!==count)failures.push(`${label}: ${kind} count mismatch`);
  if(sample.seed.longReplyChars!==59427||sample.seed.fixtureSha256!=='e3e342d40c70f66c8a0878337971c0b418322ee84f5991f693f93b15eab9370b')failures.push(`${label}: long reply/fixture identity mismatch`);
  const pages=sample.seed.pages;
  if(pages[0]?.returned!==808||pages.at(-1)?.returned!==(scenario==='incident'?2:24)||pages.at(-1)?.hasOlder!==false||pages.at(-1)?.startCursor?.seq!==1)failures.push(`${label}: incomplete seed pagination`);
  const epoch=pages[0]?.startCursor?.epoch;
  if(pages.some(page=>page.startCursor?.epoch!==epoch||page.endCursor?.epoch!==epoch))failures.push(`${label}: seed epoch mismatch`);
  for(const phase of ['open','tailDrag','older'])if(!sample.phases?.[phase])failures.push(`${label}: missing ${phase}`);
  const check=spawnSync(process.execPath,[fileURLToPath(new URL('./check-sample.mjs',import.meta.url)),file],{encoding:'utf8'});
  const gate=check.stdout.trim()?JSON.parse(check.stdout):{passed:false,failures:[check.stderr]};
  if(mode==='candidate'){
    if(!gate.passed)failures.push(`${label}: ${gate.failures.join('; ')}`);
    if(!sample.copyGate?.sentinelBeforeCopy||!sample.copyGate.exactMatch||sample.copyGate.visibleCopyButtons!==1)failures.push(`${label}: independent full-copy gate failed`);
    if(!sample.remountPreparation?.unmounted||!sample.phases.remount?.remounted)failures.push(`${label}: remount gate failed`);
  }
  const displayErrors=(display?.lines??[]).filter(line=>{const id=line.match(/thought_[\w]+/)?.[0];return id&&JSON.stringify(sample).includes(id);});
  samples.push({label,mode,gate,comparisonEligible:!structuralOnly&&!blockingDisplayErrors&&!(baselineDiagnosticOnly&&mode==='baseline'),displayErrors,
    loadStart:sample.loadStart,loadEnd:sample.loadEnd,openRequests:sample.phases.open?.rpc,
    olderBefore:sample.phases.older?.before.progressKey,olderAfter:sample.phases.older?.viewport.progressKey,
    remountApplicable:!!sample.phases.remount});
}
const result={expected:50,found:samples.length,failures,displayAudit:structuralOnly?'not checked':'complete',
  displayErrorLines:display?.lines.length??null,baselineDiagnosticOnly,comparisonEligible:samples.filter(row=>row.comparisonEligible).length,samples};
writeFileSync(`${directory}/audit.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({expected:result.expected,found:result.found,failures,displayAudit:result.displayAudit,comparisonEligible:result.comparisonEligible,baselineDiagnosticOnly}));
if(failures.length)process.exitCode=1;
