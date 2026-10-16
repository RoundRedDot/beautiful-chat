import test from 'node:test';
import assert from 'node:assert/strict';
import { admitted, validateResume } from './parallel-resources.mjs';

test('concurrent admission records load but gates CPU and memory pressure', () => {
  const good = { cpuIdlePct: 90, memoryFreePct: 40, pressureLevel: 1, load: [30, 60, 30] };
  assert.equal(admitted(good), true);
  for (const bad of [{ cpuIdlePct: 14 }, { memoryFreePct: 9 }, { pressureLevel: 2 }, { cpuIdlePct: NaN }]) {
    assert.equal(admitted({ ...good, ...bad }), false);
  }
});

test('resume skips only a successful run matching its exact task and fixture', () => {
  const sample = { completed: true, scenario: 'incident', mode: 'candidate', rep: '1-1', seed: { fixtureSha256: '401cba25910431543cb9be5a68110674825e0204701ace37678d809f8c9725e7' } };
  assert.equal(validateResume(sample, 'incident', 'candidate', '1-1'), sample);
  for (const bad of [{ completed: false }, { error: 'failed' }, { mode: 'native' }, { rep: '2-1' }, { seed: {} }]) {
    assert.throws(() => validateResume({ ...sample, ...bad }, 'incident', 'candidate', '1-1'), /preserve and inspect/);
  }
});
