import test from 'node:test';
import assert from 'node:assert/strict';
import {concurrency} from './aggregate.mjs';
test('actual overlap uses captured intervals, including boundary-touching runs and idle lanes',()=>{
  const row=(lane,start,end)=>({lane,startedAt:new Date(start).toISOString(),endedAt:new Date(end).toISOString()});
  const result=concurrency([row(1,1000,2000),row(2,1500,3000),row(3,2000,2500),row(4,3000,4000)]);
  assert.equal(result.maximumTimedGroups,2);
  assert.equal(result.intervals[0].overlappingOtherLanes.length,1);
  assert.equal(result.intervals[3].overlappingOtherLanes.length,0);
  assert.throws(()=>concurrency([row(1,1000,1000)]),/complete actual timing intervals/);
});
