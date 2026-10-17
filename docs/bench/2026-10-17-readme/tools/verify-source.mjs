import {readFileSync,readlinkSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=process.argv[2];
if(root!=='/tmp/bc-readme-20261017')throw Error('explicit campaign root required');
const results=[];
for(const name of ['candidate','parent','upstream']){
 const expected=JSON.parse(gunzipSync(readFileSync(`${root}/${name}-source.json.gz`)));
 const directory=name==='upstream'?'/tmp/bc-ios-history/baseline':`${root}/${name}`;
 const mismatches=[];
 for(const entry of expected.entries){
  try{
   const file=`${directory}/${entry.path}`;
   const bytes=entry.mode==='120000'?Buffer.from(readlinkSync(file)):readFileSync(file);
   const actual=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
   if(actual!==entry.hash)mismatches.push({path:entry.path,expected:entry.hash,actual});
  }catch(error){mismatches.push({path:entry.path,error:String(error)});}
 }
 results.push({name,sha:expected.sha,directory,files:expected.entries.length,mismatches});
}
writeFileSync(`${root}/raw/source-audit.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
if(results.some(row=>row.mismatches.length))process.exitCode=1;
