import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('review unpack preserves JSON, logs and patches exactly and refuses an existing target',()=>{
  const root=mkdtempSync(join(tmpdir(),'bc-evidence-test-')),source=join(root,'captured'),target=join(root,'review');
  mkdirSync(source);
  try{
    const files={'sample.json':'{"complete":true}\n','metro.log':'duplicate key \n\n','host.patch':'@@ -1 +1 @@\n \n'};
    for(const [name,bytes]of Object.entries(files))writeFileSync(join(source,name+'.gz'),gzipSync(bytes));
    const run=()=>spawnSync(process.execPath,[fileURLToPath(new URL('./unpack.mjs',import.meta.url)),source,target],{encoding:'utf8'});
    assert.equal(run().status,0);
    for(const [name,bytes]of Object.entries(files))assert.equal(readFileSync(join(target,name),'utf8'),bytes);
    assert.notEqual(run().status,0);assert.equal(readFileSync(join(target,'metro.log'),'utf8'),files['metro.log']);
  }finally{rmSync(root,{recursive:true,force:true});}
});
