import { readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const root=process.argv[2];
if(!root)throw Error('artifact root required');
const expected=JSON.parse(gunzipSync(readFileSync(`${root}/raw/expected-source.json.gz`)));
const results=[];
for(const [mode,source] of Object.entries(expected)){
 const mismatches=[];
 for(const entry of source.entries){
  if(entry.type!=='blob'){mismatches.push({path:entry.path,reason:'unsupported Git object'});continue;}
  try{
   const bytes=entry.mode==='120000'?Buffer.from(readlinkSync(`${root}/${mode}/${entry.path}`)):readFileSync(`${root}/${mode}/${entry.path}`);
   const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
   if(hash!==entry.hash)mismatches.push({path:entry.path,expected:entry.hash,actual:hash});
  }catch(error){mismatches.push({path:entry.path,reason:String(error)});}
 }
 results.push({mode,sha:source.sha,files:source.entries.length,mismatches});
}
writeFileSync(`${root}/raw/source-audit.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
if(results.some(row=>row.mismatches.length))process.exitCode=1;
