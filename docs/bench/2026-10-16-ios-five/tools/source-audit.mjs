import {readFileSync,readlinkSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [source,manifest]=process.argv.slice(2);
const identity=JSON.parse(readFileSync(manifest,'utf8'));
const mismatches=[];
for(const entry of identity.files){
 const bytes=entry.mode==='120000'?Buffer.from(readlinkSync(`${source}/${entry.path}`)):readFileSync(`${source}/${entry.path}`);
 const actual=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 if(actual!==entry.hash)mismatches.push(entry.path);
}
if(mismatches.length)throw Error(`source mismatch: ${mismatches.join(', ')}`);
writeFileSync(`${source}/source-identity.json`,JSON.stringify(identity,null,2));
console.log(JSON.stringify({baseSha:identity.baseSha,baseTree:identity.baseTree??identity.tree,patchSha256:identity.patchSha256??null,files:identity.files.length,mismatches}));
