import test from 'node:test';
import assert from 'node:assert/strict';
import {admitted} from './resources.mjs';
test('parallel admission requires finite CPU and memory evidence without a load-average cutoff',()=>{
  const good={cpuIdlePct:50,memoryFreePct:30,pressureLevel:1,load:[30,20,10]};
  assert.equal(admitted(good),true);
  for(const bad of [{cpuIdlePct:14},{memoryFreePct:9},{pressureLevel:2},{cpuIdlePct:NaN},{memoryFreePct:undefined}])assert.equal(admitted({...good,...bad}),false);
});
