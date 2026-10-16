import { readFileSync } from 'node:fs';
// A one-second event-loop stall is the diagnostic freeze gate, not a frame-rate claim.
const sample = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const open = sample.phases?.open;
const failures = [];
if (!sample.completed || sample.error) failures.push(sample.error ?? 'incomplete sample');
if (!open?.readyMs || open.viewport?.agentId !== sample.seed?.agentId) failures.push('fresh history not ready');
if (open?.maxTimerGapMs >= 1000) failures.push(`open JS stall ${open.maxTimerGapMs.toFixed(0)}ms`);
if (sample.phases?.tailDrag) {
  const phase = sample.phases.tailDrag;
  if (phase.viewport.metrics.offsetY <= phase.before.metrics.offsetY + 20) failures.push('native tail drag did not move history');
  if (phase.maxTimerGapMs >= 1000) failures.push(`tail JS stall ${phase.maxTimerGapMs.toFixed(0)}ms`);
}
if (sample.phases?.older && !sample.phases.older.revealedOlder) failures.push('native drag did not reveal older history');
if (sample.phases?.remount && !sample.phases.remount.viewport.mounted.some(row => row.id === sample.phases.remount.target.id)) failures.push('target row did not remount');
if(sample.mode==='candidate' && sample.phases?.tailDrag && (!sample.phases.older || !sample.phases.remount)) failures.push('candidate missing older/remount phase');
if(sample.copyGate && !sample.copyGate.exactMatch) failures.push('reply copy mismatch');
console.log(JSON.stringify({label: sample.label, passed: !failures.length, failures}));
if (failures.length) process.exitCode = 1;
