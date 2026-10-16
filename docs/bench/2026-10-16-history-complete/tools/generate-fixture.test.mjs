import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{completeFixture}from'./generate-fixture.mjs';
test('new fixture preserves workload and exact reply while making every reasoning seed distinct',()=>{
  const source=readFileSync(process.env.BC_FIXTURE_SOURCE??new URL('../../../../test/fixtures/streams/history-long-load.jsonl',import.meta.url),'utf8');
  const a=source.trim().split('\n').map(JSON.parse),b=completeFixture(source).trim().split('\n').map(JSON.parse);
  assert.equal(a.length,b.length);const thoughts=b.filter(x=>x.item?.type==='reasoning');assert.equal(thoughts.length,260);assert.equal(new Set(thoughts.map(x=>x.item.text)).size,260);
  for(let i=1;i<a.length;i++)if(a[i].item.type==='reasoning'){assert.equal(b[i].item.text.length,a[i].item.text.length);assert.equal(b[i].t,a[i].t);}else assert.deepEqual(b[i],a[i]);
  assert.equal(Math.max(...b.filter(x=>x.item?.type==='assistant_message').map(x=>x.item.text.length)),59427);
  assert.equal(completeFixture(source),completeFixture(source));
});
