import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyProvenance} from './verify-provenance.mjs';

test('unchanged inputs pass; drift in the harness, host probe or built asset blocks publication',()=>{
  for(const changed of [null,'harness','host','web','sample']){
    const root=mkdtempSync(join(tmpdir(),'benchmark-provenance-'));
    try{
      const host=join(root,'host'),formal=join(root,'parallel-v2');
      mkdirSync(host);mkdirSync(join(formal,'lane1/web-dist'),{recursive:true});
      mkdirSync(join(formal,'lane1/raw/ios'),{recursive:true});
      execFileSync('git',['init','-q',host]);
      const files={harness:join(root,'runner.mjs'),host:join(host,'probe.ts'),web:join(formal,'lane1/web-dist/app.js'),sample:join(formal,'lane1/raw/ios/ios-fork-diff-large-r1.json')};
      for(const file of Object.values(files))writeFileSync(file,'original');
      execFileSync('git',['-C',host,'add','probe.ts']);
      const hash=text=>createHash('sha256').update(text).digest('hex');
      writeFileSync(join(formal,'provenance.json'),JSON.stringify({harnessHashes:{'runner.mjs':hash('original')},lanes:[{lane:1,environment:{BC_HOST:host},hostHashes:{'probe.ts':hash('original')},hostPatchSha256:hash(''),webAssets:[{path:'app.js',sha256:hash('original')}]}]}));
      writeFileSync(join(formal,'provenance-replay-display-policy-amendment.json'),JSON.stringify({beforeHashes:{},afterHashes:{},samples:[{path:'parallel-v2/lane1/raw/ios/ios-fork-diff-large-r1.json',sha256:hash('original')}]}));
      if(changed)writeFileSync(files[changed],'changed');
      if(changed)assert.throws(()=>verifyProvenance(root),/changed/);
      else assert.deepEqual(verifyProvenance(root).failures,[]);
      const record=JSON.parse(readFileSync(join(formal,'raw/provenance-after.json')));
      assert.equal(record.failures.length>0,changed!==null);
    }finally{rmSync(root,{recursive:true,force:true});}
  }
});
